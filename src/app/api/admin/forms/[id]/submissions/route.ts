import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: myProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((myProfile as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // All setters
  const { data: setters } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['setter', 'admin'])
    .order('full_name');

  // All submissions for this form
  const { data: submissions } = await (admin as any)
    .from('reinforcement_submissions')
    .select('*, reinforcement_answers(*)')
    .eq('form_id', params.id);

  const subMap = new Map<string, any>();
  for (const s of submissions ?? []) subMap.set(s.user_id, s);

  const result = (setters ?? []).map((s: any) => ({
    user_id: s.id,
    name: s.full_name ?? s.email ?? 'Usuario',
    email: s.email,
    submission: subMap.get(s.id) ?? null,
  }));

  return NextResponse.json(result);
}
