import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/agenda/closers — lista de closers activos con disponibilidad
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  // Verificar que el caller es setter, closer o admin
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['setter', 'closer', 'admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  // Closers con al menos una franja activa
  const { data: closers, error } = await admin
    .from('profiles')
    .select(`
      id,
      full_name,
      avatar_url,
      email,
      closer_availability (
        id,
        dia_semana,
        hora_inicio,
        hora_fin,
        activa
      )
    `)
    .eq('role', 'closer')
    .order('full_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filtrar los que tienen al menos una franja activa
  const activos = (closers ?? []).filter(
    (c: any) => Array.isArray(c.closer_availability) && c.closer_availability.some((f: any) => f.activa)
  );

  return NextResponse.json(activos);
}
