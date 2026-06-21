import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { lead_id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Verify the lead is assigned to this setter
  const { data: lead } = await admin
    .from('leads')
    .select('id, assigned_to_user_id, current_status')
    .eq('id', params.lead_id)
    .single();

  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
  if (lead.assigned_to_user_id !== user.id) {
    return NextResponse.json({ error: 'Este lead no está asignado a vos' }, { status: 403 });
  }

  const body = await req.json();
  const { message_body, message_type, template_id } = body;
  if (!message_body?.trim()) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });

  const now = new Date().toISOString();

  try {
    // Record prospecting message
    await (admin as any).from('prospecting_messages').insert({
      lead_id: params.lead_id,
      setter_id: user.id,
      template_id: template_id ?? null,
      message_body: message_body.trim(),
      message_type: message_type ?? 'manual',
      sent_at: now,
    });

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
          status: 'waiting_response',
          last_message_at: now,
        })
        .select('id')
        .single();
      conv = newConv;
    } else {
      await (admin as any)
        .from('prospecting_conversations')
        .update({ last_message_at: now, updated_at: now })
        .eq('id', conv.id);
    }

    // Add outbound message to conversation thread
    if (conv?.id) {
      await (admin as any).from('prospecting_conversation_messages').insert({
        conversation_id: conv.id,
        lead_id: params.lead_id,
        setter_id: user.id,
        direction: 'outbound',
        body: message_body.trim(),
        sent_at: now,
      });
    }

    // Update lead status to APERTURA_ENVIADA if currently NO_CONTACTADO
    if (lead.current_status === 'NO_CONTACTADO') {
      await admin.from('leads').update({
        current_status: 'APERTURA_ENVIADA',
        last_action_at: now,
        updated_at: now,
      } as any).eq('id', params.lead_id);
    } else {
      await admin.from('leads').update({ last_action_at: now, updated_at: now } as any).eq('id', params.lead_id);
    }

    return NextResponse.json({ ok: true, conversation_id: conv?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
