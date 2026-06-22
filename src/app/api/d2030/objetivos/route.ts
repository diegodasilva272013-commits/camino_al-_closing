import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? admin : null;
}

async function getPerfilId(admin: any): Promise<string | null> {
  const { data } = await (admin as any).from('perfil').select('id').limit(1).single();
  return data?.id ?? null;
}

/**
 * GET /api/d2030/objetivos
 * Lista todos los objetivos de crecimiento del perfil, ordenados.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const perfilId = await getPerfilId(admin);
  if (!perfilId) return NextResponse.json({ error: 'Perfil no inicializado. Corré la migración 0029.' }, { status: 404 });

  const { data, error } = await (admin as any)
    .from('objetivo_crecimiento')
    .select('*')
    .eq('perfil_id', perfilId)
    .order('orden');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ objetivos: data ?? [] });
}

/**
 * POST /api/d2030/objetivos
 * Crea un nuevo objetivo de crecimiento.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const perfilId = await getPerfilId(admin);
  if (!perfilId) return NextResponse.json({ error: 'Perfil no inicializado' }, { status: 404 });

  const body = await req.json();
  const { nombre, nombre_display, definicion, meta_2030, criterios_evaluacion, peso_relativo, orden } = body;

  if (!nombre?.trim() || !nombre_display?.trim() || !definicion?.trim() || !meta_2030?.trim() || !criterios_evaluacion?.trim()) {
    return NextResponse.json({ error: 'nombre, nombre_display, definicion, meta_2030 y criterios_evaluacion son requeridos' }, { status: 400 });
  }

  const { data, error } = await (admin as any)
    .from('objetivo_crecimiento')
    .insert({
      perfil_id:           perfilId,
      nombre:              nombre.trim().toLowerCase().replace(/\s+/g, '_'),
      nombre_display:      nombre_display.trim(),
      definicion:          definicion.trim(),
      meta_2030:           meta_2030.trim(),
      criterios_evaluacion: criterios_evaluacion.trim(),
      peso_relativo:       peso_relativo ?? 1.0,
      orden:               orden ?? 99,
      activo:              true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ objetivo: data }, { status: 201 });
}
