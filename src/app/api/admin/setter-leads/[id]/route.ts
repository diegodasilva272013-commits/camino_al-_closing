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

// GET — todos los leads personales de un setter (para el kanban admin)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;

  // PostgREST limita a 1000 filas por default — paginamos para traer TODOS los leads del setter.
  let allLeads: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await admin.from('leads')
      .select('id, first_name, last_name, phone, email, country, current_status, notes, is_closed, updated_at, created_at, assigned_to_user_id')
      .eq('assigned_to_user_id', params.id)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    allLeads.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const { data: profile } = await admin.from('profiles').select('id, full_name, email, role, points, created_at').eq('id', params.id).single();

  return NextResponse.json({
    profile: profile ?? null,
    leads:   allLeads,
  });
}

// PUT — actualizar perfil del setter (nombre, puntos)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;
  const body  = await req.json();
  const patch: Record<string, any> = {};
  if ('full_name' in body) patch.full_name = body.full_name;
  if ('points'    in body) patch.points    = Math.max(0, parseInt(body.points) || 0);

  const { data, error } = await admin.from('profiles').update(patch).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// PATCH — actualizar un lead personal desde admin
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;
  const body  = await req.json();
  const { lead_id, ...updates } = body;

  if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 });

  const allowed = ['current_status','notes','is_closed','first_name','last_name','phone'];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in updates) patch[k] = updates[k];

  const { data, error } = await admin.from('leads').update(patch).eq('id', lead_id).eq('assigned_to_user_id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
