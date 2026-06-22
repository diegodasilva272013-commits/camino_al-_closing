import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import OpenAI from 'openai';
import { runExtractionPipeline } from '@/lib/d2030-pipeline';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? admin : null;
}

/**
 * POST /api/d2030/grabacion/[id]/procesar
 *
 * 1. Descarga el video de Supabase Storage
 * 2. Transcribe con OpenAI Whisper (o Groq si GROQ_API_KEY está configurado)
 * 3. Guarda transcripcion
 * 4. Crea evidencia con el texto
 * 5. Corre el pipeline de extracción
 * 6. Marca la grabación como 'completada'
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: grabacion, error: grabErr } = await (admin as any)
    .from('grabacion')
    .select('*')
    .eq('id', params.id)
    .single();

  if (grabErr || !grabacion) return NextResponse.json({ error: 'Grabación no encontrada' }, { status: 404 });
  if (!grabacion.storage_path)  return NextResponse.json({ error: 'El video no fue subido aún' }, { status: 400 });

  try {
    // ── 1. Actualizar estado ───────────────────────────────────────────────────
    await (admin as any).from('grabacion').update({
      estado: 'transcribiendo', updated_at: new Date().toISOString()
    }).eq('id', params.id);

    // ── 2. Descargar video de Supabase Storage ─────────────────────────────────
    const { data: fileData, error: dlErr } = await (admin as any)
      .storage
      .from('grabaciones')
      .download(grabacion.storage_path);

    if (dlErr || !fileData) throw new Error(`Error al descargar video: ${dlErr?.message}`);

    const videoBuffer = await fileData.arrayBuffer();
    const videoBlob   = new Blob([videoBuffer], { type: 'video/mp4' });

    // ── 3. Transcribir ────────────────────────────────────────────────────────
    let transcripcionData: any;

    if (process.env.GROQ_API_KEY) {
      // Groq Whisper (GRATIS, procesa 1h de audio en ~10 seg)
      const formData = new FormData();
      formData.append('file', videoBlob, 'video.mp4');
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'es');

      const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body:    formData,
      });
      if (!resp.ok) throw new Error(`Groq error: ${await resp.text()}`);
      transcripcionData = await resp.json();
    } else {
      // OpenAI Whisper (ya tenemos la key — fallback siempre disponible)
      const file = new File([videoBlob], 'video.mp4', { type: 'video/mp4' });
      const resp = await openai.audio.transcriptions.create({
        file,
        model:           'whisper-1',
        language:        'es',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      } as any);
      transcripcionData = resp;
    }

    const textoCompleto: string = transcripcionData.text ?? '';
    const segmentos:     any[]  = transcripcionData.segments ?? [];

    if (!textoCompleto.trim()) throw new Error('Whisper devolvió texto vacío');

    // ── 4. Guardar transcripcion ───────────────────────────────────────────────
    await (admin as any).from('transcripcion').insert({
      grabacion_id:  params.id,
      texto_completo: textoCompleto,
      segmentos,
      modelo_usado:  process.env.GROQ_API_KEY ? 'whisper-large-v3-groq' : 'whisper-1-openai',
    });

    // ── 5. Crear evidencia ─────────────────────────────────────────────────────
    await (admin as any).from('grabacion').update({
      estado: 'analizando', updated_at: new Date().toISOString()
    }).eq('id', params.id);

    const { data: ev, error: evErr } = await (admin as any)
      .from('evidencia')
      .insert({
        perfil_id:    grabacion.perfil_id,
        grabacion_fk: params.id,
        tipo:         grabacion.tipo,
        texto:        textoCompleto,
        fecha:        grabacion.fecha,
        estado:       'pendiente',
      })
      .select('id')
      .single();

    if (evErr || !ev?.id) throw new Error(`Error al crear evidencia: ${evErr?.message}`);

    // Vincular evidencia a grabacion
    await (admin as any).from('grabacion').update({
      evidencia_id: ev.id,
      updated_at:   new Date().toISOString(),
    }).eq('id', params.id);

    // ── 6. Pipeline de extracción ──────────────────────────────────────────────
    const result = await runExtractionPipeline(ev.id);

    if (!result.ok) throw new Error(`Pipeline falló: ${result.error}`);

    // ── 7. Completar ───────────────────────────────────────────────────────────
    await (admin as any).from('grabacion').update({
      estado:     'completada',
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);

    return NextResponse.json({
      ok:               true,
      evidencia_id:     ev.id,
      comportamientos:  result.comportamientos_count,
      mediciones:       result.mediciones_count,
    });

  } catch (err: any) {
    await (admin as any).from('grabacion').update({
      estado:        'error',
      error_detalle: err.message ?? String(err),
      updated_at:    new Date().toISOString(),
    }).eq('id', params.id);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
