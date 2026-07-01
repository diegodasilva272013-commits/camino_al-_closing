import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((data as any)?.role !== 'admin') return null;
  return user;
}

// GET — vista completa del equipo para admin
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;

  const { data: team } = await admin
    .from('setter_teams')
    .select('id, name, avatar_url, setter1_id, setter2_id, created_at')
    .eq('id', params.id)
    .single();

  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

  const memberIds = [team.setter1_id, team.setter2_id].filter(Boolean) as string[];

  const [leadsRes, membersRes, allSettersRes] = await Promise.all([
    admin.from('team_leads')
      .select('id, team_id, first_name, last_name, phone, email, country, current_status, notes, is_closed, handled_by, source_lead_id, created_at, updated_at')
      .eq('team_id', params.id)
      .order('updated_at', { ascending: false }),
    memberIds.length > 0
      ? admin.from('profiles').select('id, full_name, avatar_url, points').in('id', memberIds)
      : { data: [] },
    admin.from('profiles').select('id, full_name').eq('role', 'setter'),
  ]);

  return NextResponse.json({
    team,
    leads:      leadsRes.data      ?? [],
    members:    membersRes.data    ?? [],
    allSetters: allSettersRes.data ?? [],
  });
}

// PATCH — actualizar un team_lead desde admin
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;
  const body  = await req.json();
  const { lead_id, ...updates } = body;

  if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 });

  const allowed = ['current_status','notes','handled_by','is_closed','first_name','last_name','phone'];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in updates) patch[k] = updates[k];

  const { data, error } = await admin.from('team_leads').update(patch).eq('id', lead_id).eq('team_id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// PUT — actualizar configuración del equipo (nombre, avatar, miembros)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;
  const body  = await req.json();

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if ('name'       in body) patch.name       = body.name;
  if ('avatar_url' in body) patch.avatar_url = body.avatar_url;
  if ('setter1_id' in body) patch.setter1_id = body.setter1_id || null;
  if ('setter2_id' in body) patch.setter2_id = body.setter2_id || null;

  const { data, error } = await admin.from('setter_teams').update(patch).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
