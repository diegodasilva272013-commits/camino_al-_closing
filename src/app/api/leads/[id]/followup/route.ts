import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { ACTIVITY_TYPES } from '@/constants/leads';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: lead } = await admin
      .from('leads')
      .select('follow_up_count, max_follow_ups')
      .eq('id', params.id)
      .single();

    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    if (lead.follow_up_count >= lead.max_follow_ups) {
      return NextResponse.json({ error: 'Seguimiento máximo alcanzado' }, { status: 400 });
    }

    const newCount = lead.follow_up_count + 1;
    const { data, error } = await admin
      .from('leads')
      .update({
        follow_up_count: newCount,
        last_action_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('lead_activities').insert({
      lead_id: params.id,
      user_id: user.id,
      type: ACTIVITY_TYPES.FOLLOWUP,
      note: `Seguimiento #${newCount}`,
    });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
