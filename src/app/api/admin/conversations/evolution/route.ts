import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CAP_MAP: Record<string, string> = {
  intencion: 'Intención', rapport: 'Rapport', empatia_profesional: 'Empatía profesional',
  diagnostico: 'Diagnóstico', generacion_interes: 'Generación de interés',
  seguimiento: 'Seguimiento', profesionalismo: 'Profesionalismo', criterio: 'Criterio',
};

function capScore(level: string): number | null {
  if (level === 'alta')  return 3;
  if (level === 'media') return 2;
  if (level === 'baja')  return 1;
  return null; // no_mostrada
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: myProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((myProfile as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 });

  // Load all approved reflections with their analyses
  const { data: analyses } = await (admin as any)
    .from('conversation_analyses')
    .select('id, analysis, created_at')
    .eq('user_id', userId)
    .eq('status', 'ready')
    .order('created_at', { ascending: true });

  const allAnalyses: any[] = analyses ?? [];

  const { data: reflections } = await (admin as any)
    .from('conversation_reflections')
    .select('analysis_id, evaluation, answers, xp_earned, status, created_at')
    .eq('user_id', userId)
    .eq('status', 'approved');

  const allReflections: any[] = reflections ?? [];

  if (!allAnalyses.length) {
    return NextResponse.json({ error: 'Este usuario no tiene conversaciones analizadas todavía.' }, { status: 400 });
  }

  // Compute capacity scores statistically
  const capTotals: Record<string, number[]> = {};
  for (const a of allAnalyses) {
    const caps = a.analysis?.capacidades_impactadas ?? {};
    for (const [k, v] of Object.entries(caps)) {
      const score = capScore(String(v));
      if (score !== null) {
        if (!capTotals[k]) capTotals[k] = [];
        capTotals[k].push(score);
      }
    }
  }

  const capAvg: Record<string, number> = {};
  for (const [k, scores] of Object.entries(capTotals)) {
    capAvg[k] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const sortedCaps = Object.entries(capAvg).sort((a, b) => b[1] - a[1]);
  const strongest = sortedCaps.slice(0, 2).map(([k]) => CAP_MAP[k] ?? k);
  const weakest   = sortedCaps.slice(-2).reverse().map(([k]) => CAP_MAP[k] ?? k);

  // Tendency: compare last 3 vs previous 3
  function avgScoreSlice(slice: any[]): number {
    let total = 0, count = 0;
    for (const a of slice) {
      for (const v of Object.values(a.analysis?.capacidades_impactadas ?? {})) {
        const s = capScore(String(v));
        if (s !== null) { total += s; count++; }
      }
    }
    return count ? total / count : 0;
  }

  let tendencia_semanal: 'mejorando' | 'estable' | 'empeorando' = 'estable';
  let tendencia_mensual: 'mejorando' | 'estable' | 'empeorando' = 'estable';

  if (allAnalyses.length >= 4) {
    const recent   = allAnalyses.slice(-3);
    const previous = allAnalyses.slice(-6, -3);
    const diff = avgScoreSlice(recent) - avgScoreSlice(previous);
    tendencia_mensual = diff > 0.2 ? 'mejorando' : diff < -0.2 ? 'empeorando' : 'estable';
  }

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const recentWeek = allAnalyses.filter(a => a.created_at >= weekAgo);
  const prevWeek   = allAnalyses.filter(a => a.created_at < weekAgo).slice(-recentWeek.length || -3);
  if (recentWeek.length >= 1 && prevWeek.length >= 1) {
    const diff = avgScoreSlice(recentWeek) - avgScoreSlice(prevWeek);
    tendencia_semanal = diff > 0.2 ? 'mejorando' : diff < -0.2 ? 'empeorando' : 'estable';
  }

  // Build context for AI synthesis
  const analysisContext = allAnalyses.map((a: any, i: number) => {
    const r = allReflections.find((rf: any) => rf.analysis_id === a.id);
    return `=== Conversación ${i + 1} (${new Date(a.created_at).toLocaleDateString('es-AR')}) ===
Resultado: ${a.analysis?.resultado_probable ?? ''}
Fortalezas: ${(a.analysis?.fortalezas ?? []).join(' | ')}
Errores: ${(a.analysis?.errores ?? []).join(' | ')}
Quiebre: ${a.analysis?.donde_se_rompio ?? ''}
${r ? `Reflexión del setter:
- ¿Qué aprendiste?: ${r.answers?.que_aprendiste ?? ''}
- ¿Qué aplicarás?: ${r.answers?.que_aplicaras ?? ''}
- Profundidad: ${r.evaluation?.profundidad ?? ''}` : '(sin reflexión aprobada)'}`;
  }).join('\n\n');

  const { data: targetProfile } = await admin.from('profiles').select('full_name, email').eq('id', userId).single();
  const userName = (targetProfile as any)?.full_name ?? (targetProfile as any)?.email ?? 'Usuario';

  const systemPrompt = `Sos el Motor CAC analizando la evolución de un setter a lo largo del tiempo.

Tu trabajo NO es describir conversaciones. Es diagnosticar evolución, patrones y aprendizaje real.

Analizás ${allAnalyses.length} conversaciones de ${userName}. Tu diagnóstico debe responder:
¿Qué está aprendiendo esta persona? ¿Hacia dónde va?

Pensá como un médico leyendo análisis de sangre repetidos en el tiempo: buscás tendencias, no eventos aislados.

Devolvé JSON exacto:
{
  "resumen": "2-3 oraciones sobre el estado actual del setter como profesional comercial — honesto, sin rodeos",
  "capacidades": {
    "fuertes": ["cap 1", "cap 2"],
    "debiles": ["cap 1", "cap 2"],
    "en_crecimiento": ["caps que mejoró con el tiempo"],
    "en_riesgo": ["caps que empeoraron o se estancaron"]
  },
  "patrones": {
    "activos": ["patrón que sigue repitiendo"],
    "corregidos": ["patrón que logró corregir"],
    "emergentes": ["patrón nuevo que aparece"]
  },
  "aprendizajes": {
    "principales_descubrimientos": ["qué descubrió sobre su forma de vender"],
    "mejoras_observadas": ["cambios concretos que se notaron en el tiempo"],
    "errores_repetidos": ["errores que siguen apareciendo a pesar del análisis"]
  },
  "recomendaciones": {
    "que_entrenar": "qué escenario o habilidad trabajar ahora mismo",
    "clase_recomendada": "qué clase del programa es más urgente",
    "mentoria_sugerida": "en qué área necesita guía humana"
  }
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: analysisContext },
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const synthesis = JSON.parse(completion.choices[0]?.message?.content ?? '{}');

    return NextResponse.json({
      user_name: userName,
      total_conversations: allAnalyses.length,
      approved_reflections: allReflections.length,
      tendencia_semanal,
      tendencia_mensual,
      strongest_caps: strongest,
      weakest_caps: weakest,
      cap_scores: capAvg,
      ...synthesis,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al sintetizar' }, { status: 500 });
  }
}
