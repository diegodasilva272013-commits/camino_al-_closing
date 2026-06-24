import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Cargar formulario + preguntas
  const { data: form } = await (admin as any)
    .from('reinforcement_forms')
    .select('id, title, is_active, reinforcement_questions(*)')
    .eq('id', params.id)
    .eq('is_active', true)
    .single();

  if (!form) return NextResponse.json({ error: 'Formulario no disponible' }, { status: 404 });

  // ¿Ya enviado?
  const { data: existing } = await (admin as any)
    .from('reinforcement_submissions')
    .select('id')
    .eq('form_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: 'Ya enviaste este formulario' }, { status: 409 });

  const { answers } = await req.json() as { answers: Record<string, string> };
  const questions: any[] = (form.reinforcement_questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index);

  // Validar preguntas requeridas
  for (const q of questions.filter((q: any) => q.is_required)) {
    if (!answers[q.id]?.trim() || answers[q.id].trim().length < 15) {
      return NextResponse.json({ error: `Respuesta muy corta en: "${q.question_text.slice(0, 60)}..."` }, { status: 400 });
    }
  }

  // 1. Guardar submission en estado 'analyzing'
  const { data: sub, error: subErr } = await (admin as any)
    .from('reinforcement_submissions')
    .insert({ form_id: params.id, user_id: user.id, status: 'analyzing' })
    .select('id')
    .single();

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  // 2. Guardar respuestas crudas
  const answerRows = questions
    .filter((q: any) => answers[q.id]?.trim())
    .map((q: any) => ({ submission_id: sub.id, question_id: q.id, answer_text: answers[q.id] }));

  await (admin as any).from('reinforcement_answers').insert(answerRows);

  // 3. Disparar análisis IA en background (fire-and-forget)
  // Tomar host del request — funciona tanto en local como en Vercel
  const host = req.headers.get('host') ?? 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  void fetch(`${baseUrl}/api/forms/${params.id}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.CRON_SECRET ?? '' },
    body: JSON.stringify({ submission_id: sub.id, user_id: user.id }),
  }).catch(() => { /* silencioso — el cliente puede reintentar */ });

  // 4. Responder inmediatamente — el cliente hace polling hasta status='analyzed'
  return NextResponse.json({ submission_id: sub.id, status: 'analyzing' });
}
