import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: team } = await admin
    .from('setter_teams')
    .select('id, name, setter1_id, setter2_id')
    .or(`setter1_id.eq.${user.id},setter2_id.eq.${user.id}`)
    .single();

  if (!team) return NextResponse.json({ team: null, leads: [] });

  const [leadsRes, profilesRes] = await Promise.all([
    admin.from('team_leads').select('*').eq('team_id', team.id).order('updated_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, avatar_url').in('id', [team.setter1_id, team.setter2_id].filter(Boolean) as string[]),
  ]);

  return NextResponse.json({
    team,
    leads: leadsRes.data ?? [],
    members: profilesRes.data ?? [],
  });
}
