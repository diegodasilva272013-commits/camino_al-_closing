import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('trainer_brain')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { base_prompt: '', rules: '', mode_fria: '', mode_tibia: '', mode_caliente: '' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { base_prompt, rules, mode_fria, mode_tibia, mode_caliente } = body;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('trainer_brain')
      .upsert({ id: 1, base_prompt, rules, mode_fria, mode_tibia, mode_caliente });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
