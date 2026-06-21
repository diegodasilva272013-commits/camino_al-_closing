import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const CAPS = ['claridad_ejecutiva','priorizacion','delegacion','seguimiento','comunicacion_ejecutiva','presencia'];

  const [
    { data: allAnalyses },
    { data: snapshots },
    { data: exercises },
    { data: weeklyReport },
  ] = await Promise.all([
    (admin as any).from('founder_analyses').select('capacities, patterns, analysis, created_at').order('created_at', { ascending: false }),
    (admin as any).from('founder_capacity_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(30),
    (admin as any).from('founder_exercises').select('*').order('assigned_at', { ascending: false }),
    (admin as any).from('founder_weekly_reports').select('*').order('week_start', { ascending: false }).limit(1),
  ]);

  const analyses: any[] = allAnalyses ?? [];
  const snapshotList: any[] = snapshots ?? [];
  const exerciseList: any[] = exercises ?? [];

  if (!analyses.length) {
    return NextResponse.json({
      has_data: false,
      capacities: {},
      patterns: [],
      exercises: { active: [], completed: [] },
      snapshots: [],
      weekly_report: null,
      stats: { total_evidences: 0, total_exercises: 0, approved_exercises: 0 },
    });
  }

  // Calcular promedios actuales por capacidad
  const capScores: Record<string, number[]> = {};
  const allPatterns: any[] = [];

  for (const a of analyses) {
    for (const cap of CAPS) {
      const score = a.capacities?.[cap]?.score;
      if (score != null && typeof score === 'number') {
        if (!capScores[cap]) capScores[cap] = [];
        capScores[cap].push(score);
      }
    }
    if (Array.isArray(a.patterns)) allPatterns.push(...a.patterns);
  }

  const capacitySummary: Record<string, { score: number; trend: 'up'|'down'|'flat'; nivel: string }> = {};
  for (const cap of CAPS) {
    const scores = capScores[cap] ?? [];
    if (!scores.length) continue;
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const recent   = scores.slice(0, 3);
    const previous = scores.slice(3, 6);
    const recentAvg   = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.length ? previous.reduce((a, b) => a + b, 0) / previous.length : recentAvg;
    const diff = recentAvg - previousAvg;
    capacitySummary[cap] = {
      score: avg,
      trend: diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'flat',
      nivel: avg >= 7 ? 'fuerte' : avg >= 5 ? 'medio' : 'debil',
    };
  }

  // Patrones más frecuentes
  const patternCount: Record<string, { count: number; tipo: string; capacidad: string; descripcion: string }> = {};
  for (const p of allPatterns) {
    const key = p.patron ?? '';
    if (!key) continue;
    if (!patternCount[key]) patternCount[key] = { count: 0, tipo: p.tipo, capacidad: p.capacidad, descripcion: p.descripcion ?? '' };
    patternCount[key].count++;
  }
  const topPatterns = Object.entries(patternCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([patron, data]) => ({ patron, ...data }));

  const negativePatterns = topPatterns.filter(p => p.tipo === 'negativo');
  const positivePatterns = topPatterns.filter(p => p.tipo === 'positivo');

  // Capacidad más fuerte y más débil
  const sortedCaps = Object.entries(capacitySummary).sort((a, b) => b[1].score - a[1].score);
  const strongest  = sortedCaps[0];
  const weakest    = sortedCaps[sortedCaps.length - 1];

  // Distancia Diego 2030 promedio
  const dist2030Scores = analyses
    .map((a: any) => a.analysis?.distancia_diego_2030?.score)
    .filter((s: any) => s != null && typeof s === 'number');
  const avg2030 = dist2030Scores.length
    ? Math.round(dist2030Scores.reduce((a: number, b: number) => a + b, 0) / dist2030Scores.length * 10) / 10
    : null;

  // Ejercicios
  const activeExercises  = exerciseList.filter(e => !['approved','validated'].includes(e.status));
  const completedExercises = exerciseList.filter(e => ['approved','validated'].includes(e.status));

  return NextResponse.json({
    has_data:         true,
    total_evidences:  analyses.length,
    capacities:       capacitySummary,
    strongest_cap:    strongest ? { cap: strongest[0], ...strongest[1] } : null,
    weakest_cap:      weakest   ? { cap: weakest[0],   ...weakest[1]   } : null,
    distance_2030:    avg2030,
    dominant_pattern: negativePatterns[0] ?? null,
    top_patterns:     topPatterns,
    positive_patterns: positivePatterns,
    negative_patterns: negativePatterns,
    snapshots:         snapshotList,
    exercises: {
      active:    activeExercises,
      completed: completedExercises,
    },
    weekly_report:    weeklyReport?.[0] ?? null,
    recent_feedback:  analyses.slice(0, 3).map((a: any) => ({
      feedback: a.analysis?.feedback_general,
      prediccion: a.analysis?.prediccion,
      created_at: a.created_at,
    })),
    stats: {
      total_evidences:   analyses.length,
      total_exercises:   exerciseList.length,
      approved_exercises: completedExercises.length,
    },
  });
}
