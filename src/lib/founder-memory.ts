import { CAPACIDADES, type CapacidadKey } from './motor-cac-ceo';

const CAPS = Object.keys(CAPACIDADES) as CapacidadKey[];

export type MemorySnapshot = {
  total_analyses: number;
  capacity_scores: Partial<Record<CapacidadKey, number>>;
  patterns: { patron: string; tipo: string; capacidad: string; count: number; descripcion?: string }[];
  behaviors_neg: { behavior: string; capacidad: string; count: number }[];
  behaviors_pos: { behavior: string; capacidad: string; count: number }[];
  active_exercises: { title: string; capacity: string }[];
  weakest_cap: { cap: CapacidadKey; score: number } | null;
  strongest_cap: { cap: CapacidadKey; score: number } | null;
};

/** Construye el bloque de memoria histórica para inyectar en el prompt de o3 */
export function buildMemoryContext(mem: MemorySnapshot): string {
  if (mem.total_analyses === 0) return '';

  const lines: string[] = [
    '════ MEMORIA HISTÓRICA DEL SISTEMA ════',
    `Total de evidencias analizadas: ${mem.total_analyses}`,
    '',
    'CAPACIDADES — ESTADO ACTUAL (promedio acumulado):',
  ];

  for (const cap of CAPS) {
    const score = mem.capacity_scores[cap];
    if (score == null) { lines.push(`  - ${CAPACIDADES[cap]}: sin datos suficientes`); continue; }
    const nivel = score >= 7 ? 'FUERTE' : score >= 5 ? 'MEDIO' : 'DÉBIL ⚠';
    lines.push(`  - ${CAPACIDADES[cap]}: ${score}/10 [${nivel}]`);
  }

  if (mem.weakest_cap) {
    lines.push(`\n  ► CAPACIDAD MÁS DÉBIL: ${CAPACIDADES[mem.weakest_cap.cap]} (${mem.weakest_cap.score}/10)`);
  }

  if (mem.patterns.length > 0) {
    lines.push('\nPATRONES DETECTADOS HASTA AHORA:');
    const neg = mem.patterns.filter(p => p.tipo === 'negativo').slice(0, 8);
    const pos = mem.patterns.filter(p => p.tipo === 'positivo').slice(0, 5);
    if (neg.length) {
      lines.push('  [NEGATIVOS — a corregir]');
      neg.forEach(p => lines.push(`  - "${p.patron}" [${CAPACIDADES[p.capacidad as CapacidadKey] ?? p.capacidad}] — detectado ${p.count} vez${p.count > 1 ? 'es' : ''}`));
    }
    if (pos.length) {
      lines.push('  [POSITIVOS — a reforzar]');
      pos.forEach(p => lines.push(`  - "${p.patron}" [${CAPACIDADES[p.capacidad as CapacidadKey] ?? p.capacidad}] — detectado ${p.count} vez${p.count > 1 ? 'es' : ''}`));
    }
  }

  if (mem.behaviors_neg.length > 0) {
    lines.push('\nCOMPORTAMIENTOS NEGATIVOS MÁS FRECUENTES:');
    mem.behaviors_neg.slice(0, 5).forEach(b =>
      lines.push(`  - "${b.behavior}" [${CAPACIDADES[b.capacidad as CapacidadKey] ?? b.capacidad}] × ${b.count}`)
    );
  }

  if (mem.active_exercises.length > 0) {
    lines.push('\nEJERCICIOS ACTIVOS (NO repitas estos en la intervención):');
    mem.active_exercises.forEach(e =>
      lines.push(`  - "${e.title}" [${CAPACIDADES[e.capacity as CapacidadKey] ?? e.capacity}]`)
    );
  }

  lines.push(
    '',
    'INSTRUCCIONES PARA ESTE ANÁLISIS:',
    '- Si detectás un patrón ya existente en la memoria: indicá que es RECURRENTE y cuántas veces se detectó.',
    '- Comparé los scores de esta evidencia con los promedios históricos.',
    '- La intervención prioritaria debe atacar la capacidad MÁS DÉBIL, no repetir ejercicios activos.',
    '- Si hay mejora respecto al historial, señalala explícitamente.',
    '════ FIN MEMORIA ════',
  );

  return lines.join('\n');
}

/** Upserta patrones en founder_patterns después de cada análisis */
export async function updatePatterns(admin: any, evidenceId: string, patterns: any[]) {
  if (!patterns?.length) return;
  for (const p of patterns) {
    if (!p.patron || !p.capacidad) continue;
    const { data: existing } = await admin
      .from('founder_patterns')
      .select('id, count, evidence_ids')
      .eq('patron', p.patron)
      .eq('capacidad', p.capacidad)
      .maybeSingle();

    if (existing) {
      await admin.from('founder_patterns').update({
        count:        existing.count + 1,
        last_seen_at: new Date().toISOString(),
        evidence_ids: [...(existing.evidence_ids ?? []), evidenceId],
        descripcion:  p.descripcion ?? existing.descripcion,
      }).eq('id', existing.id);
    } else {
      await admin.from('founder_patterns').insert({
        patron:        p.patron,
        tipo:          p.tipo ?? 'neutro',
        capacidad:     p.capacidad,
        descripcion:   p.descripcion,
        count:         1,
        first_seen_at: new Date().toISOString(),
        last_seen_at:  new Date().toISOString(),
        evidence_ids:  [evidenceId],
      });
    }
  }
}

/** Upserta comportamientos en founder_behaviors */
export async function updateBehaviors(admin: any, capacidades: Record<string, any>) {
  for (const [cap, data] of Object.entries(capacidades)) {
    if (!data) continue;
    for (const beh of (data.comportamientos_negativos ?? [])) {
      if (!beh) continue;
      const { data: existing } = await admin.from('founder_behaviors').select('id,count').eq('behavior', beh).eq('capacidad', cap).maybeSingle();
      if (existing) {
        await admin.from('founder_behaviors').update({ count: existing.count + 1, last_seen_at: new Date().toISOString(), tipo: 'negativo' }).eq('id', existing.id);
      } else {
        await admin.from('founder_behaviors').insert({ behavior: beh, tipo: 'negativo', capacidad: cap, count: 1 });
      }
    }
    for (const beh of (data.comportamientos_positivos ?? [])) {
      if (!beh) continue;
      const { data: existing } = await admin.from('founder_behaviors').select('id,count').eq('behavior', beh).eq('capacidad', cap).maybeSingle();
      if (existing) {
        await admin.from('founder_behaviors').update({ count: existing.count + 1, last_seen_at: new Date().toISOString(), tipo: 'positivo' }).eq('id', existing.id);
      } else {
        await admin.from('founder_behaviors').insert({ behavior: beh, tipo: 'positivo', capacidad: cap, count: 1 });
      }
    }
  }
}

/** Carga la memoria completa desde DB */
export async function loadMemory(admin: any): Promise<MemorySnapshot> {
  const [
    { data: analyses },
    { data: patterns },
    { data: behaviors },
    { data: exercises },
    { data: snapshot },
  ] = await Promise.all([
    admin.from('founder_analyses').select('capacities').order('created_at', { ascending: false }),
    admin.from('founder_patterns').select('*').order('count', { ascending: false }).limit(30),
    admin.from('founder_behaviors').select('*').order('count', { ascending: false }).limit(30),
    admin.from('founder_exercises').select('title, capacity, status').in('status', ['pending','in_progress','needs_correction','delivered']),
    admin.from('founder_capacity_snapshots').select('scores').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const analysesList: any[] = analyses ?? [];
  const patternsList:  any[] = patterns ?? [];
  const behaviorsList: any[] = behaviors ?? [];
  const exerciseList:  any[] = exercises ?? [];

  // Capacidades del último snapshot (ya calculadas)
  const capScores: Partial<Record<CapacidadKey, number>> = snapshot?.scores ?? {};

  // Si no hay snapshot, recalcular desde análisis
  if (!snapshot && analysesList.length) {
    const accumulated: Record<string, number[]> = {};
    for (const a of analysesList) {
      for (const cap of CAPS) {
        const s = a.capacities?.[cap]?.score;
        if (s != null) {
          if (!accumulated[cap]) accumulated[cap] = [];
          accumulated[cap].push(s);
        }
      }
    }
    for (const cap of CAPS) {
      const arr = accumulated[cap] ?? [];
      if (arr.length) (capScores as any)[cap] = Math.round(arr.reduce((a,b) => a+b, 0) / arr.length * 10) / 10;
    }
  }

  const sorted = (Object.entries(capScores) as [CapacidadKey, number][]).sort((a,b) => a[1]-b[1]);
  const weakest   = sorted[0]  ? { cap: sorted[0][0],  score: sorted[0][1]  } : null;
  const strongest = sorted.slice(-1)[0] ? { cap: sorted.slice(-1)[0][0], score: sorted.slice(-1)[0][1] } : null;

  return {
    total_analyses:   analysesList.length,
    capacity_scores:  capScores,
    patterns:         patternsList,
    behaviors_neg:    behaviorsList.filter((b: any) => b.tipo === 'negativo'),
    behaviors_pos:    behaviorsList.filter((b: any) => b.tipo === 'positivo'),
    active_exercises: exerciseList,
    weakest_cap:      weakest,
    strongest_cap:    strongest,
  };
}
