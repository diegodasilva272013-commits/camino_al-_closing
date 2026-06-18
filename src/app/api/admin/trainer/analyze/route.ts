import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: myProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (myProfile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 });

    // Cargar perfil del usuario analizado
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user_id)
      .single();

    const userName = targetProfile?.full_name ?? targetProfile?.email ?? 'Usuario';

    // Cargar cerebro del trainer
    const { data: brain } = await (admin as any)
      .from('trainer_brain')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    // Cargar todas las sesiones + mensajes del usuario
    const { data: sessions } = await (admin as any)
      .from('trainer_sessions')
      .select('id, scenario_name, scenario_group, scenario_tag, difficulty, started_at, ended_at, message_count, evaluations_count, trainer_messages(role, content, is_evaluation, created_at)')
      .eq('user_id', user_id)
      .order('started_at', { ascending: true })
      .limit(50);

    const allSessions: any[] = sessions ?? [];

    if (!allSessions.length) {
      return NextResponse.json({ error: 'Este usuario no tiene sesiones de entrenamiento todavía.' }, { status: 400 });
    }

    // Armar contexto de conversaciones
    const conversationContext = allSessions.map((s: any, i: number) => {
      const msgs: any[] = (s.trainer_messages ?? [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const dialogue = msgs
        .filter((m: any) => !m.is_evaluation)
        .slice(0, 30)
        .map((m: any) => `[${m.role === 'user' ? 'SETTER' : 'PROSPECTO'}]: ${m.content}`)
        .join('\n');

      const evals = msgs.filter((m: any) => m.is_evaluation).map((m: any) => m.content).join('\n---\n');

      return `=== SESIÓN ${i + 1}: ${s.scenario_name} (${s.scenario_group} · Dif. ${s.difficulty}/10) — ${new Date(s.started_at).toLocaleDateString('es-AR')} ===
${dialogue || '(sin mensajes registrados)'}
${evals ? `\n[EVALUACIONES RECIBIDAS]\n${evals}` : ''}`;
    }).join('\n\n');

    const brainContext = brain
      ? [
          brain.base_prompt ? `INSTRUCCIONES BASE DEL ENTRENADOR:\n${brain.base_prompt}` : '',
          brain.rules ? `REGLAS GENERALES:\n${brain.rules}` : '',
          brain.mode_fria ? `FRÍA:\n${brain.mode_fria}` : '',
          brain.mode_tibia ? `TIBIA:\n${brain.mode_tibia}` : '',
          brain.mode_caliente ? `CALIENTE:\n${brain.mode_caliente}` : '',
        ].filter(Boolean).join('\n\n')
      : '';

    const systemPrompt = `Sos el Entrenador CAC (Camino al Closing). Tu trabajo es analizar el desempeño de un setter durante sus sesiones de entrenamiento y dar un diagnóstico profesional, honesto y accionable.

FILOSOFÍA CAC:
No formamos vendedores. Formamos solucionadores de problemas. No entrenamos respuestas. Entrenamos pensamiento comercial. No premies el humo. Premiá el criterio. No premies reuniones con promesas falsas. Premiá conversaciones que generen confianza, respeten la oferta y protejan la marca.

${brainContext ? `CONFIGURACIÓN ACTUAL DEL ENTRENADOR:\n${brainContext}` : ''}

Tu análisis debe ser en español rioplatense, directo, sin rodeos. No seas genérico. Identificá patrones reales en las conversaciones. Sé específico sobre lo que hace bien y lo que debe mejorar.

Estructura tu respuesta en JSON con este formato exacto:
{
  "resumen": "1 párrafo de 2-3 oraciones: quién es este setter como entrenador",
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "areas_mejora": ["área 1", "área 2", "área 3"],
  "patrones_detectados": ["patrón 1", "patrón 2"],
  "cuellos_botella": ["cuello 1", "cuello 2"],
  "proximo_nivel": "qué trabajar en la próxima etapa — 2-3 oraciones específicas",
  "escenario_recomendado": "escenario específico a practicar y por qué"
}`;

    const userPrompt = `Analizá el desempeño de ${userName} en sus ${allSessions.length} sesiones de entrenamiento:\n\n${conversationContext}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const analysis = JSON.parse(raw);

    return NextResponse.json({ user_name: userName, sessions_analyzed: allSessions.length, analysis });
  } catch (err: any) {
    console.error('[admin/trainer/analyze]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
