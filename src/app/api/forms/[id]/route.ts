import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: form } = await (admin as any)
    .from('reinforcement_forms')
    .select('*, reinforcement_questions(*)')
    .eq('id', params.id)
    .single();

  if (!form) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  form.reinforcement_questions?.sort((a: any, b: any) => a.order_index - b.order_index);

  // Check if user already submitted
  const { data: existing } = await (admin as any)
    .from('reinforcement_submissions')
    .select('id, status, total_score, nivel_general, ai_risk, analysis')
    .eq('form_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  let existingAnswers: any[] = [];
  if (existing) {
    const { data: answers } = await (admin as any)
      .from('reinforcement_answers')
      .select('*')
      .eq('submission_id', existing.id);
    existingAnswers = answers ?? [];
  }

  return NextResponse.json({ ...form, submission: existing ?? null, answers: existingAnswers });
}
