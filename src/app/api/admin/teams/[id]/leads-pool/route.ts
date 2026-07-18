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
// Asigna N leads del pool al equipo. Los datos de contacto viven en leads —
// team_leads solo guarda el vínculo (source_lead_id) y el estado propio.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { cantidad } = await req.json();
  const n = Number(cantidad);
  if (!n || n < 1 || n > 500) return NextResponse.json({ error: 'cantidad inválida' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;

  const { data: team } = await admin.from('setter_teams').select('id').eq('id', params.id).single();
  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

  // Obtener leads disponibles usando la función SQL (NOT EXISTS, sin IN grande)
  const { data: pool, error: poolErr } = await admin
    .rpc('leads_sin_asignar', { p_limit: n });

  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if (!pool?.length) return NextResponse.json({ error: 'No hay leads disponibles en el pool' }, { status: 400 });

  // Solo guardamos el vínculo. Datos de contacto → leer via JOIN a leads.
  const rows = pool.map((l: any) => ({
    team_id:        params.id,
    source_lead_id: l.id,
  }));

  const { data: inserted, error: insertErr } = await admin
    .from('team_leads')
    .insert(rows)
    .select('id');

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ inserted: inserted?.length ?? 0 });
}
