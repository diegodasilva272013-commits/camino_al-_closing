import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  // Solo llamable internamente (desde submit) o desde cron
  const internalKey = req.headers.get('x-internal-key');
  if (internalKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { submission_id, user_id } = await req.json() as { submission_id: string; user_id: string };
  if (!submission_id || !user_id) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const admin = createSupabaseAdminClient();

  // Cargar submission + respuestas + preguntas + formulario
  const { data: sub } = await (admin as any)
    .from('reinforcement_submissions')
    .select('id, status, reinforcement_forms(id, title, description, topic, reinforcement_questions(*))')
    .eq('id', submission_id)
    .single();

  if (!sub || sub.status === 'analyzed') return NextResponse.json({ ok: true, skipped: true });

  const form = sub.reinforcement_forms;
  const questions: any[] = (form?.reinforcement_questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index);

  const { data: answerRows } = await (admin as any)
    .from('reinforcement_answers')
    .select('question_id, answer_text')
    .eq('submission_id', submission_id);

  const answers: Record<string, string> = {};
  for (const row of answerRows ?? []) answers[row.question_id] = row.answer_text;

  const questionsContext = questions.map((q: any, i: number) => {
    const catLabel = CATEGORIES[q.category] ?? q.category ?? '';
    const tag = q.is_bonus ? '[BONUS]' : q.is_required ? '' : '[OPCIONAL]';
    return `PREGUNTA ${i + 1}${tag} [${catLabel}] ID:${q.id}
${q.question_text}
RESPUESTA: ${answers[q.id]?.trim() ?? '(sin respuesta)'}`;
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

    // Actualizar score por respuesta
    for (const q of questions) {
      const qs = analysis.question_scores?.[q.id];
      if (qs && answers[q.id]) {
        await (admin as any)
          .from('reinforcement_answers')
          .update({ score: qs.score, analysis: qs })
          .eq('submission_id', submission_id)
          .eq('question_id', q.id);
      }
    }

    // Actualizar submission con resultado final
    await (admin as any)
      .from('reinforcement_submissions')
      .update({
        status: 'analyzed',
        total_score: analysis.total_score,
        ai_risk: analysis.ai_risk,
        nivel_general: analysis.nivel_general,
        analysis,
      })
      .eq('id', submission_id);

    // Sumar XP al setter (no si riesgo IA alto)
    const xp = analysis.ai_risk !== 'alto' ? Math.round((analysis.total_score ?? 0) / 5) : 0;
    if (xp > 0) {
      const { data: profile } = await admin.from('profiles').select('points').eq('id', user_id).single();
      await admin.from('profiles').update({ points: ((profile as any)?.points ?? 0) + xp } as any).eq('id', user_id);
    }

    // Auto-trigger Motor B (fire-and-forget)
    const motorUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/evolucion/motor/run`;
    fetch(motorUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ user_id }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, submission_id, xp_earned: xp });
  } catch (err: any) {
    await (admin as any)
      .from('reinforcement_submissions')
      .update({ status: 'error' })
      .eq('id', submission_id);
    return NextResponse.json({ error: err.message ?? 'Error al analizar' }, { status: 500 });
  }
}
