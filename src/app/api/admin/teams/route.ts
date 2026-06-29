import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: teams } = await admin
    .from('setter_teams')
    .select('id, name, setter1_id, setter2_id, created_at')
    .order('created_at', { ascending: false });

  if (!teams?.length) return NextResponse.json([]);

  const setterIds = [...new Set(teams.flatMap(t => [t.setter1_id, t.setter2_id].filter(Boolean)))] as string[];
  const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', setterIds);
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]));

  const { data: counts } = await admin.from('team_leads').select('team_id');
  const countMap = new Map<string, number>();
  for (const l of counts ?? []) countMap.set(l.team_id, (countMap.get(l.team_id) ?? 0) + 1);

  return NextResponse.json(teams.map(t => ({
    ...t,
    setter1_name: profileMap.get(t.setter1_id ?? '') ?? null,
    setter2_name: profileMap.get(t.setter2_id ?? '') ?? null,
    lead_count: countMap.get(t.id) ?? 0,
  })));
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { name, setter1_id, setter2_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('setter_teams')
    .insert({ name: name.trim(), setter1_id: setter1_id || null, setter2_id: setter2_id || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
