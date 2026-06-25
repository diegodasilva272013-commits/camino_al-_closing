import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { buildConversationAnalysisPrompt, type CapEntry } from '@/lib/motor-cac-extractor';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  // Cargar capacidades activas desde DB (fuente de verdad — ninguna lista fija)
  const { data: capsRaw } = await (admin as any)
    .from('capacidades')
    .select('id, clave, nombre, claves_alias')
    .eq('activo', true)
    .order('orden');

  const caps: CapEntry[] = (capsRaw ?? []).map((c: any) => ({
    id:           c.id,
    clave:        c.clave ?? null,
    nombre:       c.nombre,
    claves_alias: c.claves_alias ?? [],
  }));

  const analysisSystem = buildConversationAnalysisPrompt(caps);

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
        { role: 'system', content: analysisSystem },
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

    // Auto-trigger Motor B (fire-and-forget — no bloquea la respuesta al setter)
    const motorUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/evolucion/motor/run`;
    fetch(motorUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ user_id: user.id }),
    }).catch(() => {}); // errores silenciosos — el motor se puede correr manualmente

    return NextResponse.json({ id, analysis });
  } catch (err: any) {
    await (admin as any).from('conversation_analyses').update({ status: 'error' }).eq('id', id);
    return NextResponse.json({ error: err.message ?? 'Error al analizar' }, { status: 500 });
  }
}
