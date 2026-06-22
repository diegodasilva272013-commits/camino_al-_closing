/**
 * Diego 2030 — Pipeline de extracción
 *
 * 5 pasos: ingesta → extracción → persistir comportamientos → generar mediciones → cerrar
 *
 * Invariantes:
 * - d2030_mediciones es append-only. NUNCA se sobreescriben.
 * - nivel_actual en d2030_capacidades = cache rolling sobre mediciones. NUNCA escrito a mano.
 * - comportamiento ↔ capacidad: M:M con (valencia, peso) en d2030_comportamiento_capacidades.
 * - Un comportamiento puede reforzar una capacidad y debilitar otra al mismo tiempo.
 */

import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Prompt de extracción ──────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `ROL
Sos el motor de análisis de "Diego 2030", un sistema que modela la evolución de
un fundador a partir de evidencia (transcripciones de clases, mentorías,
reuniones, conversaciones).

TAREA
Leer la evidencia y extraer COMPORTAMIENTOS OBSERVABLES de Diego. Un comportamiento
es una acción concreta y verificable, citada del texto. NO interpretaciones vagas,
NO adjetivos sueltos, NO suposiciones sobre lo que "seguramente" hizo o pensó.

CAPACIDADES (las únicas 6 contra las que podés mapear)
- claridad_ejecutiva: articular qué hay que hacer, por qué y con qué prioridad, sin ambigüedad.
- priorizacion: distinguir lo importante de lo urgente y ordenar el foco.
- delegacion: soltar tareas al equipo en vez de absorberlas.
- seguimiento: cerrar loops, dar continuidad a lo iniciado, no dejar cosas a la deriva.
- comunicacion_ejecutiva: transmitir mensajes con precisión, peso y al destinatario correcto.
- presencia: estar al mando — energía, foco y autoridad en la interacción.

REGLAS
1. Cada comportamiento DEBE tener una cita textual de respaldo. Si no podés citarlo, no lo incluyas.
2. Cada comportamiento impacta una o más capacidades, con valencia (refuerza | debilita)
   y peso (0.1 a 1.0 según la intensidad y claridad de la evidencia).
3. Solo Diego. Ignorá comportamientos de otras personas salvo que definan el contexto
   de una acción de Diego.
4. No fuerces capacidades. Si la evidencia no muestra nada de una, no la inventes.
5. Sé exigente. No inventes crecimiento donde no lo hay. No suavices. Esto mide a un
   fundador, no lo felicita.

SALIDA
SOLO JSON válido. Sin markdown, sin backticks, sin texto antes ni después.
Formato exacto:

{
  "comportamientos": [
    {
      "descripcion": "string — qué hizo Diego, concreto",
      "cita": "string — fragmento textual de la evidencia que lo respalda",
      "impactos": [
        { "capacidad": "<una de las 6>", "valencia": "refuerza|debilita", "peso": 0.0 }
      ]
    }
  ]
}

Si la evidencia no contiene ningún comportamiento relevante de Diego, devolvé:
{ "comportamientos": [] }`;

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Impacto = { capacidad: string; valencia: 'refuerza' | 'debilita'; peso: number };
type ComportamientoRaw = { descripcion: string; cita: string; impactos: Impacto[] };
type ExtractionOutput  = { comportamientos: ComportamientoRaw[] };

export type PipelineResult = {
  ok:                    boolean;
  evidencia_id?:         string;
  comportamientos_count?: number;
  mediciones_count?:     number;
  comportamientos?:      (ComportamientoRaw & { id: string })[];
  mediciones?:           { capacidad_clave: string; aporte_neto: number; nivel_actual: number }[];
  error?:                string;
  raw_llm?:              string;  // solo en caso de parse error para debug
};

const VALID_CAPS    = new Set(['claridad_ejecutiva','priorizacion','delegacion','seguimiento','comunicacion_ejecutiva','presencia']);
const VALID_VALENC  = new Set(['refuerza','debilita']);

// ── Paso 4 helper: recalcular nivel_actual (cache rolling) ───────────────────

async function recalcularNivelActual(admin: any, capacidadClave: string): Promise<number> {
  const { data: mediciones } = await (admin as any)
    .from('d2030_mediciones')
    .select('valor')
    .eq('capacidad_clave', capacidadClave);

  // nivel_actual = 5 (base) + suma acumulada de aportes netos, capeada a [0, 10]
  const suma = (mediciones ?? []).reduce((s: number, m: any) => s + (m.valor ?? 0), 0);
  const nivel = Math.max(0, Math.min(10, Math.round((5 + suma) * 10) / 10));

  await (admin as any)
    .from('d2030_capacidades')
    .update({ nivel_actual: nivel })
    .eq('clave', capacidadClave);

  return nivel;
}

// ── Pipeline principal ────────────────────────────────────────────────────────

export async function runExtractionPipeline(evidenciaId: string): Promise<PipelineResult> {
  const admin = createSupabaseAdminClient();

  // PASO 1: Cargar evidencia
  const { data: ev, error: evErr } = await (admin as any)
    .from('d2030_evidencias')
    .select('*')
    .eq('id', evidenciaId)
    .single();

  if (evErr || !ev) return { ok: false, error: 'Evidencia no encontrada' };
  if (!ev.texto_crudo?.trim()) return { ok: false, error: 'La evidencia no tiene texto crudo' };

  await (admin as any).from('d2030_evidencias').update({ estado_proc: 'processing' }).eq('id', evidenciaId);

  const hoy = ev.fecha ?? new Date().toISOString().split('T')[0];

  try {
    // PASO 2: Extracción con LLM
    const userMsg = [
      `TIPO: ${ev.tipo}`,
      ev.contexto ? `CONTEXTO: ${ev.contexto}` : '',
      '',
      ev.texto_crudo.slice(0, 20000),
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      temperature: 0,
      max_tokens:  4000,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user',   content: userMsg },
      ],
    });

    const raw = (completion.choices[0].message.content ?? '').trim();

    let parsed: ExtractionOutput;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      await (admin as any).from('d2030_evidencias').update({
        estado_proc: 'error',
        error_msg:   `Parse error LLM. Raw: ${raw.slice(0, 500)}`,
      }).eq('id', evidenciaId);
      return { ok: false, error: 'Error al parsear respuesta del LLM', raw_llm: raw };
    }

    const comportamientos: ComportamientoRaw[] = parsed.comportamientos ?? [];

    // PASO 3: Persistir comportamientos
    const insertedComps: (ComportamientoRaw & { id: string })[] = [];

    for (const c of comportamientos) {
      if (!c.descripcion?.trim() || !c.cita?.trim() || !c.impactos?.length) continue;

      const { data: inserted } = await (admin as any)
        .from('d2030_comportamientos')
        .insert({
          evidencia_id: evidenciaId,
          descripcion:  c.descripcion.trim(),
          cita_textual: c.cita.trim(),
          intensidad:   'media',
          fecha:        hoy,
        })
        .select('id')
        .single();

      if (!inserted?.id) continue;

      // M:M con validación: descartar impactos inválidos
      const validImpactos = (c.impactos ?? []).filter(i =>
        VALID_CAPS.has(i.capacidad) &&
        VALID_VALENC.has(i.valencia) &&
        typeof i.peso === 'number' &&
        i.peso >= 0.1 && i.peso <= 1.0
      );

      if (validImpactos.length) {
        await (admin as any).from('d2030_comportamiento_capacidades').insert(
          validImpactos.map(i => ({
            comportamiento_id: inserted.id,
            capacidad_clave:   i.capacidad,
            valencia:          i.valencia,
            peso:              i.peso,
          }))
        );
      }

      insertedComps.push({ ...c, id: inserted.id });
    }

    // PASO 4: Generar mediciones (computadas — no generadas por LLM)
    // aporte_neto por capacidad = Σ(peso refuerza) − Σ(peso debilita)
    const acum: Record<string, { refuerza: number; debilita: number; citas: string[] }> = {};

    for (const c of comportamientos) {
      for (const i of (c.impactos ?? [])) {
        if (!VALID_CAPS.has(i.capacidad) || !VALID_VALENC.has(i.valencia) || i.peso < 0.1 || i.peso > 1.0) continue;
        if (!acum[i.capacidad]) acum[i.capacidad] = { refuerza: 0, debilita: 0, citas: [] };
        if (i.valencia === 'refuerza') acum[i.capacidad].refuerza += i.peso;
        else                           acum[i.capacidad].debilita += i.peso;
        acum[i.capacidad].citas.push(`${i.valencia}(${i.peso})`);
      }
    }

    const medicionesResult: { capacidad_clave: string; aporte_neto: number; nivel_actual: number }[] = [];

    for (const [cap, { refuerza, debilita, citas }] of Object.entries(acum)) {
      const aporte_neto = Math.round((refuerza - debilita) * 100) / 100;

      await (admin as any).from('d2030_mediciones').insert({
        capacidad_clave: cap,
        valor:           aporte_neto,
        fecha:           hoy,
        evidencia_id:    evidenciaId,
        justificacion:   `refuerza:${refuerza.toFixed(2)} debilita:${debilita.toFixed(2)} neto:${aporte_neto} [${citas.join(', ')}]`,
        confianza:       'alta',
      });

      // Recalcular cache nivel_actual
      const nivel_actual = await recalcularNivelActual(admin, cap);
      medicionesResult.push({ capacidad_clave: cap, aporte_neto, nivel_actual });
    }

    // Timeline
    await (admin as any).from('d2030_timeline').insert({
      tipo_evento: 'evidencia_procesada',
      datos: {
        evidencia_id:    evidenciaId,
        titulo:          ev.titulo,
        tipo:            ev.tipo,
        comportamientos: insertedComps.length,
        mediciones:      medicionesResult.length,
      },
    });

    for (const m of medicionesResult) {
      await (admin as any).from('d2030_timeline').insert({
        tipo_evento: 'medicion_registrada',
        datos: { capacidad: m.capacidad_clave, aporte_neto: m.aporte_neto, nivel_actual: m.nivel_actual },
      });
    }

    // PASO 5: Cerrar evidencia
    await (admin as any).from('d2030_evidencias').update({
      estado_proc:  'ready',
      procesado_at: new Date().toISOString(),
    }).eq('id', evidenciaId);

    return {
      ok:                    true,
      evidencia_id:          evidenciaId,
      comportamientos_count: insertedComps.length,
      mediciones_count:      medicionesResult.length,
      comportamientos:       insertedComps,
      mediciones:            medicionesResult,
    };

  } catch (err: any) {
    await (admin as any).from('d2030_evidencias').update({
      estado_proc: 'error',
      error_msg:   err.message ?? String(err),
    }).eq('id', evidenciaId);
    return { ok: false, error: err.message ?? String(err) };
  }
}
