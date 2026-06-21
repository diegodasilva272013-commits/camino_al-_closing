import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(_req: Request, { params }: { params: { lead_id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  try {
    // Get conversation
    const { data: conv } = await (admin as any)
      .from('prospecting_conversations')
      .select('id, lead_id, setter_id')
      .eq('lead_id', params.lead_id)
      .eq('setter_id', user.id)
      .maybeSingle();

    if (!conv) return NextResponse.json({ error: 'No hay conversación para este lead' }, { status: 404 });

    // Get messages
    const { data: messages } = await (admin as any)
      .from('prospecting_conversation_messages')
      .select('direction, body, sent_at')
      .eq('conversation_id', conv.id)
      .order('sent_at', { ascending: true });

    const msgs: any[] = messages ?? [];
    if (msgs.length === 0) return NextResponse.json({ error: 'La conversación está vacía. Registrá al menos un mensaje enviado.' }, { status: 400 });

    // Build conversation text
    const convText = msgs
      .map(m => `[${m.direction === 'outbound' ? 'SETTER' : 'LEAD'}]: ${m.body}`)
      .join('\n');

    const systemPrompt = `Sos el Evaluador del Entrenador CAC (Camino al Closing).
Evaluá esta conversación de prospección en frío con criterio profesional y sin condescendencia.

FILOSOFÍA CAC — lo que evaluás:
- Apertura sin sonar vendedor genérico
- Conexión genuina (no rapport de manual)
- Manejo de defensa (sin presionar, sin "te entiendo" vacío)
- Calidad de preguntas (criterio comercial, no interrogatorio)
- Rapport real (interés genuino por la persona)
- Avance natural hacia el diagnóstico o llamada
- Evitar frases de "coach de ventas barato"
- Criterio comercial (¿supo leer al lead?)

Cada score es de 0 a 10. Respondé SOLO en JSON con este formato exacto:
{
  "score_total": number,
  "score_opening": number,
  "score_connection": number,
  "score_questions": number,
  "score_defense_handling": number,
  "score_rapport": number,
  "score_advance": number,
  "score_commercial_criteria": number,
  "summary": "1-2 oraciones directas sobre esta conversación",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "weaknesses": ["debilidad 1", "debilidad 2"],
  "mistakes": ["error 1"],
  "recommendations": ["recomendación específica 1", "recomendación 2"],
  "next_exercise": "ejercicio concreto para trabajar el punto más débil"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Evaluá esta conversación:\n\n${convText}` },
      ],
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const evaluation = JSON.parse(raw);

    // Save evaluation
    const { data: saved, error } = await (admin as any)
      .from('ai_prospecting_evaluations')
      .insert({
        conversation_id: conv.id,
        setter_id: user.id,
        lead_id: params.lead_id,
        score_total:              evaluation.score_total,
        score_opening:            evaluation.score_opening,
        score_connection:         evaluation.score_connection,
        score_questions:          evaluation.score_questions,
        score_defense_handling:   evaluation.score_defense_handling,
        score_rapport:            evaluation.score_rapport,
        score_advance:            evaluation.score_advance,
        score_commercial_criteria: evaluation.score_commercial_criteria,
        summary:         evaluation.summary,
        strengths:       evaluation.strengths ?? [],
        weaknesses:      evaluation.weaknesses ?? [],
        mistakes:        evaluation.mistakes ?? [],
        recommendations: evaluation.recommendations ?? [],
        next_exercise:   evaluation.next_exercise,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
