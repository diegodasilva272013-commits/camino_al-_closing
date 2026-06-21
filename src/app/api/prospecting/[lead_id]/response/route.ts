import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { lead_id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { body: responseBody } = await req.json();
  if (!responseBody?.trim()) return NextResponse.json({ error: 'Respuesta requerida' }, { status: 400 });

  const now = new Date().toISOString();

  try {
    // Get or create conversation
    let { data: conv } = await (admin as any)
      .from('prospecting_conversations')
      .select('id')
      .eq('lead_id', params.lead_id)
      .eq('setter_id', user.id)
      .maybeSingle();

    if (!conv) {
      const { data: newConv } = await (admin as any)
        .from('prospecting_conversations')
        .insert({
          lead_id: params.lead_id,
          setter_id: user.id,
          status: 'responded',
          last_message_at: now,
        })
        .select('id')
        .single();
      conv = newConv;
    } else {
      await (admin as any)
        .from('prospecting_conversations')
        .update({ status: 'responded', last_message_at: now, updated_at: now })
        .eq('id', conv.id);
    }

    // Add inbound message to thread
    if (conv?.id) {
      await (admin as any).from('prospecting_conversation_messages').insert({
        conversation_id: conv.id,
        lead_id: params.lead_id,
        setter_id: user.id,
        direction: 'inbound',
        body: responseBody.trim(),
        sent_at: now,
      });
    }

    // Update lead status to RESPONDIO
    await admin.from('leads').update({
      current_status: 'RESPONDIO',
      last_action_at: now,
      updated_at: now,
    } as any).eq('id', params.lead_id);

    return NextResponse.json({ ok: true, conversation_id: conv?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
