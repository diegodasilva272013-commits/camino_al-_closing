import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { sendPushToUser } from '@/lib/push';
import { ACTIVITY_TYPES } from '@/constants/leads';
import { APP_TIMEZONE } from '@/constants/timezone';

export const dynamic = 'force-dynamic';

// GET /api/agenda/reuniones/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();

  const { data: reunion, error } = await admin
    .from('reuniones')
    .select(`
      *,
      closer:profiles!reuniones_closer_id_fkey(id, full_name, avatar_url, email),
      setter:profiles!reuniones_setter_id_fkey(id, full_name, avatar_url),
      lead:leads(id, first_name, last_name, phone, email, current_status),
      team_lead:team_leads(id, first_name, last_name, phone, current_status)
    `)
    .eq('id', params.id)
    .single();

  if (error || !reunion) return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });

  const role = profile?.role as string;
  if (
    role !== 'admin' &&
    reunion.setter_id !== user.id &&
    reunion.closer_id !== user.id
  ) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  return NextResponse.json(reunion);
}

// PATCH /api/agenda/reuniones/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role as string;

  const { data: reunion } = await admin
    .from('reuniones')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!reunion) return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });

  const isSetter  = reunion.setter_id  === user.id;
  const isCloser  = reunion.closer_id  === user.id;
  const isAdmin   = role === 'admin';

  if (!isSetter && !isCloser && !isAdmin) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const body = await req.json();
  const { estado, inicio, duracion_min, notas, resultado } = body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const now = new Date().toISOString();

  // ── Cambio de estado ────────────────────────────────────────────────
  if (estado && estado !== reunion.estado) {
    const setterAllowed  = ['reprogramada', 'cancelada'];
    const closerAllowed  = ['completada', 'no_show', 'cancelada'];

    if (!isAdmin) {
      if (isSetter && !setterAllowed.includes(estado)) {
        return NextResponse.json({ error: `Setter no puede poner estado '${estado}'` }, { status: 403 });
      }
      if (isCloser && !closerAllowed.includes(estado)) {
        return NextResponse.json({ error: `Closer no puede poner estado '${estado}'` }, { status: 403 });
      }
    }

    updates.estado = estado;

    // ── Efectos por estado ────────────────────────────────────────────
    const leadId     = reunion.lead_id     as string | null;
    const teamLeadId = reunion.team_lead_id as string | null;

    const fechaCaracas = new Date(reunion.inicio).toLocaleString('es-VE', {
      timeZone: APP_TIMEZONE, day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    if (estado === 'reprogramada' && inicio) {
      // Anti doble-booking para la nueva fecha
      const nuevoInicioMs = new Date(inicio).getTime();
      const nuevoDuracion = duracion_min ?? reunion.duracion_min;
      const nuevoFinMs    = nuevoInicioMs + nuevoDuracion * 60 * 1000;

      const { data: conflictos } = await admin
        .from('reuniones')
        .select('id, inicio, duracion_min')
        .eq('closer_id', reunion.closer_id)
        .in('estado', ['agendada', 'reprogramada'])
        .neq('id', params.id);

      const hayConflicto = (conflictos ?? []).some((r: { inicio: string; duracion_min: number }) => {
        const rIni = new Date(r.inicio).getTime();
        const rFin = rIni + r.duracion_min * 60 * 1000;
        return nuevoInicioMs < rFin && nuevoFinMs > rIni;
      });

      if (hayConflicto) {
        return NextResponse.json({ error: 'El closer ya tiene una reunión en ese horario' }, { status: 409 });
      }

      updates.inicio = inicio;
      if (duracion_min) updates.duracion_min = duracion_min;

      const nuevaFechaCaracas = new Date(inicio).toLocaleString('es-VE', {
        timeZone: APP_TIMEZONE, day: '2-digit', month: '2-digit',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      await insertActivity(admin, leadId, teamLeadId, user.id, ACTIVITY_TYPES.NOTE_ADDED, null, null,
        `Reunión reprogramada para ${nuevaFechaCaracas}`);

      // Notificar al closer
      try {
        await sendPushToUser(reunion.closer_id, {
          title: '📅 Reunión reprogramada',
          body:  nuevaFechaCaracas,
          url:   '/agenda',
          tag:   'reunion-reprogramada',
        });
      } catch { /* best-effort */ }

    } else if (estado === 'cancelada') {
      // Revertir status del lead al estado anterior
      const estadoAnterior = reunion.estado_lead_anterior as string | null;
      if (estadoAnterior && leadId) {
        const { data: currentLead } = await admin.from('leads').select('current_status').eq('id', leadId).single();
        await Promise.all([
          admin.from('leads').update({
            current_status: estadoAnterior,
            last_action_at: now,
            updated_at:     now,
          }).eq('id', leadId),
          admin.from('lead_activities').insert({
            lead_id:         leadId,
            user_id:         user.id,
            type:            ACTIVITY_TYPES.STATUS_CHANGE,
            previous_status: currentLead?.current_status ?? 'REUNION_AGENDADA',
            new_status:      estadoAnterior,
            note:            `Reunión del ${fechaCaracas} cancelada — estado revertido`,
          }),
        ]);
      } else if (estadoAnterior && teamLeadId) {
        const { data: currentTl } = await admin.from('team_leads').select('current_status, source_lead_id').eq('id', teamLeadId).single();
        const ops: Promise<unknown>[] = [
          admin.from('team_leads').update({
            current_status: estadoAnterior,
            updated_at:     now,
          }).eq('id', teamLeadId),
          admin.from('team_lead_activities').insert({
            team_lead_id:    teamLeadId,
            user_id:         user.id,
            type:            ACTIVITY_TYPES.STATUS_CHANGE,
            previous_status: currentTl?.current_status ?? 'REUNION_AGENDADA',
            new_status:      estadoAnterior,
            note:            `Reunión del ${fechaCaracas} cancelada — estado revertido`,
          }),
        ];
        if (currentTl?.source_lead_id) {
          ops.push(
            admin.from('leads').update({
              current_status: estadoAnterior,
              last_action_at: now,
              updated_at:     now,
            }).eq('id', currentTl.source_lead_id),
            admin.from('lead_activities').insert({
              lead_id:         currentTl.source_lead_id,
              user_id:         user.id,
              type:            ACTIVITY_TYPES.STATUS_CHANGE,
              previous_status: 'REUNION_AGENDADA',
              new_status:      estadoAnterior,
              note:            `Reunión del ${fechaCaracas} cancelada — estado revertido`,
            }),
          );
        }
        await Promise.all(ops);
      }

      try {
        const notifyId = isSetter ? reunion.closer_id : reunion.setter_id;
        await sendPushToUser(notifyId, {
          title: '❌ Reunión cancelada',
          body:  `La reunión del ${fechaCaracas} fue cancelada`,
          url:   '/agenda',
          tag:   'reunion-cancelada',
        });
      } catch { /* best-effort */ }

    } else if (estado === 'completada') {
      await insertActivity(admin, leadId, teamLeadId, user.id, ACTIVITY_TYPES.NOTE_ADDED, null, null,
        `Reunión completada el ${fechaCaracas}${resultado ? ': ' + resultado : ''}`);

    } else if (estado === 'no_show') {
      await insertActivity(admin, leadId, teamLeadId, user.id, ACTIVITY_TYPES.NOTE_ADDED, null, null,
        `No-show en reunión del ${fechaCaracas}`);
    }
  }

  if (notas     !== undefined) updates.notas     = notas;
  if (resultado !== undefined) updates.resultado  = resultado;

  const { data: updated, error } = await admin
    .from('reuniones')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

async function insertActivity(
  admin: any,
  leadId: string | null,
  teamLeadId: string | null,
  userId: string,
  type: string,
  previousStatus: string | null,
  newStatus: string | null,
  note: string
) {
  const ops: Promise<unknown>[] = [];
  if (leadId) {
    ops.push(admin.from('lead_activities').insert({
      lead_id: leadId, user_id: userId, type,
      ...(previousStatus ? { previous_status: previousStatus } : {}),
      ...(newStatus      ? { new_status: newStatus }           : {}),
      note,
    }));
  }
  if (teamLeadId) {
    ops.push(admin.from('team_lead_activities').insert({
      team_lead_id: teamLeadId, user_id: userId, type,
      ...(previousStatus ? { previous_status: previousStatus } : {}),
      ...(newStatus      ? { new_status: newStatus }           : {}),
      note,
    }));
  }
  await Promise.all(ops);
}
