import { createSupabaseAdminClient } from './supabase-server';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TeamAlert = {
  type: 'inactive_setter' | 'low_response_rate' | 'weak_category' | 'overdue_followups';
  severity: 'high' | 'medium' | 'low';
  message: string;
  setterName?: string;
  setterId?: string;
  detail?: string;
  action: { label: string; href: string };
};

export type SetterRankEntry = {
  id: string;
  name: string;
  email: string;
  assignedLeads: number;
  contactedToday: number;
  totalContacted: number;
  repliesReceived: number;
  responseRate: number;
  meetingsScheduled: number;
  latestScore: number | null;
  evaluationsCount: number;
  overdueFollowUps: number;
  lastActivity: string | null;
  rankScore: number;
};

export type WeakArea = {
  category: string;
  averageScore: number;
  affectedSetters: number;
};

export type AdminCommandCenter = {
  teamStatus: {
    totalSetters: number;
    activeToday: number;
    inactiveToday: number;
    totalAssignedLeads: number;
    contactedToday: number;
    repliesToday: number;
    meetingsScheduled: number;
    teamResponseRate: number;
    schedulingRate: number;
  };
  teamAlerts: TeamAlert[];
  setterRanking: SetterRankEntry[];
  weakAreas: WeakArea[];
  nextTrainingRecommendation: string | null;
  funnelSnapshot: {
    no_contactado: number;
    apertura_enviada: number;
    contactado: number;
    respondio: number;
    interes_detectado: number;
    reunion_agendada: number;
    no_califica: number;
  };
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const SCORE_LABELS: Record<string, string> = {
  score_opening: 'Apertura',
  score_connection: 'Conexión',
  score_questions: 'Preguntas',
  score_defense_handling: 'Manejo de defensa',
  score_rapport: 'Rapport',
  score_advance: 'Avance',
  score_commercial_criteria: 'Criterio comercial',
};

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Main function ──────────────────────────────────────────────────────────

export async function getAdminCommandCenter(): Promise<AdminCommandCenter> {
  const admin = createSupabaseAdminClient();
  const today = todayStart();

  // ── Fetch all setters ─────────────────────────────────────────────────────
  const { data: setters } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['setter', 'admin'])
    .order('full_name');

  const setterList = setters ?? [];
  const setterIds = setterList.map((s: any) => s.id);

  if (setterIds.length === 0) {
    return emptyCommandCenter();
  }

  // ── Run all heavy queries in parallel ─────────────────────────────────────
  const [
    allLeadsRes,
    todayContactedRes,
    evalRes,
    overdueRes,
  ] = await Promise.all([
    (admin as any)
      .from('leads')
      .select('id, current_status, assigned_to_user_id, next_follow_up_at, created_at, updated_at')
      .in('assigned_to_user_id', setterIds)
      .range(0, 99999),

    (admin as any)
      .from('leads')
      .select('id, assigned_to_user_id, current_status')
      .in('assigned_to_user_id', setterIds)
      .neq('current_status', 'NO_CONTACTADO')
      .gte('updated_at', today),

    (admin as any)
      .from('ai_prospecting_evaluations')
      .select('setter_id, score_total, score_opening, score_connection, score_questions, score_defense_handling, score_rapport, score_advance, score_commercial_criteria, created_at')
      .in('setter_id', setterIds)
      .order('created_at', { ascending: false })
      .range(0, 499),

    (admin as any)
      .from('leads')
      .select('id, assigned_to_user_id, next_follow_up_at, current_status')
      .in('assigned_to_user_id', setterIds)
      .lt('next_follow_up_at', new Date().toISOString())
      .not('current_status', 'in', '("NO_CALIFICA","REUNION_AGENDADA")')
      .range(0, 999),
  ]);

  const allLeads: any[] = allLeadsRes.data ?? [];
  const todayContacted: any[] = todayContactedRes.data ?? [];
  const allEvals: any[] = evalRes.data ?? [];
  const overdueLeads: any[] = overdueRes.data ?? [];

  // ── Index data by setter ──────────────────────────────────────────────────
  const leadsBySetter = groupBy(allLeads, 'assigned_to_user_id');
  const contactedTodayBySetter = groupBy(todayContacted, 'assigned_to_user_id');
  const evalsBySetter = groupBy(allEvals, 'setter_id');
  const overdueBySetter = groupBy(overdueLeads, 'assigned_to_user_id');

  const REPLIED = new Set(['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA']);

  // ── Build setter ranking ──────────────────────────────────────────────────
  const setterRanking: SetterRankEntry[] = setterList.map((s: any) => {
    const leads = leadsBySetter[s.id] ?? [];
    const contacted = leads.filter((l: any) => l.current_status !== 'NO_CONTACTADO');
    const replies = leads.filter((l: any) => REPLIED.has(l.current_status));
    const scheduled = leads.filter((l: any) => l.current_status === 'REUNION_AGENDADA');
    const evals = evalsBySetter[s.id] ?? [];
    const latestScore = evals[0]?.score_total ?? null;
    const responseRate = contacted.length > 0 ? Math.round((replies.length / contacted.length) * 100) : 0;
    const schedulingRate = replies.length > 0 ? Math.round((scheduled.length / replies.length) * 100) : 0;
    const overdue = (overdueBySetter[s.id] ?? []).length;
    const todayC = (contactedTodayBySetter[s.id] ?? []).length;

    // Composite rank score (0-100):
    // 40% response rate, 30% scheduling rate, 20% AI score (normalized), 10% today activity
    const normalizedScore = latestScore != null ? (latestScore / 10) * 20 : 0;
    const rankScore = Math.round(
      responseRate * 0.40 +
      schedulingRate * 0.30 +
      normalizedScore +
      Math.min(todayC, 10) * 1
    );

    return {
      id: s.id,
      name: s.full_name ?? s.email,
      email: s.email,
      assignedLeads: leads.length,
      contactedToday: todayC,
      totalContacted: contacted.length,
      repliesReceived: replies.length,
      responseRate,
      meetingsScheduled: scheduled.length,
      latestScore,
      evaluationsCount: evals.length,
      overdueFollowUps: overdue,
      lastActivity: null,
      rankScore,
    };
  });

  setterRanking.sort((a, b) => b.rankScore - a.rankScore);

  // ── Team status ───────────────────────────────────────────────────────────
  const activeToday = setterRanking.filter(s => s.contactedToday > 0).length;
  const totalContacted = allLeads.filter((l: any) => l.current_status !== 'NO_CONTACTADO').length;
  const totalReplied = allLeads.filter((l: any) => REPLIED.has(l.current_status)).length;
  const totalScheduled = allLeads.filter((l: any) => l.current_status === 'REUNION_AGENDADA').length;
  const teamResponseRate = totalContacted > 0 ? Math.round((totalReplied / totalContacted) * 100) : 0;
  const schedulingRate = totalReplied > 0 ? Math.round((totalScheduled / totalReplied) * 100) : 0;

  // ── Funnel ────────────────────────────────────────────────────────────────
  const funnelSnapshot = {
    no_contactado: allLeads.filter((l: any) => l.current_status === 'NO_CONTACTADO').length,
    apertura_enviada: allLeads.filter((l: any) => l.current_status === 'APERTURA_ENVIADA').length,
    contactado: allLeads.filter((l: any) => l.current_status === 'CONTACTADO').length,
    respondio: allLeads.filter((l: any) => l.current_status === 'RESPONDIO').length,
    interes_detectado: allLeads.filter((l: any) => l.current_status === 'INTERES_DETECTADO').length,
    reunion_agendada: allLeads.filter((l: any) => l.current_status === 'REUNION_AGENDADA').length,
    no_califica: allLeads.filter((l: any) => l.current_status === 'NO_CALIFICA').length,
  };

  // ── Weak areas (from evaluations) ─────────────────────────────────────────
  const weakAreas = computeWeakAreas(allEvals, setterList.length);

  // ── Alerts ────────────────────────────────────────────────────────────────
  const teamAlerts: TeamAlert[] = [];

  // Inactive setters with assigned leads
  for (const s of setterRanking) {
    if (s.contactedToday === 0 && s.assignedLeads > 0 && !s.id.includes('admin')) {
      teamAlerts.push({
        type: 'inactive_setter',
        severity: s.overdueFollowUps > 3 ? 'high' : 'medium',
        message: `${s.name} no registró actividad hoy`,
        setterName: s.name,
        setterId: s.id,
        detail: `${s.assignedLeads} leads asignados${s.overdueFollowUps > 0 ? `, ${s.overdueFollowUps} seguimientos vencidos` : ''}`,
        action: { label: 'Ver perfil', href: `/admin/setters?id=${s.id}` },
      });
    }
  }

  // Low response rates
  for (const s of setterRanking) {
    if (s.totalContacted >= 5 && s.responseRate < 20) {
      teamAlerts.push({
        type: 'low_response_rate',
        severity: 'high',
        message: `${s.name} tiene tasa de respuesta de ${s.responseRate}%`,
        setterName: s.name,
        setterId: s.id,
        detail: `${s.totalContacted} leads contactados, solo ${s.repliesReceived} respuestas`,
        action: { label: 'Ver evaluaciones', href: `/admin/conversaciones?setter=${s.id}` },
      });
    }
  }

  // Weak categories across team
  for (const area of weakAreas.filter(a => a.averageScore < 6 && a.affectedSetters >= 2)) {
    teamAlerts.push({
      type: 'weak_category',
      severity: area.averageScore < 4 ? 'high' : 'medium',
      message: `Área débil del equipo: ${area.category}`,
      detail: `Promedio ${area.averageScore.toFixed(1)}/10 — ${area.affectedSetters} setters afectados`,
      action: { label: 'Ver evaluaciones', href: '/admin/conversaciones' },
    });
  }

  // Sort: high first
  teamAlerts.sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1));

  // ── Training recommendation ───────────────────────────────────────────────
  const worstArea = weakAreas[0] ?? null;
  const nextTrainingRecommendation = worstArea
    ? `Practicar ${worstArea.category} — promedio del equipo ${worstArea.averageScore.toFixed(1)}/10, ${worstArea.affectedSetters} setters por debajo de 6`
    : null;

  return {
    teamStatus: {
      totalSetters: setterList.length,
      activeToday,
      inactiveToday: setterList.length - activeToday,
      totalAssignedLeads: allLeads.length,
      contactedToday: todayContacted.length,
      repliesToday: 0,
      meetingsScheduled: totalScheduled,
      teamResponseRate,
      schedulingRate,
    },
    teamAlerts: teamAlerts.slice(0, 8),
    setterRanking,
    weakAreas: weakAreas.slice(0, 5),
    nextTrainingRecommendation,
    funnelSnapshot,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

function computeWeakAreas(evals: any[], totalSetters: number): WeakArea[] {
  const scoreKeys = Object.keys(SCORE_LABELS);
  const totals: Record<string, { sum: number; count: number; settersBelow6: Set<string> }> = {};

  for (const key of scoreKeys) {
    totals[key] = { sum: 0, count: 0, settersBelow6: new Set() };
  }

  for (const e of evals) {
    for (const key of scoreKeys) {
      if (e[key] != null) {
        totals[key].sum += e[key];
        totals[key].count++;
        if (e[key] < 6) totals[key].settersBelow6.add(e.setter_id);
      }
    }
  }

  return Object.entries(totals)
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => ({
      category: SCORE_LABELS[key],
      averageScore: Math.round((v.sum / v.count) * 10) / 10,
      affectedSetters: v.settersBelow6.size,
    }))
    .sort((a, b) => a.averageScore - b.averageScore);
}

function emptyCommandCenter(): AdminCommandCenter {
  return {
    teamStatus: { totalSetters: 0, activeToday: 0, inactiveToday: 0, totalAssignedLeads: 0, contactedToday: 0, repliesToday: 0, meetingsScheduled: 0, teamResponseRate: 0, schedulingRate: 0 },
    teamAlerts: [],
    setterRanking: [],
    weakAreas: [],
    nextTrainingRecommendation: null,
    funnelSnapshot: { no_contactado: 0, apertura_enviada: 0, contactado: 0, respondio: 0, interes_detectado: 0, reunion_agendada: 0, no_califica: 0 },
  };
}
