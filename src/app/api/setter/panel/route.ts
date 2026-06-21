import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Run all queries in parallel
  const [
    leadsRes,
    convsRes,
    msgsCountRes,
    latestEvalRes,
    pendingFormsRes,
  ] = await Promise.all([
    // All leads assigned to this setter
    (admin as any)
      .from('leads')
      .select('id, status, follow_up_date, updated_at')
      .eq('assigned_to_user_id', user.id)
      .range(0, 9999),

    // Conversations
    (admin as any)
      .from('prospecting_conversations')
      .select('id, status, last_message_at, lead_id, leads!prospecting_conversations_lead_id_fkey(id, first_name, last_name, phone)')
      .eq('setter_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(0, 49),

    // Total messages sent (for metrics)
    (admin as any)
      .from('prospecting_messages')
      .select('id', { count: 'exact', head: true })
      .eq('setter_id', user.id),

    // Latest evaluation
    (admin as any)
      .from('ai_prospecting_evaluations')
      .select('score_total, score_opening, score_connection, score_questions, score_defense_handling, score_rapport, score_advance, score_commercial_criteria, summary, weaknesses, strengths, next_exercise, created_at')
      .eq('setter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),

    // Pending forms (forms without submission from this user)
    (admin as any)
      .from('forms')
      .select('id, title, lesson_id')
      .eq('is_active', true)
      .range(0, 49),
  ]);

  const leads: any[] = leadsRes.data ?? [];
  const conversations: any[] = convsRes.data ?? [];
  const totalMsgsSent: number = msgsCountRes.count ?? 0;
  const latestEval: any = latestEvalRes.data ?? null;

  // Count submissions this user has already done
  const formIds = (pendingFormsRes.data ?? []).map((f: any) => f.id);
  let submittedFormIds = new Set<string>();
  if (formIds.length > 0) {
    const { data: subs } = await (admin as any)
      .from('form_submissions')
      .select('form_id')
      .eq('user_id', user.id)
      .in('form_id', formIds);
    submittedFormIds = new Set((subs ?? []).map((s: any) => s.form_id));
  }
  const pendingForms = (pendingFormsRes.data ?? []).filter((f: any) => !submittedFormIds.has(f.id));

  // Lead stats by status
  const leadsByStatus: Record<string, number> = {};
  for (const l of leads) {
    leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1;
  }

  // Follow-up overdue (follow_up_date < now, not in terminal status)
  const now = new Date();
  const terminalStatuses = new Set(['NO_CALIFICA', 'REUNION_AGENDADA']);
  const overdueFollowups = leads.filter(l =>
    l.follow_up_date &&
    new Date(l.follow_up_date) < now &&
    !terminalStatuses.has(l.status)
  );

  // Conversation stats
  const convStats = {
    total: conversations.length,
    responded: conversations.filter(c => c.status === 'responded').length,
    waiting: conversations.filter(c => c.status === 'waiting_response').length,
    open: conversations.filter(c => c.status === 'open').length,
  };

  // New responses (conversations with status 'responded') — show top 5
  const newResponses = conversations
    .filter(c => c.status === 'responded')
    .slice(0, 5);

  // Recent active conversations (non-closed) — top 5
  const activeConvs = conversations
    .filter(c => !['closed', 'lost'].includes(c.status))
    .slice(0, 5);

  // Metrics
  const responded = leads.filter(l => ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.status)).length;
  const contactedLeads = leads.filter(l => l.status !== 'NO_CONTACTADO').length;
  const responseRate = contactedLeads > 0 ? Math.round((responded / contactedLeads) * 100) : 0;

  // No-contactado leads
  const noContactados = leads.filter(l => l.status === 'NO_CONTACTADO');

  return NextResponse.json({
    totals: {
      leads: leads.length,
      no_contactados: noContactados.length,
      overdue_followups: overdueFollowups.length,
      pending_forms: pendingForms.length,
      messages_sent: totalMsgsSent,
      response_rate: responseRate,
      responded_leads: responded,
    },
    conversations: convStats,
    new_responses: newResponses,
    active_conversations: activeConvs,
    pending_forms: pendingForms.slice(0, 5),
    latest_evaluation: latestEval,
    leads_by_status: leadsByStatus,
    overdue_followups: overdueFollowups.slice(0, 5),
  });
}
