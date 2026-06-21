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
  return { user, admin };
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { admin } = ctx;

  const { data: forms } = await (admin as any)
    .from('reinforcement_forms')
    .select('*, reinforcement_questions(count), reinforcement_submissions(count)')
    .order('created_at', { ascending: false });

  return NextResponse.json(forms ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { user, admin } = ctx;

  const { title, description, topic } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });

  const { data, error } = await (admin as any)
    .from('reinforcement_forms')
    .insert({ title, description, topic, created_by: user.id, is_active: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
