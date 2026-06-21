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

export async function PUT(req: NextRequest, { params }: { params: { qid: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { question_text, category, is_required, is_bonus } = await req.json();

  const { data, error } = await (ctx.admin as any)
    .from('reinforcement_questions')
    .update({ question_text, category, is_required, is_bonus })
    .eq('id', params.qid)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { qid: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await (ctx.admin as any)
    .from('reinforcement_questions')
    .delete()
    .eq('id', params.qid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
