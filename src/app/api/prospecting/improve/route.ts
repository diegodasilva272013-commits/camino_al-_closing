import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { message, lead_name, lead_country, lead_notes, setter_name } = body;

  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });

  const prompt = `Sos el Entrenador CAC. Un setter quiere mejorar su mensaje de prospección en frío.

CONTEXTO DEL LEAD:
- Nombre: ${lead_name ?? 'desconocido'}
- País: ${lead_country ?? 'desconocido'}
- Notas: ${lead_notes ?? 'ninguna'}

SETTER: ${setter_name ?? 'el setter'}

MENSAJE ACTUAL:
${message.trim()}

FILOSOFÍA CAC — lo que NO debe hacer este mensaje:
- Sonar como vendedor genérico
- Presionar o apresurar
- Usar "te entiendo" vacío
- Prometer resultados irreales
- Forzar llamada o cierre
- Ser demasiado largo

FILOSOFÍA CAC — lo que SÍ debe hacer:
- Sonar natural, humano, sin guión obvio
- Generar curiosidad genuina
- Abrir conversación, no cerrar venta
- Respetar al lead como persona inteligente
- Ser breve (máximo 3-4 líneas)

Generá EXACTAMENTE 3 variantes del mensaje. Cada una debe ser notablemente diferente.
Respondé SOLO en JSON:
{
  "variantes": [
    { "tono": "directo y humano", "mensaje": "..." },
    { "tono": "curioso y consultivo", "mensaje": "..." },
    { "tono": "profesional y breve", "mensaje": "..." }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(raw);
    return NextResponse.json({ variantes: result.variantes ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error de IA' }, { status: 500 });
  }
}
