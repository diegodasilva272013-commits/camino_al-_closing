/**
 * Diego 2030 — Pipeline de extracción
 *
 * 5 pasos: ingesta → extracción → persistir comportamientos → generar mediciones → cerrar
 *
 * Invariantes:
 * - medicion es APPEND-ONLY. NUNCA se sobreescriben.
 * - nivel_actual en objetivo_crecimiento = cache rolling. NUNCA escrito a mano.
 * - comportamiento ↔ capacidad: M:M con (valencia, peso) en comportamiento_capacidad.
 * - El prompt se genera DINÁMICAMENTE desde objetivo_crecimiento en cada ejecución.
 */

import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ObjetivoRow = {
  id: string;
  nombre: string;
  nombre_display: string;
  definicion: string;
  meta_2030: string;
  criterios_evaluacion: string;
};

type Impacto = { capacidad: string; valencia: 'refuerza' | 'debilita'; peso: number };
type ComportamientoRaw = {
  descripcion:      string;
  cita:             string;
  timestamp?:       string;
  speaker_contexto?: string;
  impactos:         Impacto[];
};
type ExtractionOutput = { comportamientos: ComportamientoRaw[] };

export type PipelineResult = {
  ok:                     boolean;
  evidencia_id?:          string;
  comportamientos_count?: number;
  mediciones_count?:      number;
  comportamientos?:       (ComportamientoRaw & { id: string })[];
  mediciones?:            { capacidad_id: string; nombre: string; aporte_neto: number; nivel_actual: number }[];
  error?:                 string;
  raw_llm?:               string;
};

// ── Prompt dinámico (se regenera desde objetivo_crecimiento en cada corrida) ──

function buildExtractionPrompt(objetivos: ObjetivoRow[]): string {
  const bloqueCapacidades = objetivos.map(o =>
    `- ${o.nombre}: ${o.definicion} Meta: ${o.meta_2030} Evaluar: ${o.criterios_evaluacion}`
  ).join('\n');

  return `ROL
Sos el motor de análisis de "Diego 2030", un sistema que modela la evolución de
un fundador a partir de evidencia real (transcripciones de reuniones, clases, mentorías).

TAREA
Leer la transcripción y extraer COMPORTAMIENTOS OBSERVABLES de Diego. Un comportamiento
es una acción concreta y verificable, citada del texto. NO interpretaciones vagas,
NO adjetivos sueltos, NO suposiciones sobre lo que "seguramente" hizo o pensó.

CAPACIDADES (las que Diego definió como sus objetivos de crecimiento)
${bloqueCapacidades}

REGLAS
1. Cada comportamiento DEBE tener una cita textual de respaldo. Si no podés citarlo, no lo incluyas.
2. Cada comportamiento impacta una o más capacidades, con valencia (refuerza | debilita)
   y peso (0.1 a 1.0 según intensidad y claridad de la evidencia).
3. Solo Diego. Ignorá comportamientos de otros salvo como contexto de una acción de Diego.
4. No fuerces capacidades. Si la evidencia no muestra nada de una, no la inventes.
5. Sé exigente. No inventes crecimiento donde no lo hay. No suavices.
6. Si hay timestamps en la transcripción, incluí el timestamp del momento.
7. El campo "capacidad" en impactos debe ser EXACTAMENTE uno de los nombres del listado.

SALIDA
SOLO JSON válido. Sin markdown, sin backticks, sin texto antes ni después.

{
  "comportamientos": [
    {
      "descripcion": "string — qué hizo Diego, concreto",
      "cita": "string — fragmento textual exacto",
      "timestamp": "string — momento del video si está disponible, null si no",
      "speaker_contexto": "string — con quién interactuaba, null si no aplica",
      "impactos": [
        { "capacidad": "<nombre exacto de la capacidad>", "valencia": "refuerza|debilita", "peso": 0.0 }
      ]
    }
  ]
}

Si no hay comportamientos relevantes de Diego: { "comportamientos": [] }`;
}

// ── Paso 4 helper: recalcular nivel_actual (cache rolling) ───────────────────
// nivel_actual = 5 (base) + suma de todos los aportes netos, capeado a [0, 10]

async function recalcularNivelActual(admin: any, capacidadId: string): Promise<number> {
  const { data: meds } = await (admin as any)
    .from('medicion')
    .select('valor')
    .eq('capacidad_id', capacidadId);

  const suma  = (meds ?? []).reduce((s: number, m: any) => s + (m.valor ?? 0), 0);
  const nivel = Math.max(0, Math.min(10, Math.round((5 + suma) * 10) / 10));

  await (admin as any)
    .from('objetivo_crecimiento')
    .update({ nivel_actual: nivel })
    .eq('id', capacidadId);

  return nivel;
}

// ── Pipeline principal ────────────────────────────────────────────────────────

export async function runExtractionPipeline(evidenciaId: string): Promise<PipelineResult> {
  const admin = createSupabaseAdminClient();

  // PASO 1: Cargar evidencia + perfil + objetivos en paralelo
  const [evRes, objRes] = await Promise.all([
    (admin as any).from('evidencia').select('*').eq('id', evidenciaId).single(),
    (admin as any).from('objetivo_crecimiento').select('id, nombre, nombre_display, definicion, meta_2030, criterios_evaluacion').eq('activo', true).order('orden'),
  ]);

  const ev = evRes.data;
  if (evRes.error || !ev) return { ok: false, error: 'Evidencia no encontrada' };
  if (!ev.texto?.trim()) return { ok: false, error: 'La evidencia no tiene texto' };

  const objetivos: ObjetivoRow[] = objRes.data ?? [];
  if (!objetivos.length) return { ok: false, error: 'No hay objetivos de crecimiento activos. Corrí la migración 0029.' };

  // Mapa nombre → {id, nombre_display}
  const capByNombre: Record<string, { id: string; nombre: string }> = {};
  for (const o of objetivos) capByNombre[o.nombre] = { id: o.id, nombre: o.nombre_display };
  const validNombres = new Set(Object.keys(capByNombre));

  await (admin as any).from('evidencia').update({ estado: 'procesando' }).eq('id', evidenciaId);

  const fecha = ev.fecha ?? new Date().toISOString().split('T')[0];

  try {
    // PASO 2: Extracción con LLM (prompt dinámico)
    const userMsg = [
      `TIPO: ${ev.tipo}`,
      '',
      ev.texto.slice(0, 20000),
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      temperature: 0,
      max_tokens:  4000,
      messages: [
        { role: 'system', content: buildExtractionPrompt(objetivos) },
        { role: 'user',   content: userMsg },
      ],
    });

    const raw = (completion.choices[0].message.content ?? '').trim();

    let parsed: ExtractionOutput;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      await (admin as any).from('evidencia').update({
        estado: 'error',
        error_detalle: `Parse error. Raw: ${raw.slice(0, 500)}`,
      }).eq('id', evidenciaId);
      return { ok: false, error: 'Error al parsear respuesta del LLM', raw_llm: raw };
    }

    const comportamientosRaw: ComportamientoRaw[] = parsed.comportamientos ?? [];

    // PASO 3: Persistir comportamientos
    const insertedComps: (ComportamientoRaw & { id: string })[] = [];

    for (const c of comportamientosRaw) {
      if (!c.descripcion?.trim() || !c.cita?.trim() || !c.impactos?.length) continue;

      // Filtrar impactos inválidos antes de insertar
      const validImpactos = (c.impactos ?? []).filter(i =>
        validNombres.has(i.capacidad) &&
        (i.valencia === 'refuerza' || i.valencia === 'debilita') &&
        typeof i.peso === 'number' &&
        i.peso >= 0.1 && i.peso <= 1.0
      );
      if (!validImpactos.length) continue;

      const { data: inserted } = await (admin as any)
        .from('comportamiento')
        .insert({
          evidencia_id:     evidenciaId,
          descripcion:      c.descripcion.trim(),
          cita:             c.cita.trim(),
          timestamp_inicio: c.timestamp ? parseFloat(c.timestamp) || null : null,
          speaker_contexto: c.speaker_contexto ?? null,
          fecha,
        })
        .select('id')
        .single();

      if (!inserted?.id) continue;

      await (admin as any).from('comportamiento_capacidad').insert(
        validImpactos.map(i => ({
          comportamiento_id: inserted.id,
          capacidad_id:      capByNombre[i.capacidad].id,
          valencia:          i.valencia,
          peso:              i.peso,
        }))
      );

      insertedComps.push({ ...c, id: inserted.id });
    }

    // PASO 4: Generar mediciones (computadas — aporte_neto = Σrefuerza − Σdebilita)
    const acum: Record<string, { refuerza: number; debilita: number; citas: string[] }> = {};

    for (const c of comportamientosRaw) {
      for (const i of (c.impactos ?? [])) {
        if (!validNombres.has(i.capacidad) || i.peso < 0.1 || i.peso > 1.0) continue;
        if (!acum[i.capacidad]) acum[i.capacidad] = { refuerza: 0, debilita: 0, citas: [] };
        if (i.valencia === 'refuerza') acum[i.capacidad].refuerza += i.peso;
        else                           acum[i.capacidad].debilita += i.peso;
        acum[i.capacidad].citas.push(`${i.valencia}(${i.peso})`);
      }
    }

    const medicionesResult: { capacidad_id: string; nombre: string; aporte_neto: number; nivel_actual: number }[] = [];

    for (const [nombre, { refuerza, debilita, citas }] of Object.entries(acum)) {
      const cap        = capByNombre[nombre];
      const aporte_neto = Math.round((refuerza - debilita) * 100) / 100;

      await (admin as any).from('medicion').insert({
        capacidad_id: cap.id,
        evidencia_id: evidenciaId,
        valor:        aporte_neto,
        justificacion: `refuerza:${refuerza.toFixed(2)} debilita:${debilita.toFixed(2)} neto:${aporte_neto} [${citas.join(', ')}]`,
        fecha,
      });

      const nivel_actual = await recalcularNivelActual(admin, cap.id);

      // Actualizar nivel_acumulado en la medición recién insertada
      await (admin as any)
        .from('medicion')
        .update({ nivel_acumulado: nivel_actual })
        .eq('capacidad_id', cap.id)
        .eq('evidencia_id', evidenciaId)
        .is('nivel_acumulado', null);

      medicionesResult.push({ capacidad_id: cap.id, nombre: cap.nombre, aporte_neto, nivel_actual });
    }

    // PASO 5: Cerrar evidencia
    await (admin as any).from('evidencia').update({ estado: 'procesada' }).eq('id', evidenciaId);

    return {
      ok:                     true,
      evidencia_id:           evidenciaId,
      comportamientos_count:  insertedComps.length,
      mediciones_count:       medicionesResult.length,
      comportamientos:        insertedComps,
      mediciones:             medicionesResult,
    };

  } catch (err: any) {
    await (admin as any).from('evidencia').update({
      estado: 'error',
      error_detalle: err.message ?? String(err),
    }).eq('id', evidenciaId);
    return { ok: false, error: err.message ?? String(err) };
  }
}
