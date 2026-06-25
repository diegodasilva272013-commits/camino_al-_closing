/**
 * Motor CAC — Extractor de comportamientos
 * Lógica pura de transformación: recibe datos crudos, devuelve filas para insertar.
 * Sin I/O directo — el endpoint hace las queries, este módulo transforma.
 */

import OpenAI from 'openai';

// ── Umbrales configurables ────────────────────────────────────────────────────
// Formularios: score mínimo para generar comportamiento positivo
export const SCORE_POSITIVO = 80;
// Formularios: score máximo para generar comportamiento negativo
export const SCORE_NEGATIVO = 60;
// Entre SCORE_NEGATIVO y SCORE_POSITIVO: zona gris — no genera comportamiento

// ── Tipos internos ────────────────────────────────────────────────────────────
export interface CapEntry {
  id: string;
  clave: string | null;
  nombre: string;
  claves_alias: string[];
}

export interface BehaviorRow {
  evidencia_id: string;
  persona_id:   string;
  capacidad_id: string | null;
  etiqueta:     string;
  tipo:         'positivo' | 'negativo';
  registrado_por: 'ia';
  razonamiento:  string;
}

// ── Construcción del mapa de lookup ──────────────────────────────────────────
// Devuelve dos mapas:
//   capMap:     key/alias → capacidad_id
//   capNameMap: capacidad_id → nombre legible
export function buildCapMaps(caps: CapEntry[]): {
  capMap:     Map<string, string>;
  capNameMap: Map<string, string>;
} {
  const capMap     = new Map<string, string>();
  const capNameMap = new Map<string, string>();

  for (const c of caps) {
    capNameMap.set(c.id, c.nombre);
    if (c.clave) capMap.set(c.clave, c.id);
    for (const alias of c.claves_alias ?? []) capMap.set(alias, c.id);
  }

  return { capMap, capNameMap };
}

// ── Extractor: conversation_analyses ─────────────────────────────────────────
// Solo procesa señales claras (alta/baja). Media y no_mostrada = skip.
export function extractFromConversation(
  analysis:   any,
  capMap:     Map<string, string>,
  capNameMap: Map<string, string>,
  evidenciaId: string,
  personaId:   string,
  fecha:       string,
): BehaviorRow[] {
  const resultado     = String(analysis.resultado_probable ?? '');
  const dondeSeRompio = String(analysis.donde_se_rompio   ?? '');
  const rows: BehaviorRow[] = [];

  for (const [key, level] of Object.entries(analysis.capacidades_impactadas ?? {})) {
    const levelStr = String(level);
    if (levelStr !== 'alta' && levelStr !== 'baja') continue;

    const capId = capMap.get(key);
    if (!capId) continue; // clave desconocida — se ignora, no torcemos la evolución

    const capNombre = capNameMap.get(capId) ?? key;
    const tipo      = levelStr === 'alta' ? 'positivo' : 'negativo';

    rows.push({
      evidencia_id:   evidenciaId,
      persona_id:     personaId,
      capacidad_id:   capId,
      etiqueta:       `${capNombre}: nivel ${levelStr === 'alta' ? 'alto' : 'bajo'}`,
      tipo,
      registrado_por: 'ia',
      razonamiento:   tipo === 'positivo'
        ? `Capacidad "${capNombre}" mostrada en nivel alto (${fecha}). Resultado: ${resultado || 'sin datos'}.`
        : `Capacidad "${capNombre}" en nivel bajo (${fecha}). Quiebre: ${dondeSeRompio || 'no detectado'}. Resultado: ${resultado || 'sin datos'}.`,
    });
  }

  return rows;
}

// ── Extractor: trainer_sessions (requiere AI) ─────────────────────────────────
// Llama a GPT-4o-mini para parsear el texto de evaluación del trainer.
export async function extractFromTrainerSession(
  evaluationText: string,
  capNameMap:     Map<string, string>,
  evidenciaId:    string,
  personaId:      string,
  fecha:          string,
  openai:         OpenAI,
): Promise<BehaviorRow[]> {
  const capacidadNames = Array.from(new Set(Array.from(capNameMap.values())));

  const prompt = `Analizá esta evaluación de sesión de entrenamiento CAC y extraé los comportamientos comerciales observados.

CAPACIDADES CAC VÁLIDAS (solo estas, ninguna más):
${capacidadNames.join(', ')}

EVALUACIÓN:
${evaluationText.slice(0, 2000)}

Devolvé JSON exacto:
{
  "comportamientos": [
    {
      "capacidad": "<nombre exacto de una de las capacidades de la lista>",
      "tipo": "positivo",
      "etiqueta": "<descripción corta del comportamiento, máx 80 chars>",
      "razonamiento": "<qué parte de la evaluación lo indica, máx 150 chars>"
    }
  ]
}

Reglas:
- Solo incluí comportamientos con evidencia explícita en el texto.
- Si algo no mapea a una de las 9 capacidades, no lo incluyas.
- Máximo 5 comportamientos.
- Si no hay comportamientos claros, devolvé {"comportamientos": []}.`;

  try {
    const completion = await openai.chat.completions.create({
      model:           'gpt-4o-mini',
      messages:        [{ role: 'user', content: prompt }],
      temperature:     0.2,
      max_tokens:      600,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    const nameToId = new Map(Array.from(capNameMap.entries()).map(([id, name]) => [name, id]));

    return (result.comportamientos ?? [])
      .filter((b: any) => b.capacidad && b.tipo && b.etiqueta)
      .map((b: any): BehaviorRow | null => {
        const capId = nameToId.get(b.capacidad);
        if (!capId) return null;
        return {
          evidencia_id:   evidenciaId,
          persona_id:     personaId,
          capacidad_id:   capId,
          etiqueta:       String(b.etiqueta).slice(0, 80),
          tipo:           b.tipo === 'positivo' ? 'positivo' : 'negativo',
          registrado_por: 'ia',
          razonamiento:   String(b.razonamiento ?? '').slice(0, 300),
        };
      })
      .filter((b: BehaviorRow | null): b is BehaviorRow => b !== null);
  } catch {
    return [];
  }
}

// ── Builder: prompt dinámico de análisis de conversaciones ────────────────────
// Genera el ANALYSIS_SYSTEM leyendo las capacidades activas desde DB.
export function buildConversationAnalysisPrompt(caps: CapEntry[]): string {
  const dimensiones = caps
    .filter(c => c.clave)
    .map(c => `- ${c.clave} (${c.nombre})`)
    .join('\n');

  const capSchema = caps
    .filter(c => c.clave)
    .map(c => `    "${c.clave}": "alta | media | baja | no_mostrada"`)
    .join(',\n');

  return `Sos el Motor CAC — sistema de análisis de conversaciones de ventas de Camino al Closing.

Tu trabajo: analizar una conversación real entre un setter CAC y un prospecto, y devolver un diagnóstico profesional, honesto y sin filtros.

FILOSOFÍA CAC:
No formamos vendedores. Formamos solucionadores de problemas. No entrenamos respuestas. Entrenamos pensamiento comercial. Premiamos criterio, no actividad. Conversaciones que generan confianza, respetan la oferta y protegen la marca.

Analizá en estas ${caps.length} dimensiones:
${dimensiones}

Devolvé JSON con este formato exacto:
{
  "resultado_probable": "una frase corta: ej. 'Quedó en visto', 'Generó reunión', 'Prospecto desapareció'",
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "errores": ["error 1", "error 2", "error 3"],
  "momento_gano_confianza": "descripción exacta del momento o 'No hubo momento claro'",
  "momento_perdio_confianza": "descripción exacta del momento o 'No se detectó pérdida'",
  "donde_se_rompio": "descripción del punto de quiebre o 'No hubo ruptura visible'",
  "capacidades_impactadas": {
${capSchema}
  },
  "que_haria_operador_cac": "párrafo de 2-3 oraciones: qué habría hecho diferente un operador CAC experimentado"
}`;
}
