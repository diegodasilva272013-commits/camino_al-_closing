import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { MOTOR_CAC_CEO_SYSTEM } from '@/lib/motor-cac-ceo';
import { loadMemory, buildMemoryContext, updatePatterns, updateBehaviors } from '@/lib/founder-memory';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

// Convierte un team_diagnostic en texto de evidencia de liderazgo de Diego
function buildLeadershipText(diagnosis: any, meta: any): string {
  const d = diagnosis ?? {};
  return [
    `DIAGNÓSTICO DE EQUIPO — ${meta?.date ?? 'sin fecha'}`,
    `FUENTE: Sistema automático CAC`,
    '',
    `ESTADO ACTUAL DEL EQUIPO:`,
    d.estado_actual ?? 'Sin datos',
    '',
    `FORTALEZAS (qué enseñó Diego correctamente):`,
    ...(d.fortalezas ?? []).map((f: string) => `- ${f}`),
    '',
    `PUNTOS CRÍTICOS (qué no logró transferir aún):`,
    ...(d.puntos_criticos ?? []).map((p: any) =>
      `- PROBLEMA: ${p.problema}\n  EVIDENCIA: ${p.evidencia}\n  IMPACTO: ${p.impacto}\n  ACCIÓN DECIDIDA: ${p.accion}`
    ),
    '',
    `PATRÓN DOMINANTE DEL EQUIPO:`,
    d.patron_del_equipo ?? 'Sin datos',
    '',
    `DECISIÓN DE PRIORIDAD TOMADA POR DIEGO:`,
    d.proxima_prioridad ?? 'Sin datos',
    '',
    `MÉTRICAS DEL EQUIPO:`,
    `- Setters activos: ${meta?.setters ?? '?'}`,
    `- Conversaciones analizadas: ${meta?.conversations ?? '?'}`,
    `- Sesiones de trainer: ${meta?.trainer_sessions ?? '?'}`,
    `- Leads totales: ${meta?.leads ?? '?'}`,
    '',
    `NOTA PARA EL ANÁLISIS:`,
    `Este diagnóstico refleja el estado del equipo que Diego lidera y enseña.`,
    `Los puntos críticos del equipo = lo que Diego aún no logró delegar o comunicar con claridad.`,
    `Las fortalezas del equipo = lo que Diego transfirió bien.`,
    `Su decisión de prioridad = evidencia directa de Claridad Ejecutiva y Priorización.`,
  ].join('\n');
}

// Analiza evidencia de liderazgo con gpt-4o (rápido, <15s por llamada)
async function analyzeLeadershipEvidence(contentText: string, memoryCtx: string) {
  const userPrompt = [
    memoryCtx,
    '',
    `Analizá esta evidencia de liderazgo de Diego:`,
    '',
    `TIPO: reunion_equipo`,
    `CONTEXTO: Diagnóstico automático generado por el sistema CAC sobre el estado del equipo.`,
    `Analizá cómo los resultados del equipo reflejan las 6 capacidades de DIEGO como líder y fundador.`,
    '',
    `═══════════════════════════════════`,
    contentText.slice(0, 8000),
    `═══════════════════════════════════`,
    '',
    `Devolvé ÚNICAMENTE este JSON (sin texto antes ni después):`,
    `{
  "capacidades": {
    "claridad_ejecutiva":     { "score": null, "nivel": "sin_datos", "observacion": "...", "comportamientos_positivos": [], "comportamientos_negativos": [] },
    "priorizacion":           { "score": null, "nivel": "sin_datos", "observacion": "...", "comportamientos_positivos": [], "comportamientos_negativos": [] },
    "delegacion":             { "score": null, "nivel": "sin_datos", "observacion": "...", "comportamientos_positivos": [], "comportamientos_negativos": [] },
    "seguimiento":            { "score": null, "nivel": "sin_datos", "observacion": "...", "comportamientos_positivos": [], "comportamientos_negativos": [] },
    "comunicacion_ejecutiva": { "score": null, "nivel": "sin_datos", "observacion": "...", "comportamientos_positivos": [], "comportamientos_negativos": [] },
    "presencia":              { "score": null, "nivel": "sin_datos", "observacion": "...", "comportamientos_positivos": [], "comportamientos_negativos": [] }
  },
  "patrones_detectados": [
    { "patron": "Nombre corto", "capacidad": "clave", "tipo": "positivo|negativo", "descripcion": "..." }
  ],
  "fortalezas": [],
  "limitaciones": [],
  "feedback_general": "...",
  "intervencion_prioritaria": {
    "capacidad": "clave",
    "titulo": "Nombre del ejercicio",
    "descripcion": "Qué hacer exactamente.",
    "criterio_validacion": "Cómo sabe Diego que lo aprobó.",
    "duracion_dias": 7
  },
  "prediccion": "..."
}`,
  ].filter(Boolean).join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: MOTOR_CAC_CEO_SYSTEM },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 2000,
  });

  const raw       = (completion.choices[0].message.content ?? '{}').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
}

async function updateCapacitySnapshot(admin: any) {
  try {
    const { data: all } = await admin.from('founder_analyses').select('capacities');
    if (!all?.length) return;
    const caps = ['claridad_ejecutiva','priorizacion','delegacion','seguimiento','comunicacion_ejecutiva','presencia'];
    const scores: Record<string, number> = {};
    for (const cap of caps) {
      const arr = all.map((a: any) => a.capacities?.[cap]?.score).filter((s: any) => s != null && typeof s === 'number');
      if (arr.length) scores[cap] = Math.round(arr.reduce((a: number, b: number) => a + b, 0) / arr.length * 10) / 10;
    }
    const avg = Object.values(scores).length
      ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length * 10) / 10
      : null;
    await admin.from('founder_capacity_snapshots').upsert({
      snapshot_date: new Date().toISOString().split('T')[0],
      scores, evidence_count: all.length, avg_2030_dist: avg,
    }, { onConflict: 'snapshot_date' });
  } catch {}
}

// POST /api/founder/sync — auto-sincroniza desde team_diagnostics
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // 1. Obtener team_diagnostics disponibles
  const { data: diagnostics, error: diagErr } = await (admin as any)
    .from('team_diagnostics')
    .select('id, diagnosis, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (diagErr) return NextResponse.json({ error: diagErr.message }, { status: 500 });
  if (!diagnostics?.length) {
    return NextResponse.json({ synced: 0, message: 'No hay diagnósticos de equipo aún. El cron corre diariamente a las 8 AM UTC.' });
  }

  // 2. Verificar cuáles ya fueron procesados (por title)
  const { data: existingEvs } = await (admin as any)
    .from('founder_evidences')
    .select('title');
  const existingTitles = new Set((existingEvs ?? []).map((e: any) => e.title as string));

  // 3. Filtrar los no procesados
  const toProcess = diagnostics.filter((d: any) => {
    const date = (d.meta as any)?.date ?? (d.created_at as string)?.split('T')[0];
    return !existingTitles.has(`Diagnóstico de equipo — ${date}`);
  });

  if (!toProcess.length) {
    return NextResponse.json({ synced: 0, already_synced: diagnostics.length, message: 'Todo sincronizado' });
  }

  // 4. Procesar hasta 3 diagnósticos por llamada (para no exceder timeout)
  const batch = toProcess.slice(0, 3);
  let synced = 0;
  const errors: string[] = [];

  // Cargar memoria UNA VEZ para todo el batch
  const memory    = await loadMemory(admin);
  const memoryCtx = buildMemoryContext(memory);

  for (const diag of batch) {
    try {
      const date        = (diag.meta as any)?.date ?? (diag.created_at as string)?.split('T')[0];
      const title       = `Diagnóstico de equipo — ${date}`;
      const contentText = buildLeadershipText(diag.diagnosis, diag.meta);

      // Crear evidencia
      const { data: evidence } = await (admin as any)
        .from('founder_evidences')
        .insert({
          title,
          type:            'reunion_equipo',
          content_text:    contentText,
          date_recorded:   date,
          analysis_status: 'analyzing',
          context:         'Evidencia auto-sincronizada del diagnóstico diario del equipo',
        })
        .select('id')
        .single();

      if (!evidence?.id) continue;

      // Analizar con gpt-4o (rápido)
      const analysis = await analyzeLeadershipEvidence(contentText, memoryCtx);

      // Guardar análisis
      const { data: analysisRow } = await (admin as any).from('founder_analyses').insert({
        evidence_id: evidence.id,
        analysis,
        capacities:  analysis.capacidades ?? {},
        patterns:    analysis.patrones_detectados ?? [],
        exercises:   analysis.intervencion_prioritaria ? [analysis.intervencion_prioritaria] : [],
      }).select('id').single();

      // Actualizar memoria (patrones + comportamientos)
      await Promise.all([
        updatePatterns(admin, evidence.id, analysis.patrones_detectados ?? []),
        updateBehaviors(admin, analysis.capacidades ?? {}),
      ]);

      // Crear ejercicio si hay intervención
      if (analysis.intervencion_prioritaria) {
        const inv    = analysis.intervencion_prioritaria;
        const dueAt  = new Date();
        dueAt.setDate(dueAt.getDate() + (inv.duracion_dias ?? 7));
        await (admin as any).from('founder_exercises').insert({
          capacity: inv.capacidad, title: inv.titulo, description: inv.descripcion,
          origin_analysis: analysisRow?.id, due_at: dueAt.toISOString(), status: 'pending',
        });
      }

      // Marcar evidencia como lista
      await (admin as any).from('founder_evidences').update({ analysis_status: 'ready' }).eq('id', evidence.id);

      synced++;
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  // Actualizar snapshot después del batch
  if (synced > 0) await updateCapacitySnapshot(admin);

  return NextResponse.json({
    synced,
    pending: toProcess.length - batch.length,
    message: synced > 0
      ? `${synced} diagnóstico${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}. ${toProcess.length - batch.length > 0 ? `${toProcess.length - batch.length} pendiente(s).` : ''}`
      : 'Sin cambios',
    errors: errors.length ? errors : undefined,
  });
}
