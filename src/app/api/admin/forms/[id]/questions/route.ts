import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return { admin };
}

// POST — add a question
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { question_text, category, is_required, is_bonus, order_index } = await req.json();
  if (!question_text?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 });

  // Get current max order_index
  const { data: existing } = await (ctx.admin as any)
    .from('reinforcement_questions')
    .select('order_index')
    .eq('form_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextOrder = order_index ?? ((existing?.[0]?.order_index ?? -1) + 1);

  const { data, error } = await (ctx.admin as any)
    .from('reinforcement_questions')
    .insert({ form_id: params.id, question_text, category: category ?? null, is_required: is_required ?? true, is_bonus: is_bonus ?? false, order_index: nextOrder })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT — reorder questions
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { order } = await req.json() as { order: { id: string; order_index: number }[] };

  await Promise.all(order.map(({ id, order_index }) =>
    (ctx.admin as any).from('reinforcement_questions').update({ order_index }).eq('id', id).eq('form_id', params.id)
  ));

  return NextResponse.json({ ok: true });
}
