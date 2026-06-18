import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: leads } = await admin
    .from('leads')
    .select('assigned_to_user_id, current_status')
    .limit(50000);

  const all = leads ?? [];
  const total = all.length;

  // Count per assigned_to_user_id
  const byId = new Map<string, number>();
  let unassigned = 0;
  for (const l of all) {
    if (!l.assigned_to_user_id) { unassigned++; continue; }
    byId.set(l.assigned_to_user_id, (byId.get(l.assigned_to_user_id) ?? 0) + 1);
  }

  const ids = [...byId.keys()];
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', chunk);
    for (const p of profiles ?? []) profileMap.set(p.id, p);
  }

  const rows = ids
    .map((id) => ({
      id,
      full_name: profileMap.get(id)?.full_name ?? null,
      email: profileMap.get(id)?.email ?? null,
      has_profile: profileMap.has(id),
      lead_count: byId.get(id)!,
    }))
    .sort((a, b) => b.lead_count - a.lead_count);

  return NextResponse.json({ total, unassigned, assigned: total - unassigned, rows });
}
