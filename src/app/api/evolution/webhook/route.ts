import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Public webhook — Evolution API posts here when messages arrive
// Set webhook URL in Evolution: POST /webhook/set/:instance
// Payload varies by Evolution version; we handle the common format
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const event = body.event ?? body.type ?? '';
  const instanceKey = body.instance ?? body.instanceName ?? '';

  // Only process incoming messages
  if (!['messages.upsert', 'message', 'MESSAGES_UPSERT'].includes(event)) {
    return NextResponse.json({ ok: true, skipped: event });
  }

  const msgData = body.data ?? body.message ?? {};
  const key = msgData.key ?? {};

  // Skip messages sent by us
  if (key.fromMe === true) return NextResponse.json({ ok: true, skipped: 'fromMe' });

  const remoteJid: string = key.remoteJid ?? '';
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  if (!phone || phone.includes('@')) return NextResponse.json({ ok: true, skipped: 'no_phone' });

  const messageText: string =
    msgData.message?.conversation ??
    msgData.message?.extendedTextMessage?.text ??
    msgData.text ??
    '';

  if (!messageText.trim()) return NextResponse.json({ ok: true, skipped: 'no_text' });

  const admin = createSupabaseAdminClient();

  // Find instance in DB
  const { data: instance } = await (admin as any)
    .from('evolution_instances')
    .select('id, created_by')
    .eq('instance_key', instanceKey)
    .single();

  if (!instance) return NextResponse.json({ ok: true, skipped: 'unknown_instance' });

  // Normalize phone to find lead
  const normalized = phone.replace(/\D/g, '');
  const { data: lead } = await (admin as any)
    .from('leads')
    .select('id, assigned_to_user_id, current_status')
    .or(`phone.eq.${normalized},phone.eq.+${normalized}`)
    .limit(1)
    .single();

  if (!lead) return NextResponse.json({ ok: true, skipped: 'lead_not_found' });

  const setterId = lead.assigned_to_user_id ?? instance.created_by;

  // Find or create conversation
  let { data: conv } = await (admin as any)
    .from('prospecting_conversations')
    .select('id')
    .eq('lead_id', lead.id)
    .eq('setter_id', setterId)
    .single();

  const now = new Date().toISOString();

  if (!conv) {
    const { data: newConv } = await (admin as any)
      .from('prospecting_conversations')
      .insert({ lead_id: lead.id, setter_id: setterId, status: 'responded', last_message_at: now, origen: 'evolution_api' })
      .select('id')
      .single();
    conv = newConv;
  } else {
    await (admin as any)
      .from('prospecting_conversations')
      .update({ status: 'responded', last_message_at: now, updated_at: now })
      .eq('id', conv.id);
  }

  if (!conv) return NextResponse.json({ ok: false, error: 'Could not create conversation' }, { status: 500 });

  // Add inbound message con origen para trazabilidad futura
  await (admin as any).from('prospecting_conversation_messages').insert({
    conversation_id: conv.id,
    lead_id: lead.id,
    setter_id: setterId,
    direction: 'inbound',
    body: messageText.trim(),
    sent_at: now,
    origen: 'evolution_api',
  });

  // Update lead status to RESPONDIO si está en etapas tempranas del funnel
  const earlyStatuses = ['NO_CONTACTADO', 'APERTURA_ENVIADA', 'CONTACTADO', 'NO_RESPONDE'];
  if (earlyStatuses.includes(lead.current_status)) {
    await (admin as any)
      .from('leads')
      .update({ current_status: 'RESPONDIO', last_action_at: now, updated_at: now })
      .eq('id', lead.id);
    // Registrar actividad
    await (admin as any).from('lead_activities').insert({
      lead_id: lead.id,
      user_id: setterId,
      type: 'STATUS_CHANGE',
      previous_status: lead.current_status,
      new_status: 'RESPONDIO',
      note: 'Respuesta recibida vía WhatsApp (Evolution API)',
    });
  }

  // Update campaign_lead status if exists
  await (admin as any)
    .from('campaign_leads')
    .update({ status: 'replied', replied_at: new Date().toISOString() })
    .eq('lead_id', lead.id)
    .in('status', ['sent', 'delivered', 'read']);

  return NextResponse.json({ ok: true, lead_id: lead.id, conversation_id: conv.id });
}
