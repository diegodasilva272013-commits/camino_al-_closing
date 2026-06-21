import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as any)?.role ?? 'student';
  const isTeam = role === 'setter' || role === 'admin';

  const targets = isTeam ? ['todos', 'equipo'] : ['todos', 'comunidad'];

  let announcements: any[] = [];
  try {
    const { data } = await (admin as any)
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .in('target', targets)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    announcements = data ?? [];
  } catch { return NextResponse.json([]); }

  const annIds = announcements.map((a: any) => a.id);
  const readSet = new Set<string>();
  if (annIds.length > 0) {
    const { data: reads } = await (admin as any)
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id)
      .in('announcement_id', annIds);
    for (const r of reads ?? []) readSet.add(r.announcement_id);
  }

  return NextResponse.json(announcements.map((a: any) => ({ ...a, is_read: readSet.has(a.id) })));
}
