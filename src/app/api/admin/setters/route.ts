import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const CAT_LABELS: Record<string, string> = {
  cerebro_predictivo: 'Cerebro Predictivo',
  cingulo: 'Cíngulo e Incongruencia',
  amigdala: 'Amígdala y Defensa',
  lobulo_frontal: 'Lóbulo Frontal',
  rapport_falso: 'Rapport Falso',
  rapport_genuino: 'Rapport Genuino',
  conexion_genuina: 'Conexión Genuina',
  criterio_comercial: 'Criterio Comercial',
  aplicacion_practica: 'Aplicación Práctica',
};

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: profiles, error: profilesErr } = await admin.from('profiles')
    .select('id, full_name, email, role, created_at, points')
    .order('full_name') as { data: any[] | null; error: any };
  if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 500 });

  const allProfiles = profiles ?? [];
  const team = allProfiles.filter((p: any) => p.role === 'setter' || p.role === 'admin');

  let submissions: any[] = [];
  let allAnswers: any[] = [];
  let allQuestions: any[] = [];
  let activeForms: any[] = [];
  let totalForms = 0;
  let allLeads: any[] = [];

  const ALL_STATUSES = [
    'NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','RESPONDIO',
    'NO_RESPONDE','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO',
    'ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO',
    'REUNION_PROPUESTA','REUNION_AGENDADA','NO_CALIFICA','SEGUIMIENTO_FUTURO',
  ];

  try {
    const { data: subs } = await (admin as any)
      .from('reinforcement_submissions')
      .select('id, user_id, form_id, total_score, ai_risk, nivel_general, status, submitted_at');
    submissions = subs ?? [];

    if (submissions.length > 0) {
      const subIds = submissions.map((s: any) => s.id);
      const { data: ans } = await (admin as any)
        .from('reinforcement_answers')
        .select('submission_id, question_id, score')
        .in('submission_id', subIds);
      allAnswers = ans ?? [];

      if (allAnswers.length > 0) {
        const qIds = [...new Set(allAnswers.map((a: any) => a.question_id))];
        const { data: qs } = await (admin as any)
          .from('reinforcement_questions')
          .select('id, category')
          .in('id', qIds);
        allQuestions = qs ?? [];
      }
    }

    const { count: total } = await (admin as any)
      .from('reinforcement_forms')
      .select('id', { count: 'exact', head: true });
    totalForms = total ?? 0;

    const { data: forms } = await (admin as any)
      .from('reinforcement_forms')
      .select('id, title, topic, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    activeForms = forms ?? [];

    // Leads reales — paginación para traer TODOS (Supabase limita 1000 por defecto)
    let from2 = 0;
    const PAGE2 = 1000;
    while (true) {
      const { data: page } = await admin
        .from('leads')
        .select('assigned_to_user_id, current_status, is_closed')
        .range(from2, from2 + PAGE2 - 1);
      if (!page?.length) break;
      allLeads.push(...page);
      if (page.length < PAGE2) break;
      from2 += PAGE2;
    }
  } catch {}

  // Leads agrupados por user_id
  const leadsByUser = new Map<string, any[]>();
  for (const l of allLeads) {
    if (!l.assigned_to_user_id) continue;
    if (!leadsByUser.has(l.assigned_to_user_id)) leadsByUser.set(l.assigned_to_user_id, []);
    leadsByUser.get(l.assigned_to_user_id)!.push(l);
  }

  const qMap = new Map(allQuestions.map((q: any) => [q.id, q]));
  const profileMap = new Map(allProfiles.map((p: any) => [p.id, p]));

  // Team category averages
  const teamCatRaw: Record<string, number[]> = {};
  for (const ans of allAnswers) {
    const q = qMap.get(ans.question_id);
    const cat = q?.category;
    if (!cat || ans.score == null) continue;
    if (!teamCatRaw[cat]) teamCatRaw[cat] = [];
    teamCatRaw[cat].push(ans.score);
  }
  const teamCategoryAvgs = Object.entries(teamCatRaw)
    .map(([cat, scores]) => ({
      cat,
      label: CAT_LABELS[cat] ?? cat,
      avg: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
      count: scores.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  // Per-setter aggregation
  const subsByUser = new Map<string, any[]>();
  for (const s of submissions) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id)!.push(s);
  }

  const setterRows = allProfiles.map((p: any) => {
    const subs = subsByUser.get(p.id) ?? [];
    const completed = subs.filter((s: any) => s.status === 'analyzed');
    const avgScore = completed.length > 0
      ? Math.round(completed.reduce((a: number, s: any) => a + (s.total_score ?? 0), 0) / completed.length)
      : null;
    const aiRiskFlags = completed.filter((s: any) => s.ai_risk === 'alto').length;

    const setterSubIds = new Set(subs.map((s: any) => s.id));
    const setterAnswers = allAnswers.filter((a: any) => setterSubIds.has(a.submission_id));
    const catRaw: Record<string, number[]> = {};
    for (const ans of setterAnswers) {
      const q = qMap.get(ans.question_id);
      const cat = q?.category;
      if (!cat || ans.score == null) continue;
      if (!catRaw[cat]) catRaw[cat] = [];
      catRaw[cat].push(ans.score);
    }
    const categoryScores: Record<string, number> = {};
    for (const [cat, scores] of Object.entries(catRaw)) {
      categoryScores[cat] = Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10;
    }

    const alerts: string[] = [];
    if (completed.length === 0) alerts.push('Sin actividad en formularios');
    if (aiRiskFlags > 0) alerts.push(`Riesgo IA en ${aiRiskFlags} formulario${aiRiskFlags > 1 ? 's' : ''}`);
    if (avgScore !== null && avgScore < 50) alerts.push('Rendimiento bajo');
    for (const [cat, score] of Object.entries(categoryScores)) {
      if (score < 5) alerts.push(`Débil en ${CAT_LABELS[cat] ?? cat}`);
    }
    const catEntries = Object.entries(categoryScores).sort((a, b) => b[1] - a[1]);

    // Pending forms
    const submittedFormIds = new Set(completed.map((s: any) => s.form_id));
    const pendingForms = activeForms.filter(f => !submittedFormIds.has(f.id));

    // Leads de este setter
    const userLeads = leadsByUser.get(p.id) ?? [];
    const leads_total = userLeads.length;
    const leadsContacted = userLeads.filter((l: any) => !['NO_CONTACTADO','APERTURA_ENVIADA'].includes(l.current_status)).length;
    const leadsResponded = userLeads.filter((l: any) => !['NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','NO_RESPONDE'].includes(l.current_status)).length;
    const leadsInterested = userLeads.filter((l: any) => ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
    const leads_meetings = userLeads.filter((l: any) => l.current_status === 'REUNION_AGENDADA').length;
    const leads_no_fit   = userLeads.filter((l: any) => l.current_status === 'NO_CALIFICA').length;
    const leads_by_status: Record<string, number> = {};
    for (const st of ALL_STATUSES) {
      leads_by_status[st] = userLeads.filter((l: any) => l.current_status === st).length;
    }

    if (leads_total === 0) alerts.push('Sin leads asignados');
    const uniqueAlerts = [...new Set(alerts)].slice(0, 5);

    return {
      user_id: p.id,
      name: p.full_name ?? p.email ?? '—',
      email: p.email ?? '',
      role: p.role ?? 'setter',
      created_at: p.created_at,
      points: p.points ?? 0,
      forms_completed: completed.length,
      forms_pending: pendingForms.length,
      avg_score: avgScore,
      ai_risk_flags: aiRiskFlags,
      nivel_general: completed.length > 0 ? completed[completed.length - 1].nivel_general : null,
      alerts: uniqueAlerts,
      category_scores: categoryScores,
      top_category: catEntries.length > 0 ? { cat: catEntries[0][0], label: CAT_LABELS[catEntries[0][0]] ?? catEntries[0][0], score: catEntries[0][1] } : null,
      weak_category: catEntries.length > 0 ? { cat: catEntries[catEntries.length - 1][0], label: CAT_LABELS[catEntries[catEntries.length - 1][0]] ?? catEntries[catEntries.length - 1][0], score: catEntries[catEntries.length - 1][1] } : null,
      // LEADS REALES
      leads_total,
      leads_meetings,
      leads_no_fit,
      leads_response_rate: leads_total > 0 ? Math.round((leadsResponded / leads_total) * 100) : 0,
      leads_interest_rate: leads_total > 0 ? Math.round((leadsInterested / leads_total) * 100) : 0,
      leads_by_status,
    };
  });

  const ranked = setterRows
    .slice()
    .sort((a, b) => {
      if (a.avg_score === null && b.avg_score === null) return 0;
      if (a.avg_score === null) return 1;
      if (b.avg_score === null) return -1;
      return b.avg_score - a.avg_score;
    })
    .map((s, i) => ({ ...s, rank: s.avg_score !== null ? i + 1 : null }));

  const withScores = ranked.filter(s => s.avg_score !== null);
  const teamAvgScore = withScores.length > 0
    ? Math.round(withScores.reduce((a, s) => a + s.avg_score!, 0) / withScores.length)
    : null;

  // Form compliance: per active form, who submitted / who didn't
  const formCompliance = activeForms.map(form => {
    const formSubs = submissions.filter((s: any) => s.form_id === form.id && s.status === 'analyzed');
    const submittedIds = new Set(formSubs.map((s: any) => s.user_id));
    const pending = team
      .filter((p: any) => !submittedIds.has(p.id))
      .map((p: any) => ({ user_id: p.id, name: p.full_name ?? p.email ?? '—' }));
    const submitted = formSubs
      .map((s: any) => {
        const p = profileMap.get(s.user_id);
        return {
          user_id: s.user_id,
          name: p?.full_name ?? p?.email ?? '—',
          total_score: s.total_score,
          ai_risk: s.ai_risk,
          nivel_general: s.nivel_general,
        };
      })
      .sort((a: any, b: any) => (b.total_score ?? 0) - (a.total_score ?? 0));
    const avgScore = formSubs.length > 0
      ? Math.round(formSubs.reduce((a: number, s: any) => a + (s.total_score ?? 0), 0) / formSubs.length)
      : null;

    return {
      form_id: form.id,
      form_title: form.title,
      form_topic: form.topic,
      total_setters: team.length,
      submitted_count: formSubs.length,
      avg_score: avgScore,
      pending,
      submitted,
    };
  });

  return NextResponse.json({
    team_stats: {
      total_setters: allProfiles.length,
      active_setters: ranked.filter(s => s.forms_completed > 0).length,
      total_forms: totalForms,
      active_forms: activeForms.length,
      total_submissions: submissions.filter((s: any) => s.status === 'analyzed').length,
      team_avg_score: teamAvgScore,
      alerts_count: ranked.filter(s => s.alerts.length > 0).length,
    },
    setters: ranked,
    team_category_avgs: teamCategoryAvgs,
    form_compliance: formCompliance,
  });
}
