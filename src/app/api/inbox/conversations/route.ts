import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: convs, error } = await (admin as any)
    .from('prospecting_conversations')
    .select(`
      id, lead_id, status, last_message_at, created_at, updated_at,
      leads!prospecting_conversations_lead_id_fkey(id, first_name, last_name, phone, country, status, notes)
    `)
    .eq('setter_id', user.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(0, 199);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch last message for each conversation
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
