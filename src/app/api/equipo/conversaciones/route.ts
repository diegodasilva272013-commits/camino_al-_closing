import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { buildConversationAnalysisPrompt, type CapEntry } from '@/lib/motor-cac-extractor';

export const dynamic = 'force-dynamic';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getTeam(userId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from('setter_teams')
    .select('id, setter1_id, setter2_id')
    .or(`setter1_id.eq.${userId},setter2_id.eq.${userId}`)
    .single();
  return data;
}

// GET — lista de conversaciones del equipo
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const team = await getTeam(user.id);
  if (!team) return NextResponse.json([]);

  const admin = createSupabaseAdminClient() as any;

  const { data: analyses } = await admin
    .from('team_conversation_analyses')
    .select('id, submitted_by, status, created_at, analysis')
    .eq('team_id', team.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const ids = (analyses ?? []).map((r: any) => r.id);
  let reflMap = new Map<string, any>();
  if (ids.length) {
    const { data: refs } = await admin
      .from('team_conversation_reflections')
      .select('analysis_id, user_id, status, xp_earned')
      .in('analysis_id', ids);
    for (const r of refs ?? []) reflMap.set(`${r.analysis_id}:${r.user_id}`, r);
  }

  // Obtener nombres de los que enviaron
  const submitterIds = [...new Set((analyses ?? []).map((a: any) => a.submitted_by).filter(Boolean))];
  const { data: submitters } = submitterIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', submitterIds)
    : { data: [] };
  const nameMap = new Map((submitters ?? []).map((p: any) => [p.id, p.full_name]));

  const rows = (analyses ?? []).map((r: any) => ({
    ...r,
    submitted_by_name: nameMap.get(r.submitted_by) ?? null,
    my_reflection:     reflMap.get(`${r.id}:${user.id}`) ?? null,
  }));

  return NextResponse.json(rows);
}

// POST — analizar conversación del equipo (mismo prompt que módulo individual)
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const team = await getTeam(user.id);
  if (!team) return NextResponse.json({ error: 'No estás en ningún equipo' }, { status: 403 });

  const { raw_text } = await req.json();
  if (!raw_text?.trim()) return NextResponse.json({ error: 'Conversación vacía' }, { status: 400 });
  if (raw_text.length > 30000) return NextResponse.json({ error: 'Máximo 30.000 caracteres' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;

  const { data: capsRaw } = await admin
    .from('capacidades')
    .select('id, clave, nombre, claves_alias')
    .eq('activo', true)
    .order('orden');

  const caps: CapEntry[] = (capsRaw ?? []).map((c: any) => ({
    id: c.id, clave: c.clave ?? null, nombre: c.nombre, claves_alias: c.claves_alias ?? [],
  }));

  const { data: inserted, error: insErr } = await admin
    .from('team_conversation_analyses')
    .insert({ team_id: team.id, submitted_by: user.id, raw_text, status: 'analyzing' })
    .select('id')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const id = inserted.id;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildConversationAnalysisPrompt(caps) },
        { role: 'user',   content: `Analizá esta conversación:\n\n${raw_text}` },
      ],
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    await admin.from('team_conversation_analyses').update({ analysis, status: 'ready' }).eq('id', id);
    return NextResponse.json({ id, analysis });
  } catch (err: any) {
    await admin.from('team_conversation_analyses').update({ status: 'error' }).eq('id', id);
    return NextResponse.json({ error: err.message ?? 'Error al analizar' }, { status: 500 });
  }
}
