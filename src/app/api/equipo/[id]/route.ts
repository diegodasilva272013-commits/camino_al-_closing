import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { ACTIVITY_TYPES } from '@/constants/leads';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  // Verificar que el lead pertenece al equipo del setter
  const { data: lead } = await admin
    .from('team_leads')
    .select('team_id, current_status, source_lead_id')
    .eq('id', params.id)
    .single();

  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });

  const { data: team } = await admin
    .from('setter_teams')
    .select('setter1_id, setter2_id')
    .eq('id', lead.team_id)
    .single();

  const isAdmin = await admin.from('profiles').select('role').eq('id', user.id).single()
    .then((r: any) => r.data?.role === 'admin');

  const isMember = team?.setter1_id === user.id || team?.setter2_id === user.id;
  if (!isMember && !isAdmin) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.current_status !== undefined && body.current_status !== lead.current_status) {
    updates.current_status = body.current_status;
    updates.is_closed = body.current_status === 'NO_CALIFICA';

    const now = new Date().toISOString();

    // Actividad en team_lead_activities (historial del equipo)
    await admin.from('team_lead_activities').insert({
      team_lead_id:    params.id,
      user_id:         user.id,
      type:            ACTIVITY_TYPES.STATUS_CHANGE,
      previous_status: lead.current_status,
      new_status:      body.current_status,
    });

    // Sincronizar al lead fuente — una sola fuente de verdad para el admin
    if (lead.source_lead_id) {
      await Promise.all([
        admin.from('leads').update({
          current_status: body.current_status,
          last_action_at: now,
          updated_at:     now,
        }).eq('id', lead.source_lead_id),
        admin.from('lead_activities').insert({
          lead_id:         lead.source_lead_id,
          user_id:         user.id,
          type:            ACTIVITY_TYPES.STATUS_CHANGE,
          previous_status: lead.current_status,
          new_status:      body.current_status,
        }),
      ]);
    }
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes;
    await admin.from('team_lead_activities').insert({
      team_lead_id: params.id,
      user_id:      user.id,
      type:         ACTIVITY_TYPES.NOTE_ADDED,
      note:         body.notes,
    });
  }

  if (body.handled_by !== undefined) updates.handled_by = body.handled_by;

  const { data, error } = await admin
    .from('team_leads')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
