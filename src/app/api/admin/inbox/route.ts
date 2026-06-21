import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const url = new URL(req.url);
  const setterId = url.searchParams.get('setter_id');
  const status = url.searchParams.get('status');

  let q = (admin as any)
    .from('prospecting_conversations')
    .select(`
      id, lead_id, setter_id, status, last_message_at, created_at, updated_at,
      leads!prospecting_conversations_lead_id_fkey(id, first_name, last_name, phone, country, status),
      profiles!prospecting_conversations_setter_id_fkey(id, full_name, email)
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(0, 499);

  if (setterId) q = q.eq('setter_id', setterId);
  if (status)   q = q.eq('status', status);

  const { data: convs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const convIds = (convs ?? []).map((c: any) => c.id);
  let lastMessages: Record<string, any> = {};

  if (convIds.length > 0) {
    const { data: msgs } = await (admin as any)
      .from('prospecting_conversation_messages')
      .select('conversation_id, direction, body, sent_at')
      .in('conversation_id', convIds)
      .order('sent_at', { ascending: false });

    for (const m of msgs ?? []) {
      if (!lastMessages[m.conversation_id]) lastMessages[m.conversation_id] = m;
    }
  }

  const result = (convs ?? []).map((c: any) => ({
    ...c,
    last_message: lastMessages[c.id] ?? null,
  }));

  return NextResponse.json(result);
}
