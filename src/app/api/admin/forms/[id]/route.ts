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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: form } = await (ctx.admin as any)
    .from('reinforcement_forms')
    .select('*, reinforcement_questions(*)')
    .eq('id', params.id)
    .single();

  if (!form) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  form.reinforcement_questions?.sort((a: any, b: any) => a.order_index - b.order_index);
  return NextResponse.json(form);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const allowed = ['title', 'description', 'topic', 'is_active'];
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await (ctx.admin as any)
    .from('reinforcement_forms')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await (ctx.admin as any)
    .from('reinforcement_forms')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
