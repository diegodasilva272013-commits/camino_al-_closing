import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { MOTOR_CAC_CEO_SYSTEM, CAPACIDADES } from '@/lib/motor-cac-ceo';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(_req: NextRequest) {
  // F5-A: sistema founder legacy (0025/0026) en modo lectura. El cron ya no escribe.
  // El reporte semanal del founder se generará desde sistema 0029 (F5-B).
  return NextResponse.json({ ok: true, skipped: true, reason: 'Sistema legacy desactivado.' });
}

// Código legacy preservado — no ejecuta. Referencia para F5-B.
async function _GET_legacy(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isCron     = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const adminClient = createSupabaseAdminClient() as any;
    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
    if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient() as any;

  // Calcular semana actual
  const now       = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Lunes
  const weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);            // Domingo
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr   = weekEnd.toISOString().split('T')[0];

  // Evidencias y análisis de la semana
  const { data: weekAnalyses } = await (admin as any)
    .from('founder_analyses')
    .select('capacities, patterns, analysis, created_at')
    .gte('created_at', weekStart.toISOString())
    .lte('created_at', weekEnd.toISOString() + 'T23:59:59Z');

  const { data: allAnalyses } = await (admin as any)
    .from('founder_analyses')
    .select('capacities, patterns, analysis, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: exercises } = await (admin as any)
    .from('founder_exercises')
    .select('*')
    .order('assigned_at', { ascending: false });

  const weekEvs: any[]  = weekAnalyses ?? [];
  const allEvs: any[]   = allAnalyses ?? [];
  const exerciseList: any[] = exercises ?? [];

  // Calcular promedios
  const CAPS = Object.keys(CAPACIDADES);
  const weekScores: Record<string, number[]>  = {};
  const totalScores: Record<string, number[]> = {};

  for (const a of weekEvs) {
    for (const cap of CAPS) {
      const s = a.capacities?.[cap]?.score;
      if (s != null) { if (!weekScores[cap]) weekScores[cap] = []; weekScores[cap].push(s); }
    }
  }
  for (const a of allEvs) {
    for (const cap of CAPS) {
      const s = a.capacities?.[cap]?.score;
      if (s != null) { if (!totalScores[cap]) totalScores[cap] = []; totalScores[cap].push(s); }
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;

  const capSummary = CAPS.map(cap => ({
    cap,
    label:    CAPACIDADES[cap as keyof typeof CAPACIDADES],
    week_avg: avg(weekScores[cap] ?? []),
    total_avg: avg(totalScores[cap] ?? []),
  }));

  const sorted     = capSummary.filter(c => c.total_avg != null).sort((a, b) => (b.total_avg ?? 0) - (a.total_avg ?? 0));
  const strongest  = sorted[0];
  const weakest    = sorted[sorted.length - 1];

  const allPatterns: any[] = allEvs.flatMap((a: any) => a.patterns ?? []);
  const patternCount: Record<string, number> = {};
  for (const p of allPatterns) { const k = p.patron ?? ''; if (k) patternCount[k] = (patternCount[k] ?? 0) + 1; }
  const topNeg = Object.entries(patternCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);

  const activeExercises = exerciseList.filter(e => !['approved','validated'].includes(e.status));
  const recentFeedbacks = allEvs.slice(0, 5).map((a: any) => a.analysis?.feedback_general).filter(Boolean);

  const reportPrompt = `Sos el Motor CAC CEO. Generá el reporte semanal de evolución de Diego.

SEMANA: ${weekStartStr} al ${weekEndStr}
EVIDENCIAS ESTA SEMANA: ${weekEvs.length}
EJERCICIOS ACTIVOS: ${activeExercises.length}
EJERCICIOS APROBADOS (total): ${exerciseList.filter(e => e.status === 'approved').length}

CAPACIDADES — PROMEDIOS ACUMULADOS:
${capSummary.map(c => `- ${c.label}: ${c.total_avg ?? 'sin datos'}/10`).join('\n')}

CAPACIDAD MÁS FUERTE: ${strongest?.label ?? 'sin datos'} (${strongest?.total_avg ?? '—'}/10)
CAPACIDAD MÁS DÉBIL: ${weakest?.label ?? 'sin datos'} (${weakest?.total_avg ?? '—'}/10)

PATRONES NEGATIVOS MÁS FRECUENTES: ${topNeg.join(', ') || 'ninguno detectado'}

ÚLTIMOS FEEDBACKS DEL MOTOR CAC CEO:
${recentFeedbacks.join('\n\n') || '(sin datos esta semana)'}

Generá este JSON exacto:
{
  "avances": ["avance 1 con evidencia concreta", "avance 2", "avance 3"],
  "limitaciones": ["limitación 1 con evidencia concreta", "limitación 2", "limitación 3"],
  "capacidad_mas_fuerte": "...",
  "capacidad_mas_debil": "...",
  "patron_dominante": "...",
  "patron_corregido": "... (o 'ninguno detectado todavía')",
  "patron_emergente": "...",
  "que_entrenar": "...",
  "que_delegar": "...",
  "que_dejar_de_hacer": "...",
  "que_cerrar": "...",
  "que_clase_preparar": "...",
  "que_estudiar": "...",
  "que_sistema_documentar": "...",
  "proxima_mejor_accion": "Una sola acción concreta, específica, para esta semana.",
  "evaluacion_semana": "Párrafo directo. Qué mejoró, qué empeoró, cómo está la distancia con Diego 2030. Sin elogios vacíos."
}`;

  const completion = await (openai.chat.completions.create as any)({
    model: 'o3',
    reasoning_effort: 'high',
    messages: [
      { role: 'system', content: MOTOR_CAC_CEO_SYSTEM },
      { role: 'user',   content: reportPrompt },
    ],
  });

  const raw       = (completion.choices[0].message.content ?? '{}').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const report    = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  await (admin as any).from('founder_weekly_reports').upsert({
    week_start: weekStartStr,
    week_end:   weekEndStr,
    report,
    meta: { evidences_this_week: weekEvs.length, active_exercises: activeExercises.length, cap_summary: capSummary },
  }, { onConflict: 'week_start' });

  return NextResponse.json({ ok: true, week: weekStartStr, report });
}
