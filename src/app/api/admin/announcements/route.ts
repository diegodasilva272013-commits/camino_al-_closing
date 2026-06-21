import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { sendPushToMany } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  let announcements: any[] = [];
  try {
    const { data } = await (admin as any)
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    announcements = data ?? [];
  } catch { return NextResponse.json([]); }

  // Read counts per announcement
  const annIds = announcements.map((a: any) => a.id);
  const readCounts: Record<string, number> = {};
  if (annIds.length > 0) {
    try {
      const { data: reads } = await (admin as any)
        .from('announcement_reads')
        .select('announcement_id')
        .in('announcement_id', annIds);
      for (const r of reads ?? []) {
        readCounts[r.announcement_id] = (readCounts[r.announcement_id] ?? 0) + 1;
      }
    } catch {}
  }

  // Total recipients per target
  let totalSetters = 0, totalAll = 0, totalComunidad = 0;
  try {
    const { count: all } = await admin.from('profiles').select('id', { count: 'exact', head: true }) as any;
    const { count: team } = await admin.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['setter', 'admin']) as any;
    totalAll = all ?? 0;
    totalSetters = team ?? 0;
    totalComunidad = totalAll - totalSetters;
  } catch {}

  const result = announcements.map((a: any) => {
    const total = a.target === 'equipo' ? totalSetters : a.target === 'comunidad' ? totalComunidad : totalAll;
    return { ...a, reads: readCounts[a.id] ?? 0, total_recipients: total };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const body = await req.json();
  const { title, body: text, type, target, deadline, is_pinned } = body;

  if (!title?.trim() || !text?.trim()) return NextResponse.json({ error: 'Título y cuerpo son requeridos' }, { status: 400 });

  const { data, error } = await (admin as any)
    .from('announcements')
    .insert({
      title: title.trim(),
      body: text.trim(),
      type: type ?? 'comunicado',
      target: target ?? 'todos',
      deadline: deadline || null,
      is_pinned: is_pinned ?? false,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send push notifications (fire and forget — don't block the response)
  void (async () => {
    try {
      const targetValue = target ?? 'todos';
      let q = admin.from('profiles').select('id') as any;
      if (targetValue === 'equipo') q = q.in('role', ['setter', 'admin']);
      else if (targetValue === 'comunidad') q = q.not('role', 'in', '("setter","admin")');
      const { data: recipients } = await q;
      const userIds = (recipients ?? []).map((p: any) => p.id);
      await sendPushToMany(userIds, {
        title: (title as string).trim(),
        body: (text as string).trim().slice(0, 120),
        url: '/comunicados',
        tag: `announcement-${data.id}`,
      });
    } catch {}
  })();

  return NextResponse.json(data);
}
