import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EVAL_SYSTEM = `Sos el Motor CAC evaluando la reflexión de un setter sobre su propia conversación.

Principio: NO evaluás redacción. Evaluás comprensión real, criterio y capacidad de análisis comercial.

DETECCIÓN DE COPIA:
- copia_detectada: el setter copió frases enteras del análisis
- copia_parcial: copió ideas con sus palabras pero sin elaborar nada propio
- intento_engano: respuestas vacías, sin sentido, inventadas, o completamente off-topic

EVALUACIÓN (aplica si no hay copia total ni intento de engaño):
- profundidad: "superficial" (repite lo obvio sin conectar), "adecuada" (entiende lo que pasó), "profunda" (conecta causas, ve patrones, aprendizaje real)
- coherencia: las respuestas son consistentes con lo que realmente pasó en la conversación
- comprension_conceptual: demuestra entender conceptos CAC (rapport, criterio, diagnóstico, empatía profesional)
- capacidad_analisis: "baja" | "media" | "alta"

PUNTOS:
- xp_base: 15 si reflexión aprobada
- xp_comprension: 10 si profundidad === "profunda"
- xp_identificacion: 10 si identificó correctamente el error más grave
- xp_aprendizaje: 10 si articuló concretamente qué va a cambiar
- xp_penalty: 15 si solo copia_parcial, 30 si copia_detectada o intento_engano
- xp_total: max(0, xp_base + xp_comprension + xp_identificacion + xp_aprendizaje - xp_penalty)
- Si aprobada === false → xp_total = 0

Rechazar si: copia_detectada === true, intento_engano === true, o (profundidad === "superficial" y coherencia === false).

Devolvé JSON:
{
  "copia_detectada": boolean,
  "copia_parcial": boolean,
  "intento_engano": boolean,
  "profundidad": "superficial | adecuada | profunda",
  "coherencia": boolean,
  "comprension_conceptual": boolean,
  "capacidad_analisis": "baja | media | alta",
  "xp_base": number,
  "xp_comprension": number,
  "xp_identificacion": number,
  "xp_aprendizaje": number,
  "xp_penalty": number,
  "xp_total": number,
  "aprobada": boolean,
  "feedback": "párrafo honesto al setter en español rioplatense",
  "razon_rechazo": "explicación si aprobada === false, null si fue aprobada"
}`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: ca } = await (admin as any)
    .from('conversation_analyses')
    .select('id, user_id, analysis, status')
    .eq('id', params.id)
    .single();

  if (!ca) return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
  if (ca.user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (ca.status !== 'ready') return NextResponse.json({ error: 'El análisis no está listo' }, { status: 400 });

  const { data: existing } = await (admin as any)
    .from('conversation_reflections')
    .select('id, status, xp_earned, evaluation')
    .eq('analysis_id', params.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ already: true, existing }, { status: 409 });

  const { answers } = await req.json() as { answers: Record<string, string> };

  const required = ['que_ocurrio', 'donde_se_rompio', 'que_hiciste_bien', 'que_hiciste_mal', 'que_aprendiste', 'que_aplicaras'];
  for (const f of required) {
    if (!answers[f]?.trim() || answers[f].trim().length < 20) {
      return NextResponse.json({ error: `Respuesta muy corta en "${f}". Mínimo 20 caracteres por pregunta.` }, { status: 400 });
    }
  }

  const analysisText = JSON.stringify(ca.analysis, null, 2);
  const answersText = [
    `¿Qué ocurrió?: ${answers.que_ocurrio}`,
    `¿Dónde se rompió?: ${answers.donde_se_rompio}`,
    `¿Qué hiciste bien?: ${answers.que_hiciste_bien}`,
    `¿Qué hiciste mal?: ${answers.que_hiciste_mal}`,
    `¿Qué aprendiste?: ${answers.que_aprendiste}`,
    `¿Qué aplicarás?: ${answers.que_aplicaras}`,
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EVAL_SYSTEM },
        { role: 'user', content: `ANÁLISIS DEL MOTOR CAC:\n${analysisText}\n\nREFLEXIÓN DEL SETTER:\n${answersText}` },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const evaluation = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    const xp_earned: number = Math.max(0, evaluation.xp_total ?? 0);
    const status = evaluation.aprobada ? 'approved' : 'rejected';

    await (admin as any)
      .from('conversation_reflections')
      .insert({ analysis_id: params.id, user_id: user.id, answers, evaluation, xp_earned, status });

    if (xp_earned > 0) {
      const { data: profile } = await admin.from('profiles').select('points').eq('id', user.id).single();
      await admin.from('profiles')
        .update({ points: ((profile as any)?.points ?? 0) + xp_earned } as any)
        .eq('id', user.id);
    }

    return NextResponse.json({ evaluation, xp_earned, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al evaluar' }, { status: 500 });
  }
}
