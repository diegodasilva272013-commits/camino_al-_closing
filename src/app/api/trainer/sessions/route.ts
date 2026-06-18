import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data, error } = await (admin as any)
      .from('trainer_sessions')
      .select('id, scenario_id, scenario_name, scenario_group, scenario_tag, difficulty, mode, started_at, ended_at, message_count, evaluations_count, last_evaluation, status')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { scenario_id, scenario_name, scenario_group, scenario_tag, difficulty, mode } = await req.json();

    const admin = createSupabaseAdminClient();
    const { data, error } = await (admin as any)
      .from('trainer_sessions')
      .insert({ user_id: user.id, scenario_id, scenario_name, scenario_group, scenario_tag, difficulty, mode, status: 'active' })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
