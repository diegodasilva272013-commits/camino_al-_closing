import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Mode = 'fria' | 'tibia' | 'caliente';
type History = OpenAI.Chat.ChatCompletionMessageParam[];

const sessions = new Map<string, History>();

async function loadBrain(mode: Mode) {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: brain }, { data: files }] = await Promise.all([
      supabase.from('trainer_brain').select('*').eq('id', 1).maybeSingle(),
      supabase.from('trainer_files').select('content_text').order('created_at'),
    ]);
    const modePrompt = brain
      ? (mode === 'fria' ? brain.mode_fria : mode === 'tibia' ? brain.mode_tibia : brain.mode_caliente)
      : '';
    const filesText = (files ?? []).map((f: { content_text: string }) => f.content_text).filter(Boolean).join('\n\n---\n\n');
    return { basePrompt: brain?.base_prompt ?? '', rules: brain?.rules ?? '', modePrompt, filesText };
  } catch {
    return { basePrompt: '', rules: '', modePrompt: '', filesText: '' };
  }
}

function buildSystemPrompt(mode: Mode, brain: Awaited<ReturnType<typeof loadBrain>>) {
  const modeLabel = { fria: 'FRÍA', tibia: 'TIBIA', caliente: 'CALIENTE' }[mode];
  const modeDesc = {
    fria: 'El prospecto no te conoce, nunca tuvo contacto con CAC. Actitud escéptica o indiferente al principio.',
    tibia: 'El prospecto tiene algún contacto previo (vio algo en redes, lo referenciaron, abrió un email). Curioso pero con dudas.',
    caliente: 'El prospecto ya mostró interés activo. Está cerca de cerrar pero tiene objeciones finales o necesita el último empujón.',
  }[mode];

  const parts = [
    `Sos un prospecto real de WhatsApp en una simulación de entrenamiento para setters de ventas de Camino al Closing (CAC).`,
    `MODO: PROSPECCIÓN ${modeLabel}`,
    `CONTEXTO DEL MODO: ${modeDesc}`,
    brain.basePrompt ? `\nINSTRUCCIONES BASE DEL ENTRENADOR:\n${brain.basePrompt}` : '',
    brain.rules ? `\nREGLAS GENERALES:\n${brain.rules}` : '',
    brain.modePrompt ? `\nINSTRUCCIONES ESPECÍFICAS PARA ESTE MODO:\n${brain.modePrompt}` : '',
    brain.filesText ? `\n════ METODOLOGÍA CAC — DOCUMENTOS OFICIALES ════\n${brain.filesText}\n════ FIN DOCUMENTOS ════` : '',
    brain.filesText ? `\nREGLA ABSOLUTA SOBRE LOS DOCUMENTOS CAC:
- Los documentos de arriba contienen la metodología exacta de Camino al Closing.
- Como prospecto: reaccioná de forma más favorable cuando el setter aplica correctamente las técnicas CAC descritas. Si las ignora o las usa mal, respondé con más resistencia o frialdad.
- Cuando el setter escribe "evaluame": salís del personaje y evaluás EXCLUSIVAMENTE usando los documentos CAC como marco de referencia. Cita conceptos específicos del material ("usaste bien el X", "te faltó aplicar el Y que está en el documento Z"). Prohibido evaluar con frameworks genéricos de ventas que no sean CAC.
- Si no hay documentos cargados: evaluá según las instrucciones base del entrenador.` : '',
    `\nINSTRUCCIONES SIEMPRE ACTIVAS:
- Respondé SIEMPRE en español rioplatense, como un prospecto real de WhatsApp.
- Mensajes CORTOS (1-3 oraciones máximo). Sin saludos formales.
- Nunca rompas el personaje ni digas que sos una IA.
- Cuando el setter escribe "evaluame": salís del personaje para dar feedback específico basado en metodología CAC y luego volvés al personaje.
- Cuando el setter escribe "EVOLUCIÓN": proponé un escenario más desafiante del mismo modo.
- Si el setter manda el primer mensaje "INICIO SIMULACIÓN": presentate como el prospecto según tu modo y dá el primer mensaje de apertura realista.`,
  ].filter(Boolean);

  return parts.join('\n');
}

async function saveToDb(sessionDbId: string, message: string, reply: string) {
  try {
    const admin = createSupabaseAdminClient();
    const isEval = /evaluame/i.test(message);

    await (admin as any).from('trainer_messages').insert([
      { session_id: sessionDbId, role: 'user', content: message, is_evaluation: false },
      { session_id: sessionDbId, role: 'assistant', content: reply, is_evaluation: isEval },
    ]);

    const { data: sess } = await (admin as any)
      .from('trainer_sessions')
      .select('message_count, evaluations_count')
      .eq('id', sessionDbId)
      .single();

    await (admin as any).from('trainer_sessions').update({
      message_count: (sess?.message_count ?? 0) + 2,
      ...(isEval
        ? { evaluations_count: (sess?.evaluations_count ?? 0) + 1, last_evaluation: reply }
        : {}),
    }).eq('id', sessionDbId);
  } catch {
    /* best-effort — never crash the chat */
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, sessionDbId, message, mode } = await req.json() as {
      sessionId: string;
      sessionDbId?: string;
      message: string;
      mode: Mode;
    };

    if (!sessions.has(sessionId)) sessions.set(sessionId, []);
    const history = sessions.get(sessionId)!;
    history.push({ role: 'user', content: message });

    const brain = await loadBrain(mode);
    const systemPrompt = buildSystemPrompt(mode, brain);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      temperature: 0.85,
      max_tokens: 250,
    });

    const reply = completion.choices[0]?.message?.content ?? '';
    history.push({ role: 'assistant', content: reply });

    if (sessionDbId) void saveToDb(sessionDbId, message, reply);

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
