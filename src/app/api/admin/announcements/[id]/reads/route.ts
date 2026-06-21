import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Get announcement to know target
  const { data: ann } = await (admin as any)
    .from('announcements')
    .select('target')
    .eq('id', params.id)
    .single();

  if (!ann) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Get target profiles
  let query = admin.from('profiles').select('id, full_name, email, role') as any;
  if (ann.target === 'equipo')    query = query.in('role', ['setter', 'admin']);
  else if (ann.target === 'comunidad') query = query.not('role', 'in', '("setter","admin")');
  const { data: profiles } = await query.order('full_name');

  // Get reads
  const { data: reads } = await (admin as any)
    .from('announcement_reads')
    .select('user_id, read_at')
    .eq('announcement_id', params.id);

  const readMap = new Map((reads ?? []).map((r: any) => [r.user_id, r.read_at]));

  const readList: any[] = [];
  const unreadList: any[] = [];

  for (const p of profiles ?? []) {
    if (readMap.has(p.id)) {
      readList.push({ user_id: p.id, name: p.full_name ?? p.email, email: p.email, read_at: readMap.get(p.id) });
    } else {
      unreadList.push({ user_id: p.id, name: p.full_name ?? p.email, email: p.email });
    }
  }

  readList.sort((a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime());

  return NextResponse.json({ read: readList, unread: unreadList });
}
