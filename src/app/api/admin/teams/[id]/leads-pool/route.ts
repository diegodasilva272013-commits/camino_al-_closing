import { NextRequest, NextResponse } from 'next/server';
// POST: importa N leads sin asignar al pool del equipo
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

// POST /api/admin/teams/[id]/leads-pool { cantidad: 50|100|200 }
// Copia N leads sin asignar al pool team_leads del equipo
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { cantidad } = await req.json();
  const n = Number(cantidad);
  if (!n || n < 1 || n > 500) return NextResponse.json({ error: 'cantidad debe ser 50, 100 ó 200' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;

  // Verificar equipo
  const { data: team } = await admin.from('setter_teams').select('id').eq('id', params.id).single();
  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

  // Tomar N leads sin asignar
  const { data: pool, error: poolErr } = await admin
    .from('leads')
    .select('first_name, last_name, phone, email, country')
    .is('assigned_to_user_id', null)
    .limit(n);

  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if (!pool?.length) return NextResponse.json({ error: 'No hay leads sin asignar disponibles' }, { status: 400 });

  const rows = pool.map((l: any) => ({
    team_id:    params.id,
    first_name: l.first_name ?? '',
    last_name:  l.last_name  ?? null,
    phone:      l.phone      ?? '',
    email:      l.email      ?? null,
    country:    l.country    ?? null,
  }));

  const { data: inserted, error: insertErr } = await admin
    .from('team_leads')
    .insert(rows)
    .select('id');

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ inserted: inserted?.length ?? 0 });
}
