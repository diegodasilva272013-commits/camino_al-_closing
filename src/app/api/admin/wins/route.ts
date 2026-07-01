import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

// POST — admin sube win del equipo (comprobante de pago)
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const body = await req.json();
  const { title, description, image_url } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from('team_wins')
    .insert({ title: title.trim(), description: description?.trim() || null, image_url: image_url || null, posted_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — admin borra win del equipo
export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { id } = await req.json();
  const admin = createSupabaseAdminClient() as any;
  await admin.from('team_wins').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
