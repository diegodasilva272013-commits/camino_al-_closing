import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { sendPushToUser } from '@/lib/push';
import { ACTIVITY_TYPES } from '@/constants/leads';
import { APP_TIMEZONE } from '@/constants/timezone';

export const dynamic = 'force-dynamic';

// GET /api/agenda/reuniones?desde=&hasta=&estado=
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const url = req.nextUrl;
  const desde     = url.searchParams.get('desde');
  const hasta     = url.searchParams.get('hasta');
  const estado    = url.searchParams.get('estado');
  const setterId  = url.searchParams.get('setter_id');
  const closerId  = url.searchParams.get('closer_id');

  let query = admin
    .from('reuniones')
    .select(`
      *,
      closer:closer_id(id, full_name, avatar_url),
      setter:setter_id(id, full_name, avatar_url),
      lead:lead_id(id, first_name, last_name, phone, current_status)
    `)
    .order('inicio', { ascending: true });

  if (setterId) query = query.eq('setter_id', setterId);
  if (closerId) query = query.eq('closer_id', closerId);
  if (desde)  query = query.gte('inicio', desde);
  if (hasta)  query = query.lte('inicio', hasta);
  if (estado) query = query.eq('estado', estado);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/agenda/reuniones — crear reunión (solo setter)
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['setter', 'admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Solo setters pueden agendar reuniones' }, { status: 403 });
  }

  const body = await req.json();
  const {
    closer_id,
    lead_id,
    team_lead_id,
    inicio,
    duracion_min = 60,
    conversacion_whatsapp,
    notas,
  } = body;

  // Validaciones básicas
  if (!closer_id) return NextResponse.json({ error: 'closer_id requerido' }, { status: 400 });
  if (!lead_id && !team_lead_id) return NextResponse.json({ error: 'lead_id o team_lead_id requerido' }, { status: 400 });
  if (!inicio) return NextResponse.json({ error: 'inicio requerido' }, { status: 400 });
  if (!conversacion_whatsapp?.trim()) {
    return NextResponse.json({ error: 'La conversación de WhatsApp es obligatoria' }, { status: 400 });
  }
  const inicioDate = new Date(inicio);
  if (isNaN(inicioDate.getTime())) {
    return NextResponse.json({ error: 'inicio debe ser una fecha ISO válida' }, { status: 400 });
  }
  if (inicioDate.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'La reunión debe ser en el futuro' }, { status: 400 });
  }

  // Verificar que el closer existe y tiene el rol correcto
  const { data: closer } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', closer_id)
    .eq('role', 'closer')
    .single();
  if (!closer) return NextResponse.json({ error: 'Closer no encontrado' }, { status: 404 });

  // Verificar que el lead pertenece al setter
  let currentLeadStatus: string | null = null;
  if (lead_id) {
    const { data: lead } = await admin
      .from('leads')
      .select('id, current_status, assigned_to_user_id')
      .eq('id', lead_id)
      .single();
    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    if (lead.assigned_to_user_id !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'El lead no te pertenece' }, { status: 403 });
    }
    currentLeadStatus = lead.current_status;
  } else if (team_lead_id) {
    const { data: tl } = await admin
      .from('team_leads')
      .select('id, current_status, team_id')
      .eq('id', team_lead_id)
      .single();
    if (!tl) return NextResponse.json({ error: 'Team lead no encontrado' }, { status: 404 });
    // Verificar que el setter es miembro del equipo
    const { data: team } = await admin
      .from('setter_teams')
      .select('setter1_id, setter2_id')
      .eq('id', tl.team_id)
      .single();
    if (profile?.role !== 'admin' && team?.setter1_id !== user.id && team?.setter2_id !== user.id) {
      return NextResponse.json({ error: 'No eres miembro de ese equipo' }, { status: 403 });
    }
    currentLeadStatus = tl.current_status;
  }

  // Anti doble-booking: verificar que el closer no tiene solapamiento
  const inicioMs = inicioDate.getTime();
  const finMs    = inicioMs + duracion_min * 60 * 1000;
  const finISO   = new Date(finMs).toISOString();

  const { data: conflictos } = await admin
    .from('reuniones')
    .select('id, inicio, duracion_min')
    .eq('closer_id', closer_id)
    .in('estado', ['agendada', 'reprogramada']);

  const hayConflicto = (conflictos ?? []).some((r: { inicio: string; duracion_min: number }) => {
    const rIni = new Date(r.inicio).getTime();
    const rFin = rIni + r.duracion_min * 60 * 1000;
    return inicioMs < rFin && finMs > rIni;
  });

  if (hayConflicto) {
    return NextResponse.json(
      { error: 'El closer ya tiene una reunión en ese horario' },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // Formatear la fecha/hora en Caracas para el mensaje de actividad
  const fechaCaracas = inicioDate.toLocaleString('es-VE', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const activityNote = `Reunión agendada con ${closer.full_name} para el ${fechaCaracas}`;

  // ── Operación principal (secuencial para trazabilidad) ────────────────
  // 1. Crear la reunión
  const { data: reunion, error: reunionError } = await admin
    .from('reuniones')
    .insert({
      lead_id:               lead_id ?? null,
      team_lead_id:          team_lead_id ?? null,
      closer_id,
      setter_id:             user.id,
      inicio,
      duracion_min,
      conversacion_whatsapp: conversacion_whatsapp.trim(),
      notas:                 notas ?? null,
      estado_lead_anterior:  currentLeadStatus,
    })
    .select()
    .single();

  if (reunionError) return NextResponse.json({ error: reunionError.message }, { status: 500 });

  // 2. Mover el lead a REUNION_AGENDADA + registrar actividad
  if (lead_id) {
    await Promise.all([
      admin.from('leads').update({
        current_status: 'REUNION_AGENDADA',
        last_action_at: now,
        updated_at:     now,
      }).eq('id', lead_id),
      admin.from('lead_activities').insert({
        lead_id,
        user_id:         user.id,
        type:            ACTIVITY_TYPES.STATUS_CHANGE,
        previous_status: currentLeadStatus,
        new_status:      'REUNION_AGENDADA',
        note:            activityNote,
      }),
    ]);
  } else if (team_lead_id) {
    // Para team_lead: actualizar team_lead y sincronizar source_lead si existe
    const { data: tl } = await admin
      .from('team_leads')
      .select('source_lead_id')
      .eq('id', team_lead_id)
      .single();

    const ops: Promise<unknown>[] = [
      admin.from('team_leads').update({
        current_status: 'REUNION_AGENDADA',
        updated_at:     now,
      }).eq('id', team_lead_id),
      admin.from('team_lead_activities').insert({
        team_lead_id,
        user_id:         user.id,
        type:            ACTIVITY_TYPES.STATUS_CHANGE,
        previous_status: currentLeadStatus,
        new_status:      'REUNION_AGENDADA',
        note:            activityNote,
      }),
    ];

    if (tl?.source_lead_id) {
      ops.push(
        admin.from('leads').update({
          current_status: 'REUNION_AGENDADA',
          last_action_at: now,
          updated_at:     now,
        }).eq('id', tl.source_lead_id),
        admin.from('lead_activities').insert({
          lead_id:         tl.source_lead_id,
          user_id:         user.id,
          type:            ACTIVITY_TYPES.STATUS_CHANGE,
          previous_status: currentLeadStatus,
          new_status:      'REUNION_AGENDADA',
          note:            activityNote,
        }),
      );
    }

    await Promise.all(ops);
  }

  // 3. Push notification al closer
  try {
    await sendPushToUser(closer_id, {
      title: '📅 Nueva reunión agendada',
      body:  `${fechaCaracas} — ${duracion_min} min`,
      url:   '/agenda',
      tag:   'reunion-nueva',
    });
  } catch { /* push es best-effort */ }

  return NextResponse.json(reunion, { status: 201 });
}
