import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: ca } = await (admin as any)
    .from('conversation_analyses')
    .select('id, user_id, raw_text, analysis, status, created_at')
    .eq('id', params.id)
    .single();

  if (!ca) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { data: myProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = (myProfile as any)?.role === 'admin';

  if (ca.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { data: reflection } = await (admin as any)
    .from('conversation_reflections')
    .select('*')
    .eq('analysis_id', params.id)
    .maybeSingle();

  return NextResponse.json({ ...ca, reflection: reflection ?? null });
}
