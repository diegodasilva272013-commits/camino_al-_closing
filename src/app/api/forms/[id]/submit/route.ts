import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATEGORIES: Record<string, string> = {
  cerebro_predictivo: 'Cerebro predictivo',
  cingulo: 'Cíngulo e incongruencia',
  amigdala: 'Amígdala y defensa',
  lobulo_frontal: 'Lóbulo frontal',
  rapport_falso: 'Rapport falso',
  rapport_genuino: 'Rapport genuino',
  conexion_genuina: 'Conexión genuina',
  criterio_comercial: 'Criterio comercial',
  aplicacion_practica: 'Aplicación práctica',
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Load form + questions
  const { data: form } = await (admin as any)
    .from('reinforcement_forms')
    .select('*, reinforcement_questions(*)')
    .eq('id', params.id)
    .eq('is_active', true)
    .single();

  if (!form) return NextResponse.json({ error: 'Formulario no disponible' }, { status: 404 });

  // Already submitted?
  const { data: existing } = await (admin as any)
    .from('reinforcement_submissions')
    .select('id')
    .eq('form_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: 'Ya enviaste este formulario' }, { status: 409 });

  const { answers } = await req.json() as { answers: Record<string, string> };
  const questions: any[] = (form.reinforcement_questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index);

  // Validate required questions
  for (const q of questions.filter((q: any) => q.is_required)) {
    if (!answers[q.id]?.trim() || answers[q.id].trim().length < 15) {
      return NextResponse.json({ error: `Respuesta muy corta en: "${q.question_text.slice(0, 60)}..."` }, { status: 400 });
    }
  }

  // Create submission placeholder
  const { data: sub, error: subErr } = await (admin as any)
    .from('reinforcement_submissions')
    .insert({ form_id: params.id, user_id: user.id, status: 'analyzing' })
    .select('id')
    .single();

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  // Save raw answers
  const answerRows = questions
    .filter((q: any) => answers[q.id]?.trim())
    .map((q: any) => ({ submission_id: sub.id, question_id: q.id, answer_text: answers[q.id] }));

  await (admin as any).from('reinforcement_answers').insert(answerRows);

  // Build AI prompt
  const questionsContext = questions.map((q: any, i: number) => {
    const catLabel = CATEGORIES[q.category] ?? q.category ?? '';
    const tag = q.is_bonus ? '[BONUS]' : q.is_required ? '' : '[OPCIONAL]';
    const answer = answers[q.id]?.trim() ?? '(sin respuesta)';
    return `PREGUNTA ${i + 1}${tag} [${catLabel}] ID:${q.id}
${q.question_text}
RESPUESTA: ${answer}`;
  }).join('\n\n');

  const systemPrompt = `Sos el Motor CAC — evaluador de comprensión de setters de ventas.

Formulario: "${form.title}"${form.description ? `\nDescripción: ${form.description}` : ''}
${form.topic ? `Tema: ${form.topic}` : ''}

PRINCIPIOS:
- No evaluás redacción perfecta. Evaluás comprensión real y criterio.
- Respuestas con errores de ortografía pero con ideas propias valen MÁS que respuestas perfectas que parecen copiadas de IA.
- Premiás: ejemplos concretos, lenguaje propio, conexión con situaciones reales de ventas.
- Penalizás: respuestas genéricas, definiciones de manual, frases vacías, estructura de IA.

ESCALA:
- 9-10: Comprensión profunda + ejemplos concretos + aplicación a ventas + lenguaje propio
- 7-8: Buen entendimiento, algo superficial en algún punto
- 5-6: Comprensión parcial, genérico pero no incorrecto
- 3-4: Superficial, sin ejemplos, mezcla conceptos
- 1-2: Respuesta incorrecta o no entiende el concepto
- 0: Sin respuesta o sin sentido

DETECCIÓN IA:
- "alto": Frases perfectas, estructura académica, sin errores, sin lenguaje propio, demasiado completo para alguien en entrenamiento
- "medio": Algunas frases sospechosas, cierta estructura artificial
- "bajo": Respuestas crudas, con estilo personal, con errores naturales, ejemplos del mundo real

Devolvé SOLO JSON sin comentarios:
{
  "total_score": 0-100,
  "ai_risk": "bajo|medio|alto",
  "ai_risk_reason": "...",
  "nivel_general": "principiante|en_desarrollo|intermedio|avanzado",
  "question_scores": {
    "<question_id>": {
      "score": 0-10,
      "comprension": "alta|media|baja",
      "usa_propias_palabras": true|false,
      "da_ejemplos": true|false,
      "aplica_a_ventas": true|false,
      "parece_ia": true|false,
      "feedback": "1-2 oraciones específicas en español rioplatense"
    }
  },
  "fortalezas": ["..."],
  "debilidades": ["..."],
  "conceptos_a_reforzar": ["..."],
  "alertas": ["..."],
  "feedback_general": "párrafo honesto y directo, en español rioplatense, de 3-4 oraciones",
  "ejercicios_recomendados": ["ejercicio concreto 1", "ejercicio concreto 2", "ejercicio concreto 3"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: questionsContext },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(completion.choices[0]?.message?.content ?? '{}');

    // Update scores per answer
    for (const q of questions) {
      const qs = analysis.question_scores?.[q.id];
      if (qs && answers[q.id]) {
        await (admin as any)
          .from('reinforcement_answers')
          .update({ score: qs.score, analysis: qs })
          .eq('submission_id', sub.id)
          .eq('question_id', q.id);
      }
    }

    // Update submission
    await (admin as any)
      .from('reinforcement_submissions')
      .update({
        status: 'analyzed',
        total_score: analysis.total_score,
        ai_risk: analysis.ai_risk,
        nivel_general: analysis.nivel_general,
        analysis,
      })
      .eq('id', sub.id);

    // Award XP based on score (only if not high AI risk)
    const xp = analysis.ai_risk !== 'alto' ? Math.round((analysis.total_score ?? 0) / 5) : 0;
    if (xp > 0) {
      const { data: profile } = await admin.from('profiles').select('points').eq('id', user.id).single();
      await admin.from('profiles').update({ points: ((profile as any)?.points ?? 0) + xp } as any).eq('id', user.id);
    }

    return NextResponse.json({ submission_id: sub.id, analysis, xp_earned: xp });
  } catch (err: any) {
    await (admin as any).from('reinforcement_submissions').update({ status: 'error' }).eq('id', sub.id);
    return NextResponse.json({ error: err.message ?? 'Error al analizar' }, { status: 500 });
  }
}
