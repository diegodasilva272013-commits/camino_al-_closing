import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  const { data: team } = await admin
    .from('setter_teams')
    .select('id, name, avatar_url, setter1_id, setter2_id')
    .or(`setter1_id.eq.${user.id},setter2_id.eq.${user.id}`)
    .single();

  if (!team) return NextResponse.json({ team: null, leads: [] });

  const [leadsRes, profilesRes] = await Promise.all([
    admin.from('team_leads')
      .select('id, team_id, handled_by, current_status, notes, is_closed, source_lead_id, created_at, updated_at, lead:leads!source_lead_id(first_name, last_name, phone, email, country)')
      .eq('team_id', team.id)
      .order('updated_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, avatar_url').in('id', [team.setter1_id, team.setter2_id].filter(Boolean) as string[]),
  ]);

  // Aplanar datos de contacto (datos de contacto viven en leads, estado vive en team_leads)
  const leads = (leadsRes.data ?? []).map((tl: any) => ({
    id:             tl.id,
    team_id:        tl.team_id,
    source_lead_id: tl.source_lead_id,
    handled_by:     tl.handled_by,
    current_status: tl.current_status,
    notes:          tl.notes,
    is_closed:      tl.is_closed,
    created_at:     tl.created_at,
    updated_at:     tl.updated_at,
    first_name:     tl.lead?.first_name ?? '',
    last_name:      tl.lead?.last_name  ?? null,
    phone:          tl.lead?.phone      ?? '',
    email:          tl.lead?.email      ?? null,
    country:        tl.lead?.country    ?? null,
  }));

  return NextResponse.json({
    team,
    leads,
    members: profilesRes.data ?? [],
  });
}
