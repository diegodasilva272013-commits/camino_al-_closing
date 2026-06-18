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

  // All setter + admin profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['setter', 'admin'])
    .order('full_name', { ascending: true });

  const allProfiles: any[] = profiles ?? [];

  // All conversations (may fail if migration 0018 not yet run)
  let analyses: any[] = [];
  let reflections: any[] = [];
  try {
    const { data: an } = await (admin as any)
      .from('conversation_analyses')
      .select('id, user_id, status, analysis, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    analyses = an ?? [];

    const ids = analyses.map((a: any) => a.id);
    if (ids.length) {
      const { data: refs } = await (admin as any)
        .from('conversation_reflections')
        .select('analysis_id, status, xp_earned, evaluation, answers, created_at')
        .in('analysis_id', ids);
      reflections = refs ?? [];
    }
  } catch {
    // Table doesn't exist yet — return profiles with empty stats
  }

  // Build maps
  const reflMap = new Map<string, any>();
  for (const r of reflections) reflMap.set(r.analysis_id, r);

  const byUser = new Map<string, any[]>();
  for (const a of analyses) {
    const r = { ...a, reflection: reflMap.get(a.id) ?? null };
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id)!.push(r);
  }

  // Merge: all setters, even those with 0 conversations
  const rows = allProfiles.map((p: any) => ({
    user_id: p.id,
    profile: { full_name: p.full_name, email: p.email },
    conversations: byUser.get(p.id) ?? [],
  }));

  return NextResponse.json(rows);
}
