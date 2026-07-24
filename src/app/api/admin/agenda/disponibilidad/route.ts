import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/agenda/disponibilidad — disponibilidad de TODOS los closers
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  // Todos los closers
  const { data: closers } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('role', 'closer')
    .order('full_name');

  // Todas las franjas de todos los closers
  const { data: franjas, error } = await admin
    .from('closer_availability')
    .select('*')
    .order('dia_semana')
    .order('hora_inicio');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agrupar franjas por closer_id
  const franjasMap: Record<string, typeof franjas> = {};
  for (const f of franjas ?? []) {
    if (!franjasMap[f.closer_id]) franjasMap[f.closer_id] = [];
    franjasMap[f.closer_id].push(f);
  }

  const result = (closers ?? []).map((c: { id: string; full_name: string | null; avatar_url: string | null }) => ({
    closer: c,
    franjas: franjasMap[c.id] ?? [],
  }));

  return NextResponse.json(result);
}
