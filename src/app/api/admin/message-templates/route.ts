import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return p?.role === 'admin' ? user : null;
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  try {
    const { data } = await (admin as any)
      .from('message_templates')
      .select('*')
      .order('category')
      .order('title');
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const body = await req.json();
  const { title, category, body: tplBody, tone } = body;

  if (!title?.trim() || !tplBody?.trim()) {
    return NextResponse.json({ error: 'Título y cuerpo son requeridos' }, { status: 400 });
  }

  const { data, error } = await (admin as any)
    .from('message_templates')
    .insert({
      title: title.trim(),
      category: category ?? 'apertura',
      body: tplBody.trim(),
      tone: tone ?? 'humano',
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
