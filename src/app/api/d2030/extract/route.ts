import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { runExtractionPipeline } from '@/lib/d2030-pipeline';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

/**
 * POST /api/d2030/extract
 *
 * Opción A — evidencia ya existe:
 *   { evidencia_id: "uuid" }
 *
 * Opción B — crear evidencia + extraer en un paso:
 *   { titulo, tipo, texto_crudo, fecha?, fuente? }
 *   (texto_crudo se guarda como `texto` en la tabla evidencia)
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();

  // Obtener perfil_id
  const { data: perfil } = await (admin as any).from('perfil').select('id').limit(1).single();
  if (!perfil?.id) return NextResponse.json({ error: 'Perfil no inicializado. Corré la migración 0029.' }, { status: 404 });

  let evidenciaId: string;

  if (body.evidencia_id) {
    evidenciaId = body.evidencia_id;
  } else {
    const { titulo, tipo, texto_crudo, fecha } = body;

    if (!tipo || !texto_crudo?.trim()) {
      return NextResponse.json({ error: 'tipo y texto_crudo son requeridos' }, { status: 400 });
    }

    const { data: ev, error: evErr } = await (admin as any)
      .from('evidencia')
      .insert({
        perfil_id: perfil.id,
        tipo,
        texto:     texto_crudo,
        fecha:     fecha ?? new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (evErr || !ev?.id) {
      return NextResponse.json({ error: evErr?.message ?? 'Error al crear evidencia' }, { status: 500 });
    }

    evidenciaId = ev.id;
  }

  const result = await runExtractionPipeline(evidenciaId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, raw_llm: result.raw_llm }, { status: 500 });
  }

  return NextResponse.json(result);
}
