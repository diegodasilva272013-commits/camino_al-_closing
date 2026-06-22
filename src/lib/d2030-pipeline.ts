/**
 * Pipeline de extracción Diego 2030
 * evidencia → comportamientos → mediciones → patrones → timeline → perfil
 *
 * Reglas de integridad:
 * - Las mediciones son append-only. NUNCA se sobreescriben.
 * - nivel_actual de una capacidad = último valor en d2030_mediciones para esa clave.
 * - comportamiento ↔ capacidad es M:M con valencia en la relación (d2030_comportamiento_capacidades).
 * - Un mismo comportamiento puede reforzar una capacidad y debilitar otra.
 * - Las capacidades se leen de d2030_capacidades (DB), no están hardcodeadas aquí.
 */

import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { MOTOR_CAC_CEO_SYSTEM } from '@/lib/motor-cac-ceo';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Tipos del pipeline ────────────────────────────────────────────────────────

type Capacidad = { clave: string; nombre: string; descripcion: string | null };

type ComportamientoRaw = {
  descripcion:  string;
  cita_textual: string | null;
  intensidad:   'alta' | 'media' | 'baja';
  capacidades:  { clave: string; valencia: 'refuerza' | 'debilita' }[];
};

type MedicionRaw = {
  capacidad_clave: string;
  valor:           number;
  justificacion:   string;
  confianza:       'alta' | 'media' | 'baja';
};

type PatronRaw = {
  descripcion:     string;
  capacidad_clave: string;
  valencia:        'positivo' | 'negativo';
};

type ExtractionOutput = {
  comportamientos:      ComportamientoRaw[];
  mediciones:           MedicionRaw[];
  patrones_detectados:  PatronRaw[];
};

export type PipelineResult = {
  ok:                    boolean;
  evidencia_id?:         string;
  comportamientos_count?: number;
  mediciones_count?:     number;
  patrones_count?:       number;
  comportamientos?:      ComportamientoRaw[];
  mediciones?:           MedicionRaw[];
  patrones?:             PatronRaw[];
  error?:                string;
};

// ── Prompt de extracción (capacidades vienen de DB, no hardcodeadas) ──────────

function buildExtractionPrompt(evidencia: any, capacidades: Capacidad[]): string {
  const capList = capacidades
    .map(c => `  - ${c.clave}: ${c.nombre}${c.descripcion ? ` — ${c.descripcion.slice(0, 100)}` : ''}`)
    .join('\n');

  return [
    `Analizá esta evidencia de Diego, fundador de Camino al Closing.`,
    ``,
    `TAREA: Extraer comportamientos concretos observados y medir las capacidades afectadas.`,
    ``,
    `CAPACIDADES DEL SISTEMA (referencia para mapear comportamientos):`,
    capList,
    ``,
    `REGLAS DE EXTRACCIÓN:`,
    `- Comportamientos: observaciones concretas con respaldo textual. Sin generalizaciones ni inferencias no fundadas.`,
    `- Un comportamiento puede reforzar UNA capacidad y debilitar OTRA simultáneamente — ambas relaciones van en "capacidades".`,
    `- Mediciones: una por capacidad con evidencia suficiente. Omití las que no aparecen en el texto.`,
    `- Patrones: detectalos solo si hay recurrencia dentro de esta evidencia o el texto lo indica explícitamente.`,
    `- cita_textual: fragmento literal del texto cuando existe, null si no.`,
    ``,
    `TIPO DE EVIDENCIA: ${evidencia.tipo}`,
    evidencia.contexto ? `CONTEXTO: ${evidencia.contexto}` : '',
    ``,
    `══════════════════════════════`,
    (evidencia.texto_crudo ?? '').slice(0, 20000),
    `══════════════════════════════`,
    ``,
    `Devolvé ÚNICAMENTE este JSON (sin texto antes ni después):`,
    `{`,
    `  "comportamientos": [`,
    `    {`,
    `      "descripcion": "observación concreta del comportamiento",`,
    `      "cita_textual": "fragmento literal o null",`,
    `      "intensidad": "alta|media|baja",`,
    `      "capacidades": [`,
    `        { "clave": "clave_de_capacidad", "valencia": "refuerza|debilita" }`,
    `      ]`,
    `    }`,
    `  ],`,
    `  "mediciones": [`,
    `    {`,
    `      "capacidad_clave": "clave_de_capacidad",`,
    `      "valor": 7.5,`,
    `      "justificacion": "por qué este score, con referencia al texto",`,
    `      "confianza": "alta|media|baja"`,
    `    }`,
    `  ],`,
    `  "patrones_detectados": [`,
    `    {`,
    `      "descripcion": "nombre corto del patrón (ej: Sobreexplicación)",`,
    `      "capacidad_clave": "clave_de_capacidad",`,
    `      "valencia": "positivo|negativo"`,
    `    }`,
    `  ]`,
    `}`,
  ].filter(l => l !== null && l !== undefined).join('\n');
}

// ── Actualizar d2030_perfil (estado calculado, no manual) ────────────────────

async function updatePerfil(admin: any) {
  try {
    // Último valor por capacidad: sort desc, take first per clave
    const { data: todasLasMediciones } = await admin
      .from('d2030_mediciones')
      .select('capacidad_clave, valor, fecha, confianza')
      .order('fecha', { ascending: false });

    const latest: Record<string, any> = {};
    for (const m of (todasLasMediciones ?? [])) {
      if (!latest[m.capacidad_clave]) latest[m.capacidad_clave] = m;
    }
    const valores = Object.values(latest) as any[];
    if (!valores.length) return;

    const sorted  = [...valores].sort((a, b) => a.valor - b.valor);
    const debil   = sorted[0];
    const fuerte  = sorted[sorted.length - 1];

    const { data: patronDominante } = await admin
      .from('d2030_patrones')
      .select('id, descripcion, frecuencia, capacidad_clave, valencia')
      .eq('estado', 'activo')
      .eq('valencia', 'negativo')
      .order('frecuencia', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: intervencionActiva } = await admin
      .from('d2030_intervenciones')
      .select('id')
      .eq('estado', 'activa')
      .limit(1)
      .maybeSingle();

    await admin.from('d2030_perfil').update({
      estado_actual: {
        mediciones_por_capacidad: latest,
        capacidad_debil:          debil,
        capacidad_fuerte:         fuerte,
        patron_dominante:         patronDominante ?? null,
      },
      capacidad_debil_clave:  debil?.capacidad_clave ?? null,
      patron_dominante_id:    patronDominante?.id ?? null,
      intervencion_activa_id: intervencionActiva?.id ?? null,
      ultima_actualizacion:   new Date().toISOString(),
    }).eq('id', 1);
  } catch {}
}

// ── Pipeline principal ────────────────────────────────────────────────────────

export async function runExtractionPipeline(evidenciaId: string): Promise<PipelineResult> {
  const admin = createSupabaseAdminClient();

  // 1. Cargar evidencia
  const { data: evidencia, error: evErr } = await (admin as any)
    .from('d2030_evidencias')
    .select('*')
    .eq('id', evidenciaId)
    .single();

  if (evErr || !evidencia) return { ok: false, error: 'Evidencia no encontrada' };
  if (!evidencia.texto_crudo?.trim()) return { ok: false, error: 'La evidencia no tiene texto crudo' };

  // Marcar como en proceso
  await (admin as any).from('d2030_evidencias')
    .update({ estado_proc: 'processing' })
    .eq('id', evidenciaId);

  try {
    // 2. Cargar capacidades DESDE DB
    const { data: caps } = await (admin as any)
      .from('d2030_capacidades')
      .select('clave, nombre, descripcion')
      .eq('activa', true)
      .order('orden');

    const capacidades: Capacidad[] = caps ?? [];
    const validClaves = new Set(capacidades.map((c: Capacidad) => c.clave));

    // 3. Llamar al LLM para extracción
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      temperature: 0,
      max_tokens:  3000,
      messages: [
        { role: 'system', content: MOTOR_CAC_CEO_SYSTEM },
        { role: 'user',   content: buildExtractionPrompt(evidencia, capacidades) },
      ],
    });

    const raw   = (completion.choices[0].message.content ?? '{}').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const extracted: ExtractionOutput = JSON.parse(match ? match[0] : raw);

    const hoy  = evidencia.fecha ?? new Date().toISOString().split('T')[0];
    const comp  = extracted.comportamientos ?? [];
    const meds  = (extracted.mediciones ?? []).filter(m =>
      validClaves.has(m.capacidad_clave) && m.valor >= 0 && m.valor <= 10
    );
    const pats  = (extracted.patrones_detectados ?? []).filter(p =>
      validClaves.has(p.capacidad_clave)
    );

    // 4. Insertar comportamientos + relaciones M:M con capacidades
    const compIds: Record<number, string> = {};

    for (let i = 0; i < comp.length; i++) {
      const c = comp[i];
      const { data: inserted } = await (admin as any)
        .from('d2030_comportamientos')
        .insert({
          evidencia_id: evidenciaId,
          descripcion:  c.descripcion,
          cita_textual: c.cita_textual ?? null,
          intensidad:   c.intensidad ?? 'media',
          fecha:        hoy,
        })
        .select('id')
        .single();

      if (!inserted?.id) continue;
      compIds[i] = inserted.id;

      const relaciones = (c.capacidades ?? []).filter(cc => validClaves.has(cc.clave));
      if (relaciones.length) {
        await (admin as any)
          .from('d2030_comportamiento_capacidades')
          .insert(relaciones.map(cc => ({
            comportamiento_id: inserted.id,
            capacidad_clave:   cc.clave,
            valencia:          cc.valencia,
          })));
      }

      await (admin as any).from('d2030_timeline').insert({
        tipo_evento: 'comportamiento_extraido',
        datos: {
          evidencia_id: evidenciaId,
          descripcion:  c.descripcion.slice(0, 120),
          capacidades:  (c.capacidades ?? []).map(cc => `${cc.clave}:${cc.valencia}`),
        },
      });
    }

    // 5. Insertar mediciones (append-only — nunca pisamos)
    if (meds.length) {
      await (admin as any).from('d2030_mediciones').insert(
        meds.map(m => ({
          capacidad_clave: m.capacidad_clave,
          valor:           m.valor,
          fecha:           hoy,
          evidencia_id:    evidenciaId,
          justificacion:   m.justificacion,
          confianza:       m.confianza ?? 'media',
        }))
      );

      for (const m of meds) {
        await (admin as any).from('d2030_timeline').insert({
          tipo_evento: 'medicion_registrada',
          datos: { capacidad: m.capacidad_clave, valor: m.valor, evidencia_id: evidenciaId },
        });
      }
    }

    // 6. Upsert patrones + vincular comportamientos
    const patronCount = { detected: 0 };

    for (const p of pats) {
      const { data: existing } = await (admin as any)
        .from('d2030_patrones')
        .select('id, frecuencia')
        .eq('descripcion', p.descripcion)
        .eq('capacidad_clave', p.capacidad_clave)
        .maybeSingle();

      let patronId: string | null = null;

      if (existing) {
        await (admin as any).from('d2030_patrones').update({
          frecuencia:       existing.frecuencia + 1,
          ultima_aparicion: hoy,
        }).eq('id', existing.id);
        patronId = existing.id;

        await (admin as any).from('d2030_timeline').insert({
          tipo_evento: 'patron_frecuencia_aumentada',
          datos: { patron: p.descripcion, capacidad: p.capacidad_clave, frecuencia: existing.frecuencia + 1 },
        });
      } else {
        const { data: newPat } = await (admin as any)
          .from('d2030_patrones')
          .insert({
            descripcion:       p.descripcion,
            capacidad_clave:   p.capacidad_clave,
            valencia:          p.valencia,
            frecuencia:        1,
            primera_aparicion: hoy,
            ultima_aparicion:  hoy,
          })
          .select('id')
          .single();

        patronId = newPat?.id ?? null;

        await (admin as any).from('d2030_timeline').insert({
          tipo_evento: 'patron_detectado',
          datos: { patron: p.descripcion, capacidad: p.capacidad_clave, valencia: p.valencia },
        });
      }

      if (patronId) {
        patronCount.detected++;
        // Vincular comportamientos de esta capacidad al patrón
        for (const [idx, cId] of Object.entries(compIds)) {
          const c = comp[Number(idx)];
          if (c.capacidades?.some(cc => cc.clave === p.capacidad_clave)) {
            await (admin as any)
              .from('d2030_patron_comportamientos')
              .upsert(
                { patron_id: patronId, comportamiento_id: cId },
                { onConflict: 'patron_id,comportamiento_id', ignoreDuplicates: true }
              );
          }
        }
      }
    }

    // 7. Timeline: evidencia procesada
    await (admin as any).from('d2030_timeline').insert({
      tipo_evento: 'evidencia_procesada',
      datos: {
        evidencia_id:    evidenciaId,
        titulo:          evidencia.titulo,
        tipo:            evidencia.tipo,
        comportamientos: Object.keys(compIds).length,
        mediciones:      meds.length,
        patrones:        patronCount.detected,
      },
    });

    // 8. Recalcular perfil (estado calculado)
    await updatePerfil(admin);

    // 9. Marcar evidencia como lista
    await (admin as any).from('d2030_evidencias').update({
      estado_proc:  'ready',
      procesado_at: new Date().toISOString(),
    }).eq('id', evidenciaId);

    return {
      ok:                    true,
      evidencia_id:          evidenciaId,
      comportamientos_count: Object.keys(compIds).length,
      mediciones_count:      meds.length,
      patrones_count:        patronCount.detected,
      comportamientos:       comp,
      mediciones:            meds,
      patrones:              pats,
    };

  } catch (err: any) {
    await (admin as any).from('d2030_evidencias').update({
      estado_proc: 'error',
      error_msg:   err.message ?? String(err),
    }).eq('id', evidenciaId);

    return { ok: false, error: err.message ?? String(err) };
  }
}
