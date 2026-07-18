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
      .select('id, team_id, current_status, notes, is_closed, handled_by, source_lead_id, created_at, updated_at, lead:leads!source_lead_id(first_name, last_name, phone, email, country)')
      .eq('team_id', params.id)
      .order('updated_at', { ascending: false }),
    memberIds.length > 0
      ? admin.from('profiles').select('id, full_name, avatar_url, points').in('id', memberIds)
      : { data: [] },
    admin.from('profiles').select('id, full_name').eq('role', 'setter'),
  ]);

  // Aplanar datos de contacto desde el JOIN a leads
  const leads = (leadsRes.data ?? []).map((tl: any) => ({
    id:             tl.id,
    team_id:        tl.team_id,
    source_lead_id: tl.source_lead_id,
    current_status: tl.current_status,
    notes:          tl.notes,
    is_closed:      tl.is_closed,
    handled_by:     tl.handled_by,
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

  // Campos propios del team_lead (estado del trabajo del equipo)
  const teamFields = ['current_status', 'notes', 'handled_by', 'is_closed'];
  // Campos de contacto que viven en leads (única fuente de verdad)
  const leadContactFields = ['first_name', 'last_name', 'phone'];

  const teamPatch: Record<string, any> = { updated_at: new Date().toISOString() };
  const leadPatch: Record<string, any> = {};
  for (const k of teamFields)        if (k in updates) teamPatch[k] = updates[k];
  for (const k of leadContactFields) if (k in updates) leadPatch[k] = updates[k];

  const { data, error } = await admin
    .from('team_leads')
    .update(teamPatch)
    .eq('id', lead_id)
    .eq('team_id', params.id)
    .select('*, lead:leads!source_lead_id(first_name, last_name, phone, email, country)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si hay ediciones de contacto, actualizar leads directamente
  if (Object.keys(leadPatch).length > 0 && data?.source_lead_id) {
    await admin.from('leads')
      .update({ ...leadPatch, updated_at: new Date().toISOString() })
      .eq('id', data.source_lead_id);
  }

  return NextResponse.json({
    ...data,
    first_name: data.lead?.first_name ?? '',
    last_name:  data.lead?.last_name  ?? null,
    phone:      data.lead?.phone      ?? '',
    email:      data.lead?.email      ?? null,
    country:    data.lead?.country    ?? null,
    lead:       undefined,
  });
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
