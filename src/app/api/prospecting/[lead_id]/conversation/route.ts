import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { lead_id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  try {
    // Get conversation for this lead+setter pair
    const { data: conv } = await (admin as any)
      .from('prospecting_conversations')
      .select('*')
      .eq('lead_id', params.lead_id)
      .eq('setter_id', user.id)
      .maybeSingle();

    if (!conv) return NextResponse.json({ conversation: null, messages: [], evaluation: null });

    // Get messages
    const { data: messages } = await (admin as any)
      .from('prospecting_conversation_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('sent_at', { ascending: true });

    // Get latest evaluation
    const { data: evaluations } = await (admin as any)
      .from('ai_prospecting_evaluations')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      conversation: conv,
      messages: messages ?? [],
      evaluation: evaluations?.[0] ?? null,
    });
  } catch {
    return NextResponse.json({ conversation: null, messages: [], evaluation: null });
  }
}
