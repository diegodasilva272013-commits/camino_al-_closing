import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { getEvolutionInstance, evolutionSendText } from '@/lib/evolution';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return null;
  return { admin };
}

// Trigger a send batch for this campaign (Evolution API only for now)
// Returns immediately after queueing — actual sends happen async
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const { batch_size = 20 } = await req.json().catch(() => ({}));

  // Get campaign
  const { data: campaign, error: campErr } = await (admin as any)
    .from('campaigns')
    .select('*')
    .eq('id', params.id)
    .single();

  if (campErr || !campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  if (campaign.status !== 'active') return NextResponse.json({ error: 'La campaña no está activa' }, { status: 400 });
  if (campaign.channel !== 'evolution') return NextResponse.json({ error: 'Solo campañas Evolution pueden enviar automáticamente' }, { status: 400 });
  if (!campaign.evolution_instance_id) return NextResponse.json({ error: 'Sin instancia Evolution configurada' }, { status: 400 });

  // Get Evolution instance
  const instance = await getEvolutionInstance(campaign.evolution_instance_id);
  if (!instance || instance.status !== 'connected') {
    return NextResponse.json({ error: 'Instancia Evolution no conectada' }, { status: 400 });
  }

  // Get pending leads for this campaign
  const { data: pendingLeads, error: leadsErr } = await (admin as any)
    .from('campaign_leads')
    .select('id, lead_id, message_body, leads!campaign_leads_lead_id_fkey(id, first_name, last_name, phone, country, notes)')
    .eq('campaign_id', params.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .range(0, batch_size - 1);

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (!pendingLeads?.length) return NextResponse.json({ sent: 0, message: 'No hay leads pendientes' });

  // Get template body if no custom message
  let templateBody = campaign.message_body ?? '';
  if (!templateBody && campaign.template_id) {
    const { data: tpl } = await (admin as any)
      .from('message_templates')
      .select('body')
      .eq('id', campaign.template_id)
      .single();
    templateBody = tpl?.body ?? '';
  }

  const rules = campaign.send_rules ?? { max_per_hour: 80, pause_seconds: 30 };
  const pauseMs = (rules.pause_seconds ?? 30) * 1000;

  let sent = 0;
  let failed = 0;

  for (const cl of pendingLeads) {
    const lead = cl.leads;
    if (!lead?.phone) {
      await (admin as any).from('campaign_leads').update({ status: 'skipped', failed_at: new Date().toISOString(), error_message: 'Sin teléfono' }).eq('id', cl.id);
      continue;
    }

    // Build message with variable substitution
    const msg = (cl.message_body ?? templateBody)
      .replace(/\{nombre\}/gi, lead.first_name ?? '')
      .replace(/\{pais\}/gi, lead.country ?? '')
      .replace(/\{interes\}/gi, (lead.notes ?? '').slice(0, 60));

    if (!msg.trim()) {
      await (admin as any).from('campaign_leads').update({ status: 'skipped', failed_at: new Date().toISOString(), error_message: 'Sin mensaje' }).eq('id', cl.id);
      continue;
    }

    // Mark as sending
    await (admin as any).from('campaign_leads').update({ status: 'sending' }).eq('id', cl.id);

    try {
      await evolutionSendText(instance, lead.phone, msg);
      await (admin as any).from('campaign_leads').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        message_body: msg,
      }).eq('id', cl.id);
      sent++;
    } catch (e: any) {
      await (admin as any).from('campaign_leads').update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error_message: e?.message ?? 'Error desconocido',
      }).eq('id', cl.id);
      failed++;
    }

    // Pause between sends to avoid bans
    if (pauseMs > 0) await new Promise(r => setTimeout(r, pauseMs));
  }

  // Update campaign counters
  await (admin as any)
    .from('campaigns')
    .update({
      sent_count: (campaign.sent_count ?? 0) + sent,
      failed_count: (campaign.failed_count ?? 0) + failed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json({ sent, failed, total: pendingLeads.length });
}
