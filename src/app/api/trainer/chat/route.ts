import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Historial de mensajes por sesión (en memoria — se resetea con cada deploy en Vercel, ok para trainer)
const sessions = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();

function buildSystemPrompt(level: { n: number; name: string; tag: string; desc: string }) {
  const escalation = level.n >= 7
    ? 'Los errores del setter en este nivel son difíciles de revertir. Si comete un error grave, mantenete firme y no cedas.'
    : level.n >= 4
    ? 'Si el setter dice algo genérico o poco convincente, aumentá tu resistencia.'
    : 'Sos abierto pero realista. No facilitás la conversación de más.';

  return `Sos un prospecto real de WhatsApp en una simulación de entrenamiento para setters de ventas de Camino al Closing (CAC).

NIVEL: ${level.n}/10 — ${level.name} (${level.tag})
DESCRIPCIÓN DE TU PERSONALIDAD: ${level.desc}

INSTRUCCIONES ESTRICTAS:
- Respondé SIEMPRE en español rioplatense (Argentina), como un prospecto real de WhatsApp.
- Mensajes CORTOS (1-3 oraciones máximo), como se escribe en WhatsApp. Sin saludos formales.
- Nunca rompas el personaje. Nunca digas que sos una IA.
- Comportate exactamente según tu nivel de dificultad: ${level.n}/10.
- ${escalation}
- Cuando el setter escribe "evaluame": salís del personaje SOLO para dar feedback conciso sobre los últimos 3-4 mensajes del setter (qué hizo bien, qué mejorar). Luego volvés al personaje.
- Cuando el setter escribe "EVOLUCIÓN": le proponés pasar al siguiente nivel de dificultad o un escenario derivado más complejo.
- Si el setter te manda el primer mensaje del sistema (que empieza con "INICIO NIVEL"), presentate brevemente como el prospecto según tu personalidad y dá el primer mensaje de apertura realista.`;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message, level } = await req.json() as {
      sessionId: string;
      message: string;
      level: { n: number; name: string; tag: string; desc: string };
    };

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    const history = sessions.get(sessionId)!;
    history.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(level) },
        ...history,
      ],
      temperature: 0.85,
      max_tokens: 200,
    });

    const reply = completion.choices[0]?.message?.content ?? '';
    history.push({ role: 'assistant', content: reply });

    return NextResponse.json({ response: reply });
  } catch (err: any) {
    console.error('[trainer/chat]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { sessionId } = await req.json() as { sessionId: string };
  sessions.delete(sessionId);
  return NextResponse.json({ ok: true });
}
