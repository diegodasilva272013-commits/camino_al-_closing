import { NextRequest, NextResponse } from 'next/server';
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

const CAP_MAP: Record<string, string> = {
  intencion: 'Intención', rapport: 'Rapport', empatia_profesional: 'Empatía profesional',
  diagnostico: 'Diagnóstico', generacion_interes: 'Generación de interés',
  seguimiento: 'Seguimiento', profesionalismo: 'Profesionalismo', criterio: 'Criterio',
};

function capScore(level: string): number | null {
  if (level === 'alta')  return 3;
  if (level === 'media') return 2;
  if (level === 'baja')  return 1;
  return null;
}

const CONTACTED_STATUSES = ['CONTACTADO','RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'];
const RESPONDED_STATUSES  = ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'];
const INTERESTED_STATUSES = ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { id } = params;

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role, created_at, points')
    .eq('id', id)
    .single() as { data: any };

  if (!profile) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // ── 1. FORMULARIOS — datos completos ──────────────────────────────
  let submissions: any[] = [];
  let category_scores: Record<string, { avg: number; count: number; label: string }> = {};
  let category_evolution: Record<string, { date: string; score: number; form: string }[]> = {};
  let avg_form_score: number | null = null;

  try {
    const { data: subs } = await (admin as any)
      .from('reinforcement_submissions')
      .select('id, form_id, total_score, ai_risk, nivel_general, status, submitted_at, analysis')
      .eq('user_id', id)
      .order('submitted_at');
    const rawSubs: any[] = subs ?? [];

    if (rawSubs.length > 0) {
      const subIds = rawSubs.map((s: any) => s.id);
      const { data: ans } = await (admin as any)
        .from('reinforcement_answers')
        .select('id, submission_id, question_id, answer_text, score, analysis')
        .in('submission_id', subIds);
      const answers: any[] = ans ?? [];

      const qIds = [...new Set(answers.map((a: any) => a.question_id))];
      let questions: any[] = [];
      if (qIds.length > 0) {
        const { data: qs } = await (admin as any)
          .from('reinforcement_questions')
          .select('id, question_text, category, is_required, is_bonus, order_index')
          .in('id', qIds);
        questions = qs ?? [];
      }

      const formIds = [...new Set(rawSubs.map((s: any) => s.form_id))];
      const { data: fs } = await (admin as any)
        .from('reinforcement_forms')
        .select('id, title, topic')
        .in('id', formIds);
      const forms: any[] = fs ?? [];

      const formMap = new Map(forms.map((f: any) => [f.id, f]));
      const qMap    = new Map(questions.map((q: any) => [q.id, q]));

      // scores por categoría
      const catRaw: Record<string, number[]> = {};
      for (const a of answers) {
        const cat = qMap.get(a.question_id)?.category;
        if (!cat || a.score == null) continue;
        if (!catRaw[cat]) catRaw[cat] = [];
        catRaw[cat].push(a.score);
      }
      for (const [cat, scores] of Object.entries(catRaw)) {
        category_scores[cat] = {
          avg: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
          count: scores.length,
          label: CAT_LABELS[cat] ?? cat,
        };
      }

      // evolución por categoría
      const completed = rawSubs.filter((s: any) => s.status === 'analyzed');
      for (const sub of completed) {
        const subAnswers = answers.filter((a: any) => a.submission_id === sub.id);
        const formTitle  = formMap.get(sub.form_id)?.title ?? '—';
        const subCatRaw: Record<string, number[]> = {};
        for (const a of subAnswers) {
          const cat = qMap.get(a.question_id)?.category;
          if (!cat || a.score == null) continue;
          if (!subCatRaw[cat]) subCatRaw[cat] = [];
          subCatRaw[cat].push(a.score);
        }
        for (const [cat, scores] of Object.entries(subCatRaw)) {
          if (!category_evolution[cat]) category_evolution[cat] = [];
          category_evolution[cat].push({
            date: sub.submitted_at,
            score: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
            form: formTitle,
          });
        }
      }

      if (completed.length > 0) {
        avg_form_score = Math.round(completed.reduce((s: number, r: any) => s + (r.total_score ?? 0), 0) / completed.length);
      }

      // submissions con respuestas completas
      submissions = rawSubs.map((s: any) => {
        const form       = formMap.get(s.form_id);
        const subAnswers = answers
          .filter((a: any) => a.submission_id === s.id)
          .map((a: any) => ({ ...a, question: qMap.get(a.question_id) ?? null }))
          .sort((a: any, b: any) => (a.question?.order_index ?? 0) - (b.question?.order_index ?? 0));
        return { ...s, form_title: form?.title ?? '—', form_topic: form?.topic ?? null, answers: subAnswers };
      });
    }
  } catch {}

  // ── 2. CONVERSACIONES — análisis completo con reflexiones ─────────
  let conversations: any[] = [];
  let conv_cap_scores: Record<string, { label: string; avg: number }> = {};

  try {
    const { data: convs } = await (admin as any)
      .from('conversation_analyses')
      .select('id, status, created_at, analysis')
      .eq('user_id', id)
      .eq('status', 'ready')
      .order('created_at', { ascending: true });
    const allConvs: any[] = convs ?? [];

    if (allConvs.length > 0) {
      const { data: refs } = await (admin as any)
        .from('conversation_reflections')
        .select('analysis_id, xp_earned, status, evaluation, answers')
        .in('analysis_id', allConvs.map((c: any) => c.id));
      const allRefs: any[] = refs ?? [];

      // capacidades promedio
      const capTotals: Record<string, number[]> = {};
      for (const c of allConvs) {
        for (const [k, v] of Object.entries(c.analysis?.capacidades_impactadas ?? {})) {
          const s = capScore(String(v));
          if (s !== null) {
            if (!capTotals[k]) capTotals[k] = [];
            capTotals[k].push(s);
          }
        }
      }
      for (const [k, scores] of Object.entries(capTotals)) {
        conv_cap_scores[k] = {
          label: CAP_MAP[k] ?? k,
          avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        };
      }

      conversations = allConvs.map((c: any) => ({
        ...c,
        reflection: allRefs.find((r: any) => r.analysis_id === c.id) ?? null,
      }));
    }
  } catch {}

  // ── 3. TRAINER — todas las sesiones con evaluaciones ─────────────
  let trainer_sessions: any[] = [];

  try {
    const { data: sessions } = await (admin as any)
      .from('trainer_sessions')
      .select('id, scenario_name, scenario_group, scenario_tag, difficulty, mode, started_at, ended_at, message_count, evaluations_count, last_evaluation, status')
      .eq('user_id', id)
      .order('started_at', { ascending: true });
    trainer_sessions = sessions ?? [];
  } catch {}

  // ── 4. LEADS — todos con su estado ───────────────────────────────
  let leads: any[] = [];
  let leads_summary = { total: 0, contacted: 0, responded: 0, interested: 0, meetings: 0, no_fit: 0, closed: 0, contact_rate: 0, response_rate: 0, meeting_rate: 0 };

  const ALL_STATUSES = [
    'NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','RESPONDIO',
    'NO_RESPONDE','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO',
    'ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO',
    'REUNION_PROPUESTA','REUNION_AGENDADA','NO_CALIFICA','SEGUIMIENTO_FUTURO',
  ];

  try {
    const { data: lds } = await admin
      .from('leads')
      .select('id, current_status, is_closed, follow_up_count')
      .eq('assigned_to_user_id', id);
    leads = lds ?? [];

    const total      = leads.length;
    const contacted  = leads.filter((l: any) => CONTACTED_STATUSES.includes(l.current_status)).length;
    const responded  = leads.filter((l: any) => RESPONDED_STATUSES.includes(l.current_status)).length;
    const interested = leads.filter((l: any) => INTERESTED_STATUSES.includes(l.current_status)).length;
    const meetings   = leads.filter((l: any) => l.current_status === 'REUNION_AGENDADA').length;
    const noFit      = leads.filter((l: any) => l.current_status === 'NO_CALIFICA').length;
    const closed     = leads.filter((l: any) => l.is_closed).length;

    const leads_by_status: Record<string, number> = {};
    for (const st of ALL_STATUSES) {
      leads_by_status[st] = leads.filter((l: any) => l.current_status === st).length;
    }

    leads_summary = {
      total, contacted, responded, interested, meetings, no_fit: noFit, closed,
      contact_rate:   total > 0      ? Math.round((contacted  / total)      * 100) : 0,
      response_rate:  total > 0      ? Math.round((responded  / total)      * 100) : 0,
      meeting_rate:   interested > 0 ? Math.round((meetings   / interested) * 100) : 0,
      interest_rate:  total > 0      ? Math.round((interested / total)      * 100) : 0,
      leads_by_status,
    } as any;
  } catch {}

  // ── Alertas ───────────────────────────────────────────────────────
  const alerts: string[] = [];
  const completedForms = submissions.filter((s: any) => s.status === 'analyzed');
  if (completedForms.length === 0) alerts.push('No ha completado ningún formulario todavía');
  const aiCount = completedForms.filter((s: any) => s.ai_risk === 'alto').length;
  if (aiCount > 0) alerts.push(`Uso de IA detectado en ${aiCount} envío${aiCount > 1 ? 's' : ''}`);
  if (avg_form_score !== null && avg_form_score < 50) alerts.push('Rendimiento general bajo en formularios (promedio < 50/100)');
  for (const [, data] of Object.entries(category_scores)) {
    if ((data as any).avg < 5) alerts.push(`Bajo nivel en ${(data as any).label} (${(data as any).avg}/10)`);
  }
  if (conversations.length === 0) alerts.push('No ha cargado ninguna conversación real todavía');
  if (trainer_sessions.length === 0) alerts.push('No ha hecho sesiones de entrenamiento todavía');
  if (leads.length === 0) alerts.push('No tiene leads asignados');

  // Recomendaciones acumuladas de formularios
  const allRecs: string[] = [];
  const allConceptos: string[] = [];
  for (const s of completedForms) {
    const a = s.analysis ?? {};
    if (Array.isArray(a.ejercicios_recomendados)) allRecs.push(...a.ejercicios_recomendados);
    if (Array.isArray(a.conceptos_a_reforzar)) allConceptos.push(...a.conceptos_a_reforzar);
  }

  return NextResponse.json({
    profile,
    // formularios
    submissions,
    avg_form_score,
    category_scores,
    category_evolution,
    // conversaciones
    conversations,
    conv_cap_scores,
    // trainer
    trainer_sessions,
    // leads
    leads,
    leads_summary,
    // meta
    alerts,
    recommendations: [...new Set(allRecs)].slice(0, 5),
    conceptos_a_reforzar: [...new Set(allConceptos)].slice(0, 6),
  });
}
