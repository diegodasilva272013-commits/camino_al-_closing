import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: forms } = await (admin as any)
    .from('reinforcement_forms')
    .select('id, title, description, topic, created_at, reinforcement_questions(count)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Check which ones the user already submitted
  const formIds = (forms ?? []).map((f: any) => f.id);
  let submittedSet = new Set<string>();
  if (formIds.length) {
    const { data: subs } = await (admin as any)
      .from('reinforcement_submissions')
      .select('form_id, status, total_score, nivel_general')
      .eq('user_id', user.id)
      .in('form_id', formIds);
    for (const s of subs ?? []) submittedSet.add(s.form_id);
  }

  const result = (forms ?? []).map((f: any) => ({
    ...f,
    question_count: f.reinforcement_questions?.[0]?.count ?? 0,
    submitted: submittedSet.has(f.id),
  }));

  return NextResponse.json(result);
}
