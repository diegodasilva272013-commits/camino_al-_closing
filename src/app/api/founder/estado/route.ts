import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { loadMemory } from '@/lib/founder-memory';
import { CAPACIDADES } from '@/lib/motor-cac-ceo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const mem = await loadMemory(admin);

  if (mem.total_analyses === 0) {
    return NextResponse.json({ has_data: false });
  }

  // Última evidencia
  const { data: lastEvidence } = await admin
    .from('founder_evidences')
    .select('date_recorded, title, type')
    .eq('analysis_status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Último análisis para feedback_general + predicción
  const { data: lastAnalysis } = await admin
    .from('founder_analyses')
    .select('analysis, capacities, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Patron dominante negativo
  const patronDominante = mem.patterns
    .filter(p => p.tipo === 'negativo')
    .sort((a, b) => b.count - a.count)[0] ?? null;

  // Patron positivo más fuerte
  const patronPositivo = mem.patterns
    .filter(p => p.tipo === 'positivo')
    .sort((a, b) => b.count - a.count)[0] ?? null;

  // Ejercicios activos
  const ejerciciosActivos = mem.active_exercises.filter(e =>
    ['pending','in_progress','delivered','needs_correction'].includes((e as any).status)
  );

  // Próxima acción: usa intervención del último análisis
  const proximaAccion = lastAnalysis?.analysis?.intervencion_prioritaria ?? null;
  const feedbackGeneral = lastAnalysis?.analysis?.feedback_general ?? null;
  const prediccion      = lastAnalysis?.analysis?.prediccion ?? null;

  // Snapshots históricos para gráfica
  const { data: snapshots } = await admin
    .from('founder_capacity_snapshots')
    .select('snapshot_date, scores, evidence_count')
    .order('snapshot_date', { ascending: true })
    .limit(30);

  // Capacidades formateadas con label
  const capacidadesFormateadas = Object.entries(mem.capacity_scores).map(([cap, score]) => ({
    key:   cap,
    label: CAPACIDADES[cap as keyof typeof CAPACIDADES] ?? cap,
    score: score ?? null,
    nivel: score == null ? 'sin_datos' : score >= 7 ? 'fuerte' : score >= 5 ? 'medio' : 'debil',
  })).sort((a, b) => (a.score ?? 10) - (b.score ?? 10));

  return NextResponse.json({
    has_data: true,
    total_evidencias:      mem.total_analyses,
    ultima_evidencia:      lastEvidence,
    capacidades:           capacidadesFormateadas,
    capacidad_debil:       mem.weakest_cap ? {
      ...mem.weakest_cap,
      label: CAPACIDADES[mem.weakest_cap.cap],
    } : null,
    capacidad_fuerte:      mem.strongest_cap ? {
      ...mem.strongest_cap,
      label: CAPACIDADES[mem.strongest_cap.cap],
    } : null,
    patron_dominante:      patronDominante ? {
      ...patronDominante,
      label_capacidad: CAPACIDADES[patronDominante.capacidad as keyof typeof CAPACIDADES] ?? patronDominante.capacidad,
    } : null,
    patron_positivo:       patronPositivo ? {
      ...patronPositivo,
      label_capacidad: CAPACIDADES[patronPositivo.capacidad as keyof typeof CAPACIDADES] ?? patronPositivo.capacidad,
    } : null,
    todos_patrones:        mem.patterns.slice(0, 20),
    comportamientos_neg:   mem.behaviors_neg.slice(0, 10),
    comportamientos_pos:   mem.behaviors_pos.slice(0, 10),
    proxima_accion:        proximaAccion,
    feedback_general:      feedbackGeneral,
    prediccion:            prediccion,
    ejercicios_activos:    ejerciciosActivos,
    snapshots:             snapshots ?? [],
  });
}
