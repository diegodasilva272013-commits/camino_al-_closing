import { createSupabaseAdminClient } from './supabase-server';

// ─── Types ─────────────────────────────────────────────────────────────────

export type PriorityItem = {
  priority: number;
  type: 'reply' | 'follow_up' | 'contact_lead' | 'form' | 'evaluation';
  title: string;
  reason: string;
  preview?: string;
  minutesWaiting?: number;
  action: { label: string; href: string };
  meta?: {
    convId?: string;
    leadId?: string;
    leadName?: string;
    leadFirstName?: string;
    leadPhone?: string;
    leadCountry?: string | null;
    leadStatus?: string;
    formId?: string;
    formTitle?: string;
    inboundMessage?: string;
    followUpDate?: string;
  };
};

export type SetterWorkspace = {
  setter: { id: string; name: string };
  currentStatus: {
    assignedLeads: number;
    leadsWithoutContact: number;
    activeConversations: number;
    newReplies: number;
    overdueFollowUps: number;
    pendingForms: number;
    currentScore: number | null;
    currentWeakness: string | null;
  };
  priorityQueue: PriorityItem[];
  conversationsNeedingAttention: {
    id: string; leadId: string; leadName: string;
    lastMessage: string; lastMessageDirection: 'inbound' | 'outbound';
    status: string; minutesWaiting: number; lastMessageAt: string;
  }[];
  leadsToContact: {
    id: string; name: string; country: string | null;
    phone: string; assignedAt: string;
  }[];
  overdueFollowUpLeads: {
    id: string; name: string; followUpDate: string;
    status: string; dayOverdue: number;
  }[];
  pendingForms: { id: string; title: string }[];
  latestEvaluation: {
    scoreTotal: number;
    scores: Record<string, number>;
    strongestSkill: string | null;
    weakestSkill: string | null;
    feedback: string | null;
    recommendedExercise: string | null;
    createdAt: string;
  } | null;
  personalMetrics: {
    messagesSent: number;
    leadsContacted: number;
    repliesReceived: number;
    responseRate: number;
    averageAiScore: number | null;
    evaluationsCount: number;
  };
  funnel: {
    assigned: number;
    notContacted: number;
    contacted: number;
    replied: number;
    interested: number;
    scheduled: number;
    lost: number;
  };
};

// ─── Score labels ───────────────────────────────────────────────────────────

const SCORE_LABELS: Record<string, string> = {
  score_opening: 'Apertura',
  score_connection: 'Conexión',
  score_questions: 'Preguntas',
  score_defense_handling: 'Manejo de defensa',
  score_rapport: 'Rapport',
  score_advance: 'Avance',
  score_commercial_criteria: 'Criterio comercial',
};

const REPLIED_STATUSES = new Set([
  'RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO',
  'ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO',
  'REUNION_PROPUESTA','REUNION_AGENDADA',
]);
const TERMINAL_STATUSES = new Set(['NO_CALIFICA', 'REUNION_AGENDADA']);

// ─── Main function ──────────────────────────────────────────────────────────

export async function getSetterWorkspace(userId: string): Promise<SetterWorkspace> {
  const admin = createSupabaseAdminClient();
  const now = new Date();

  // ── Run all queries in parallel ──────────────────────────────────────────
  const [
    profileRes,
    leadsRes,
    conversationsRes,
    msgsSentRes,
    evalsRes,
    formsRes,
    formSubsRes,
  ] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', userId).single(),

    (admin as any)
      .from('leads')
      .select('id, first_name, last_name, current_status, next_follow_up_at, phone, country, assigned_at, created_at, updated_at')
      .eq('assigned_to_user_id', userId)
      .range(0, 9999),

    (admin as any)
      .from('prospecting_conversations')
      .select('id, lead_id, status, last_message_at, leads!prospecting_conversations_lead_id_fkey(id, first_name, last_name, phone)')
      .eq('setter_id', userId)
      .not('status', 'in', '("closed","lost")')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(0, 99),

    (admin as any)
      .from('prospecting_messages')
      .select('id', { count: 'exact', head: true })
      .eq('setter_id', userId),

    (admin as any)
      .from('ai_prospecting_evaluations')
      .select('score_total, score_opening, score_connection, score_questions, score_defense_handling, score_rapport, score_advance, score_commercial_criteria, summary, weaknesses, strengths, next_exercise, created_at')
      .eq('setter_id', userId)
      .order('created_at', { ascending: false })
      .range(0, 9),

    (admin as any).from('forms').select('id, title').eq('is_active', true).range(0, 49),

    (admin as any)
      .from('form_submissions')
      .select('form_id')
      .eq('user_id', userId),
  ]);

  const setter = profileRes.data;
  const leads: any[] = leadsRes.data ?? [];
  const conversations: any[] = conversationsRes.data ?? [];
  const totalMsgsSent: number = msgsSentRes.count ?? 0;
  const evals: any[] = evalsRes.data ?? [];
  const allForms: any[] = formsRes.data ?? [];
  const formSubs = new Set((formSubsRes.data ?? []).map((s: any) => s.form_id));

  // ── Get last inbound message for conversations needing attention ──────────
  const respondedConvs = conversations.filter(c => c.status === 'responded');
  const respondedConvIds = respondedConvs.map((c: any) => c.id);

  let lastMessages: Record<string, any> = {};
  if (respondedConvIds.length > 0) {
    const { data: msgs } = await (admin as any)
      .from('prospecting_conversation_messages')
      .select('conversation_id, direction, body, sent_at')
      .in('conversation_id', respondedConvIds)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false });

    for (const m of msgs ?? []) {
      if (!lastMessages[m.conversation_id]) lastMessages[m.conversation_id] = m;
    }
  }

  // ── Process leads ─────────────────────────────────────────────────────────
  const noContactados = leads.filter(l => l.current_status === 'NO_CONTACTADO');
  const overdueLeads = leads.filter(l =>
    l.next_follow_up_at &&
    new Date(l.next_follow_up_at) < now &&
    !TERMINAL_STATUSES.has(l.current_status)
  );
  const contactedLeads = leads.filter(l => l.current_status !== 'NO_CONTACTADO');
  const repliedLeads = leads.filter(l => REPLIED_STATUSES.has(l.current_status));
  const pendingForms = allForms.filter(f => !formSubs.has(f.id));

  // ── Funnel ───────────────────────────────────────────────────────────────
  const funnel = {
    assigned: leads.length,
    notContacted: noContactados.length,
    contacted: contactedLeads.length,
    replied: repliedLeads.length,
    interested: leads.filter(l => ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO'].includes(l.current_status)).length,
    scheduled: leads.filter(l => l.current_status === 'REUNION_AGENDADA').length,
    lost: leads.filter(l => l.current_status === 'NO_CALIFICA').length,
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const responseRate = contactedLeads.length > 0
    ? Math.round((repliedLeads.length / contactedLeads.length) * 100)
    : 0;

  const avgScore = evals.length > 0
    ? Math.round((evals.reduce((s, e) => s + (e.score_total ?? 0), 0) / evals.length) * 10) / 10
    : null;

  // ── Latest evaluation ─────────────────────────────────────────────────────
  const latestEval = evals[0] ?? null;
  let latestEvalFormatted: SetterWorkspace['latestEvaluation'] = null;

  if (latestEval) {
    const scores: Record<string, number> = {};
    for (const [key, label] of Object.entries(SCORE_LABELS)) {
      if (latestEval[key] != null) scores[label] = latestEval[key];
    }
    const scoreEntries = Object.entries(scores);
    const strongest = scoreEntries.length > 0 ? scoreEntries.reduce((a, b) => a[1] > b[1] ? a : b) : null;
    const weakest = scoreEntries.length > 0 ? scoreEntries.reduce((a, b) => a[1] < b[1] ? a : b) : null;

    latestEvalFormatted = {
      scoreTotal: latestEval.score_total ?? 0,
      scores,
      strongestSkill: strongest?.[0] ?? null,
      weakestSkill: weakest?.[0] ?? null,
      feedback: latestEval.summary ?? null,
      recommendedExercise: latestEval.next_exercise ?? null,
      createdAt: latestEval.created_at,
    };
  }

  // ── Build priority queue ──────────────────────────────────────────────────
  const priorityQueue: PriorityItem[] = [];
  let p = 1;

  // 1. New replies first — action urgente
  for (const conv of respondedConvs.slice(0, 3)) {
    const lead = conv.leads;
    const lastMsg = lastMessages[conv.id];
    const minsWaiting = conv.last_message_at
      ? Math.floor((now.getTime() - new Date(conv.last_message_at).getTime()) / 60000)
      : 0;

    priorityQueue.push({
      priority: p++,
      type: 'reply',
      title: `Responder a ${lead?.first_name ?? 'lead'} ${lead?.last_name ?? ''}`.trim(),
      reason: `Respondió hace ${minsWaiting < 60 ? `${minsWaiting} minuto${minsWaiting !== 1 ? 's' : ''}` : `${Math.floor(minsWaiting / 60)}h`}.`,
      preview: lastMsg?.body ? lastMsg.body.slice(0, 100) : undefined,
      minutesWaiting: minsWaiting,
      action: { label: 'Ver conversación completa', href: `/inbox?conv=${conv.id}` },
      meta: {
        convId: conv.id,
        leadId: conv.lead_id,
        leadName: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(),
        leadFirstName: lead?.first_name,
        leadPhone: lead?.phone,
        inboundMessage: lastMsg?.body,
      },
    });
  }

  // 2. Overdue follow-ups
  for (const lead of overdueLeads.slice(0, 2)) {
    const daysOverdue = Math.floor((now.getTime() - new Date(lead.next_follow_up_at).getTime()) / 86400000);
    priorityQueue.push({
      priority: p++,
      type: 'follow_up',
      title: `Seguimiento vencido con ${lead.first_name} ${lead.last_name ?? ''}`.trim(),
      reason: `El seguimiento estaba marcado para hace ${daysOverdue === 0 ? 'hoy' : `${daysOverdue} día${daysOverdue > 1 ? 's' : ''}`}.`,
      action: { label: 'Ver conversación', href: `/inbox?conv=` },
      meta: {
        leadId: lead.id,
        leadName: `${lead.first_name} ${lead.last_name ?? ''}`.trim(),
        leadFirstName: lead.first_name,
        leadStatus: lead.current_status,
        followUpDate: lead.next_follow_up_at,
      },
    });
  }

  // 3. Contact next lead
  if (noContactados.length > 0) {
    const nextLead = noContactados[0];
    priorityQueue.push({
      priority: p++,
      type: 'contact_lead',
      title: `Contactar a ${nextLead.first_name} ${nextLead.last_name ?? ''}`.trim(),
      reason: `Tenés ${noContactados.length} lead${noContactados.length > 1 ? 's' : ''} sin contactar.`,
      action: { label: 'Contactar ahora', href: `/leads?id=${nextLead.id}` },
      meta: {
        leadId: nextLead.id,
        leadName: `${nextLead.first_name} ${nextLead.last_name ?? ''}`.trim(),
        leadFirstName: nextLead.first_name,
        leadPhone: nextLead.phone,
        leadCountry: nextLead.country,
      },
    });
  }

  // 4. Pending forms
  for (const form of pendingForms.slice(0, 1)) {
    priorityQueue.push({
      priority: p++,
      type: 'form',
      title: form.title,
      reason: 'Tenés un formulario de entrenamiento pendiente.',
      action: { label: 'Completar este formulario', href: `/formularios/${form.id}` },
      meta: {
        formId: form.id,
        formTitle: form.title,
      },
    });
  }

  // 5. If no eval yet, recommend getting one
  if (!latestEval && conversations.length > 0) {
    priorityQueue.push({
      priority: p++,
      type: 'evaluation',
      title: 'Evaluar tu primera conversación con IA',
      reason: 'Todavía no tenés evaluaciones. La IA puede darte feedback real de tu estilo de prospección.',
      action: { label: 'Ir al inbox', href: '/inbox' },
    });
  }

  // ── Build conversations needing attention ─────────────────────────────────
  const conversationsNeedingAttention = conversations.slice(0, 5).map((c: any) => {
    const lastMsg = lastMessages[c.id];
    const minsWaiting = c.last_message_at
      ? Math.floor((now.getTime() - new Date(c.last_message_at).getTime()) / 60000)
      : 0;
    return {
      id: c.id,
      leadId: c.lead_id,
      leadName: `${c.leads?.first_name ?? ''} ${c.leads?.last_name ?? ''}`.trim(),
      lastMessage: lastMsg?.body ?? '',
      lastMessageDirection: lastMsg?.direction ?? 'outbound',
      status: c.status,
      minutesWaiting: minsWaiting,
      lastMessageAt: c.last_message_at ?? '',
    };
  });

  return {
    setter: {
      id: userId,
      name: setter?.full_name ?? '',
    },
    currentStatus: {
      assignedLeads: leads.length,
      leadsWithoutContact: noContactados.length,
      activeConversations: conversations.length,
      newReplies: respondedConvs.length,
      overdueFollowUps: overdueLeads.length,
      pendingForms: pendingForms.length,
      currentScore: avgScore,
      currentWeakness: latestEvalFormatted?.weakestSkill ?? null,
    },
    priorityQueue,
    conversationsNeedingAttention,
    leadsToContact: noContactados.slice(0, 10).map(l => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name ?? ''}`.trim(),
      country: l.country,
      phone: l.phone,
      assignedAt: l.assigned_at ?? l.created_at,
    })),
    overdueFollowUpLeads: overdueLeads.slice(0, 5).map(l => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name ?? ''}`.trim(),
      followUpDate: l.next_follow_up_at,
      status: l.current_status,
      dayOverdue: Math.floor((now.getTime() - new Date(l.next_follow_up_at).getTime()) / 86400000),
    })),
    pendingForms: pendingForms.slice(0, 5),
    latestEvaluation: latestEvalFormatted,
    personalMetrics: {
      messagesSent: totalMsgsSent,
      leadsContacted: contactedLeads.length,
      repliesReceived: repliedLeads.length,
      responseRate,
      averageAiScore: avgScore,
      evaluationsCount: evals.length,
    },
    funnel,
  };
}
