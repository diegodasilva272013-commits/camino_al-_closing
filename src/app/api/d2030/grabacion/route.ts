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

/**
 * POST /api/d2030/grabacion
 * Crea el registro en la base ANTES de comprimir/subir.
 * El estado arranca en 'comprimiendo' y avanza conforme el browser procesa.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: perfil } = await (admin as any).from('perfil').select('id').limit(1).single();
  if (!perfil?.id) return NextResponse.json({ error: 'Perfil no inicializado' }, { status: 404 });

  const body = await req.json();
  const { tipo, titulo, fecha, participantes, archivo_original_nombre, archivo_original_tamano } = body;

  if (!tipo) return NextResponse.json({ error: 'tipo es requerido' }, { status: 400 });

  const { data, error } = await (admin as any)
    .from('grabacion')
    .insert({
      perfil_id:               perfil.id,
      tipo,
      titulo:                  titulo?.trim() || `${tipo} — ${fecha || new Date().toISOString().split('T')[0]}`,
      fecha:                   fecha || new Date().toISOString().split('T')[0],
      participantes:           participantes || null,
      archivo_original_nombre: archivo_original_nombre || null,
      archivo_original_tamano: archivo_original_tamano || null,
      estado:                  'comprimiendo',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
