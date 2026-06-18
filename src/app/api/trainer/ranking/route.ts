import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function xpForSession(difficulty: number, evaluations: number, messages: number): number {
  let pts = difficulty * 5;               // base: dif 1=5, dif 10=50
  if (evaluations > 0) pts += 5;          // pidió feedback
  if (messages >= 8)   pts += 5;          // sesión completa
  return pts;
}

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86_400_000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { data: sessions } = await (admin as any)
      .from('trainer_sessions')
      .select('user_id, difficulty, evaluations_count, message_count, started_at, scenario_group')
      .gte('status', 'active') // all statuses
      .limit(10000);

    const all: any[] = sessions ?? [];

    // Group by user
    const byUser = new Map<string, any[]>();
    for (const s of all) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }

    // Fetch profiles
    const userIds = [...byUser.keys()];
    const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    for (let i = 0; i < userIds.length; i += 500) {
      const chunk = userIds.slice(i, i + 500);
      const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', chunk);
      for (const p of profiles ?? []) profileMap.set(p.id, p);
    }

    const rows = userIds.map((uid) => {
      const userSessions = byUser.get(uid)!;
      const totalXP      = userSessions.reduce((s, r) => s + xpForSession(r.difficulty, r.evaluations_count, r.message_count), 0);
      const weekSessions = userSessions.filter((r) => r.started_at >= weekAgo);
      const weekXP       = weekSessions.reduce((s, r) => s + xpForSession(r.difficulty, r.evaluations_count, r.message_count), 0);
      const dates        = userSessions.map((r) => (r.started_at as string).slice(0, 10));
      const streak       = computeStreak(dates);
      const maxDiff      = Math.max(...userSessions.map((r) => r.difficulty));
      const p            = profileMap.get(uid);
      const groups: Record<string, number> = { FRÍA: 0, TIBIA: 0, CALIENTE: 0 };
      for (const r of userSessions) if (r.scenario_group in groups) groups[r.scenario_group]++;

      return {
        user_id:         uid,
        name:            p?.full_name ?? p?.email ?? 'Anónimo',
        total_sessions:  userSessions.length,
        total_xp:        totalXP,
        week_sessions:   weekSessions.length,
        week_xp:         weekXP,
        streak,
        max_difficulty:  maxDiff,
        groups,
        is_me:           uid === user.id,
      };
    });

    // Sort by week_xp desc, then total_xp
    rows.sort((a, b) => b.week_xp - a.week_xp || b.total_xp - a.total_xp);

    const weekly_winner = rows.find((r) => r.week_sessions > 0) ?? null;

    return NextResponse.json({ rows, weekly_winner });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
