import { NextRequest, NextResponse } from 'next/server';
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
// Copia N leads sin asignar al pool del equipo, guarda source_lead_id para no duplicar
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { cantidad } = await req.json();
  const n = Number(cantidad);
  if (!n || n < 1 || n > 500) return NextResponse.json({ error: 'cantidad inválida' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;

  // Verificar equipo
  const { data: team } = await admin.from('setter_teams').select('id').eq('id', params.id).single();
  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

  // IDs ya en algún team_leads (para no duplicar)
  const { data: distributed } = await admin
    .from('team_leads')
    .select('source_lead_id')
    .not('source_lead_id', 'is', null);

  const usedIds: string[] = (distributed ?? []).map((r: any) => r.source_lead_id).filter(Boolean);

  // Tomar N leads sin asignar que no estén ya distribuidos
  let poolQ = admin
    .from('leads')
    .select('id, first_name, last_name, phone, email, country')
    .is('assigned_to_user_id', null)
    .limit(n);

  if (usedIds.length) poolQ = poolQ.not('id', 'in', `(${usedIds.join(',')})`);

  const { data: pool, error: poolErr } = await poolQ;
  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if (!pool?.length) return NextResponse.json({ error: 'No hay leads disponibles en el pool' }, { status: 400 });

  const rows = pool.map((l: any) => ({
    team_id:        params.id,
    first_name:     l.first_name ?? '',
    last_name:      l.last_name  ?? null,
    phone:          l.phone      ?? '',
    email:          l.email      ?? null,
    country:        l.country    ?? null,
    source_lead_id: l.id,
  }));

  const { data: inserted, error: insertErr } = await admin
    .from('team_leads')
    .insert(rows)
    .select('id');

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ inserted: inserted?.length ?? 0 });
}
