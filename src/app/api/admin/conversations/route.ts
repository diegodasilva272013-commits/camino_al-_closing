import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: myProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((myProfile as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: analyses } = await (admin as any)
    .from('conversation_analyses')
    .select('id, user_id, status, analysis, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const all: any[] = analyses ?? [];

  // Fetch all reflections
  const ids = all.map((a: any) => a.id);
  let reflMap = new Map<string, any>();
  if (ids.length) {
    const { data: refs } = await (admin as any)
      .from('conversation_reflections')
      .select('analysis_id, status, xp_earned, evaluation, answers, created_at')
      .in('analysis_id', ids);
    for (const r of refs ?? []) reflMap.set(r.analysis_id, r);
  }

  // Fetch profiles
  const userIds = [...new Set(all.map((a: any) => a.user_id as string))];
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);
    const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', chunk);
    for (const p of profiles ?? []) profileMap.set(p.id, p);
  }

  const rows = all.map((a: any) => ({
    ...a,
    profile: profileMap.get(a.user_id) ?? null,
    reflection: reflMap.get(a.id) ?? null,
  }));

  return NextResponse.json(rows);
}
