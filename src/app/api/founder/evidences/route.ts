import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { MOTOR_CAC_CEO_SYSTEM, buildAnalysisPrompt } from '@/lib/motor-cac-ceo';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

// GET /api/founder/evidences — lista de evidencias con sus análisis
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const { data, error } = await (admin as any)
    .from('founder_evidences')
    .select(`
      id, title, type, context, duration_min, date_recorded,
      analysis_status, created_at,
      founder_analyses(id, capacities, patterns, exercises, created_at)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/founder/evidences — crear evidencia + analizar con Motor CAC CEO
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { title, type, content_text, context, duration_min, date_recorded } = body;

  if (!title || !type || !content_text?.trim()) {
    return NextResponse.json({ error: 'title, type y content_text son requeridos' }, { status: 400 });
  }

  // 1. Guardar evidencia
  const { data: evidence, error: evErr } = await (admin as any)
    .from('founder_evidences')
    .insert({ title, type, content_text, context, duration_min, date_recorded: date_recorded || new Date().toISOString().split('T')[0], analysis_status: 'analyzing' })
    .select('id')
    .single();

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  // 2. Analizar con Motor CAC CEO (o3)
  try {
    const completion = await (openai.chat.completions.create as any)({
      model:            'o3',
      reasoning_effort: 'high',
      messages: [
        { role: 'system', content: MOTOR_CAC_CEO_SYSTEM },
        { role: 'user',   content: buildAnalysisPrompt(content_text, type, context) },
      ],
    });

    const raw       = (completion.choices[0].message.content ?? '{}').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const analysis  = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    // 3. Guardar análisis
    await (admin as any).from('founder_analyses').insert({
      evidence_id: evidence.id,
      analysis:    analysis,
      capacities:  analysis.capacidades ?? {},
      patterns:    analysis.patrones_detectados ?? [],
      exercises:   analysis.intervencion_prioritaria ? [analysis.intervencion_prioritaria] : [],
    });

    // 4. Crear ejercicio automáticamente si hay intervención
    if (analysis.intervencion_prioritaria) {
      const inv = analysis.intervencion_prioritaria;
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + (inv.duracion_dias ?? 7));

      // Buscar el id del análisis recién creado
      const { data: analysisRow } = await (admin as any)
        .from('founder_analyses')
        .select('id')
        .eq('evidence_id', evidence.id)
        .single();

      await (admin as any).from('founder_exercises').insert({
        capacity:        inv.capacidad,
        title:           inv.titulo,
        description:     inv.descripcion,
        origin_analysis: analysisRow?.id,
        due_at:          dueAt.toISOString(),
        status:          'pending',
      });
    }

    // 5. Actualizar snapshot de capacidades
    await updateCapacitySnapshot(admin);

    // 6. Marcar evidencia como lista
    await (admin as any).from('founder_evidences')
      .update({ analysis_status: 'ready' })
      .eq('id', evidence.id);

    return NextResponse.json({ evidence_id: evidence.id, analysis });

  } catch (err: any) {
    await (admin as any).from('founder_evidences')
      .update({ analysis_status: 'error' })
      .eq('id', evidence.id);
    return NextResponse.json({ error: err.message ?? 'Error en análisis' }, { status: 500 });
  }
}

async function updateCapacitySnapshot(admin: any) {
  try {
    const { data: allAnalyses } = await admin
      .from('founder_analyses')
      .select('capacities');

    if (!allAnalyses?.length) return;

    const caps = ['claridad_ejecutiva','priorizacion','delegacion','seguimiento','comunicacion_ejecutiva','presencia'];
    const scores: Record<string, number> = {};

    for (const cap of caps) {
      const capScores = allAnalyses
        .map((a: any) => a.capacities?.[cap]?.score)
        .filter((s: any) => s != null && typeof s === 'number');
      if (capScores.length > 0) {
        scores[cap] = Math.round((capScores.reduce((a: number, b: number) => a + b, 0) / capScores.length) * 10) / 10;
      }
    }

    const avgDist = Object.values(scores).length > 0
      ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length * 10) / 10
      : null;

    const today = new Date().toISOString().split('T')[0];
    await admin.from('founder_capacity_snapshots').upsert({
      snapshot_date: today,
      scores,
      evidence_count: allAnalyses.length,
      avg_2030_dist: avgDist,
    }, { onConflict: 'snapshot_date' });
  } catch {}
}
