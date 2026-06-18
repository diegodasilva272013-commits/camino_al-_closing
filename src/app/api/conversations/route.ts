import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ANALYSIS_SYSTEM = `Sos el Motor CAC — sistema de análisis de conversaciones de ventas de Camino al Closing.

Tu trabajo: analizar una conversación real entre un setter CAC y un prospecto, y devolver un diagnóstico profesional, honesto y sin filtros.

FILOSOFÍA CAC:
No formamos vendedores. Formamos solucionadores de problemas. No entrenamos respuestas. Entrenamos pensamiento comercial. Premiamos criterio, no actividad. Conversaciones que generan confianza, respetan la oferta y protegen la marca.

Analizar en estas 8 dimensiones:
- intención (claridad del objetivo de la conversación)
- rapport (conexión humana antes del pitch)
- empatia_profesional (entender el mundo del prospecto sin perder el foco)
- diagnostico (preguntas que descubren el problema real)
- generacion_interes (capacidad de crear deseo sin presión)
- seguimiento (manejo de silencios, vistas, demoras)
- profesionalismo (tono, límites, manejo de la marca)
- criterio (decisiones tomadas en tiempo real)

Devolvé JSON con este formato exacto:
{
  "resultado_probable": "una frase corta: ej. 'Quedó en visto', 'Generó reunión', 'Prospecto desapareció', 'Se bloqueó', 'Terminó sin avance'",
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "errores": ["error 1", "error 2", "error 3"],
  "momento_gano_confianza": "descripción exacta del momento o 'No hubo momento claro'",
  "momento_perdio_confianza": "descripción exacta del momento o 'No se detectó pérdida'",
  "donde_se_rompio": "descripción del punto de quiebre o 'No hubo ruptura visible'",
  "capacidades_impactadas": {
    "intencion": "alta | media | baja | no_mostrada",
    "rapport": "alta | media | baja | no_mostrada",
    "empatia_profesional": "alta | media | baja | no_mostrada",
    "diagnostico": "alta | media | baja | no_mostrada",
    "generacion_interes": "alta | media | baja | no_mostrada",
    "seguimiento": "alta | media | baja | no_mostrada",
    "profesionalismo": "alta | media | baja | no_mostrada",
    "criterio": "alta | media | baja | no_mostrada"
  },
  "que_haria_operador_cac": "párrafo de 2-3 oraciones: qué habría hecho diferente un operador CAC experimentado"
}`;

// GET — list user's analyses
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data } = await (admin as any)
    .from('conversation_analyses')
    .select('id, status, created_at, analysis')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Enrich with reflection status
  const ids = (data ?? []).map((r: any) => r.id);
  let reflMap = new Map<string, any>();
  if (ids.length) {
    const { data: refs } = await (admin as any)
      .from('conversation_reflections')
      .select('analysis_id, status, xp_earned')
      .in('analysis_id', ids);
    for (const r of refs ?? []) reflMap.set(r.analysis_id, r);
  }

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    reflection: reflMap.get(r.id) ?? null,
  }));

  return NextResponse.json(rows);
}

// POST — analyze a new conversation
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { raw_text } = await req.json();
  if (!raw_text?.trim()) return NextResponse.json({ error: 'Conversación vacía' }, { status: 400 });
  if (raw_text.length > 30000) return NextResponse.json({ error: 'Conversación demasiado larga (máximo 30.000 caracteres)' }, { status: 400 });

  const admin = createSupabaseAdminClient();

  // Insert placeholder
  const { data: inserted, error: insErr } = await (admin as any)
    .from('conversation_analyses')
    .insert({ user_id: user.id, raw_text, status: 'analyzing' })
    .select('id')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const id = inserted.id;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM },
        { role: 'user', content: `Analizá esta conversación:\n\n${raw_text}` },
      ],
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(completion.choices[0]?.message?.content ?? '{}');

    await (admin as any)
      .from('conversation_analyses')
      .update({ analysis, status: 'ready' })
      .eq('id', id);

    return NextResponse.json({ id, analysis });
  } catch (err: any) {
    await (admin as any).from('conversation_analyses').update({ status: 'error' }).eq('id', id);
    return NextResponse.json({ error: err.message ?? 'Error al analizar' }, { status: 500 });
  }
}
