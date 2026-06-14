import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { ACTIVITY_TYPES } from '@/constants/leads';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const body = await req.json();

    // Get current lead state for activity logging
    const { data: current } = await admin
      .from('leads')
      .select('current_status, assigned_to_user_id')
      .eq('id', params.id)
      .single();

    if (!current) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });

    const isAdmin = user.id !== current.assigned_to_user_id;
    if (!isAdmin) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin' && current.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const activityType: string[] = [];

    if (body.current_status !== undefined && body.current_status !== current.current_status) {
      updates.current_status = body.current_status;
      updates.last_action_at = new Date().toISOString();
      activityType.push(ACTIVITY_TYPES.STATUS_CHANGE);

      await admin.from('lead_activities').insert({
        lead_id: params.id,
        user_id: user.id,
        type: ACTIVITY_TYPES.STATUS_CHANGE,
        previous_status: current.current_status,
        new_status: body.current_status,
      });
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
      await admin.from('lead_activities').insert({
        lead_id: params.id,
        user_id: user.id,
        type: ACTIVITY_TYPES.NOTE_ADDED,
        note: body.notes,
      });
    }

    if (body.opening_message_used !== undefined) {
      updates.opening_message_used = body.opening_message_used;
      await admin.from('lead_activities').insert({
        lead_id: params.id,
        user_id: user.id,
        type: ACTIVITY_TYPES.OPENING_SET,
        note: body.opening_message_used,
      });
    }

    if (body.next_follow_up_at !== undefined) {
      updates.next_follow_up_at = body.next_follow_up_at;
    }

    if (body.is_closed !== undefined) {
      updates.is_closed = body.is_closed;
      updates.closed_reason = body.closed_reason ?? null;
      await admin.from('lead_activities').insert({
        lead_id: params.id,
        user_id: user.id,
        type: ACTIVITY_TYPES.CLOSED,
        note: body.closed_reason ?? 'Cerrado',
      });
    }

    const { data, error } = await admin
      .from('leads')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
