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
 * Opción A — evidencia ya existe en d2030_evidencias:
 *   Body: { evidencia_id: "uuid" }
 *
 * Opción B — crear evidencia + extraer en un solo paso:
 *   Body: {
 *     titulo:      string,
 *     tipo:        string,
 *     texto_crudo: string,
 *     contexto?:   string,
 *     fecha?:      string (YYYY-MM-DD),
 *     fuente?:     "manual" | "auto_sync"
 *   }
 *
 * Devuelve el JSON de comportamientos, mediciones y patrones extraídos.
 * Eso es la validación: si el JSON sale limpio, el pipeline funciona.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();

  let evidenciaId: string;

  if (body.evidencia_id) {
    // Opción A: ya existe
    evidenciaId = body.evidencia_id;
  } else {
    // Opción B: crear y luego extraer
    const { titulo, tipo, texto_crudo, contexto, fecha, fuente } = body;

    if (!titulo || !tipo || !texto_crudo?.trim()) {
      return NextResponse.json(
        { error: 'titulo, tipo y texto_crudo son requeridos' },
        { status: 400 }
      );
    }

    const { data: ev, error: evErr } = await (admin as any)
      .from('d2030_evidencias')
      .insert({
        titulo,
        tipo,
        texto_crudo,
        contexto: contexto ?? null,
        fecha:    fecha ?? new Date().toISOString().split('T')[0],
        fuente:   fuente ?? 'manual',
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
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
