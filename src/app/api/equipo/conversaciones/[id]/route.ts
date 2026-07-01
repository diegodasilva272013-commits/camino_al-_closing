import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  const { data: ca } = await admin
    .from('team_conversation_analyses')
    .select('id, team_id, submitted_by, raw_text, analysis, status, created_at')
    .eq('id', params.id)
    .single();

  if (!ca) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Verificar que es miembro del equipo
  const { data: team } = await admin
    .from('setter_teams')
    .select('id')
    .eq('id', ca.team_id)
    .or(`setter1_id.eq.${user.id},setter2_id.eq.${user.id}`)
    .single();

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!team && profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { data: reflection } = await admin
    .from('team_conversation_reflections')
    .select('*')
    .eq('analysis_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ ...ca, my_reflection: reflection ?? null });
}
