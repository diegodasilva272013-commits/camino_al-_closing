import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function getTeamForUser(userId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from('setter_teams')
    .select('id, setter1_id, setter2_id')
    .or(`setter1_id.eq.${userId},setter2_id.eq.${userId}`)
    .single();
  return data;
}

// PATCH /api/equipo/settings { name?, avatar_url? }
export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const team = await getTeamForUser(user.id);
  if (!team) return NextResponse.json({ error: 'No estás en ningún equipo' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from('setter_teams')
    .update(updates)
    .eq('id', team.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
