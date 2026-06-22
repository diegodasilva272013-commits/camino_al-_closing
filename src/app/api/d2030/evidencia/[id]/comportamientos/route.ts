import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? admin : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await (admin as any)
    .from('comportamiento')
    .select(`
      id, descripcion, cita, timestamp_inicio, timestamp_fin, speaker_contexto, fecha,
      comportamiento_capacidad(
        capacidad_id, valencia, peso,
        objetivo_crecimiento(nombre_display)
      )
    `)
    .eq('evidencia_id', params.id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comportamientos: data ?? [] });
}
