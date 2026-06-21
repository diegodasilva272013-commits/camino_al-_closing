import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function capScore(level: string): number | null {
  if (level === 'alta')  return 3;
  if (level === 'media') return 2;
  if (level === 'baja')  return 1;
  return null;
}

const CAP_MAP: Record<string, string> = {
  intencion: 'Intención', rapport: 'Rapport', empatia_profesional: 'Empatía profesional',
  diagnostico: 'Diagnóstico', generacion_interes: 'Generación de interés',
  seguimiento: 'Seguimiento', profesionalismo: 'Profesionalismo', criterio: 'Criterio',
};

const CONTACTED_STATUSES = ['CONTACTADO','RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'];
const RESPONDED_STATUSES = ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'];
const INTERESTED_STATUSES = ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'];

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const id = user.id;

    // ── Leads ────────────────────────────────────────────────────────
    let leads_summary = { total: 0, contacted: 0, responded: 0, interested: 0, meetings: 0, no_fit: 0, closed: 0, contact_rate: 0, response_rate: 0, meeting_rate: 0 };
    try {
      const { data: leads } = await admin.from('leads').select('current_status, is_closed').eq('assigned_to_user_id', id);
      const all = leads ?? [];
      const total = all.length;
      const contacted  = all.filter((l: any) => CONTACTED_STATUSES.includes(l.current_status)).length;
      const responded  = all.filter((l: any) => RESPONDED_STATUSES.includes(l.current_status)).length;
      const interested = all.filter((l: any) => INTERESTED_STATUSES.includes(l.current_status)).length;
      const meetings   = all.filter((l: any) => l.current_status === 'REUNION_AGENDADA').length;
      const noFit      = all.filter((l: any) => l.current_status === 'NO_CALIFICA').length;
      const closed     = all.filter((l: any) => l.is_closed).length;
      leads_summary = {
        total, contacted, responded, interested, meetings, no_fit: noFit, closed,
        contact_rate:  total > 0       ? Math.round((contacted  / total)       * 100) : 0,
        response_rate: contacted > 0   ? Math.round((responded  / contacted)   * 100) : 0,
        meeting_rate:  interested > 0  ? Math.round((meetings   / interested)  * 100) : 0,
      };
    } catch {}

    // ── Conversaciones ───────────────────────────────────────────────
    let conversations_summary = {
      total: 0, with_reflection: 0, approved_reflections: 0, total_xp_earned: 0,
      cap_scores: {} as Record<string, { label: string; avg: number }>,
      latest: [] as { date: string; resultado: string; xp: number }[],
    };
    try {
      const { data: convs } = await (admin as any)
        .from('conversation_analyses')
        .select('id, created_at, analysis')
        .eq('user_id', id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });
      const allConvs: any[] = convs ?? [];

      let reflections: any[] = [];
      if (allConvs.length > 0) {
        const { data: refs } = await (admin as any)
          .from('conversation_reflections')
          .select('analysis_id, xp_earned, status')
          .in('analysis_id', allConvs.map((c: any) => c.id));
        reflections = refs ?? [];
      }

      const capTotals: Record<string, number[]> = {};
      for (const c of allConvs) {
        for (const [k, v] of Object.entries(c.analysis?.capacidades_impactadas ?? {})) {
          const s = capScore(String(v));
          if (s !== null) { if (!capTotals[k]) capTotals[k] = []; capTotals[k].push(s); }
        }
      }

      const capScores: Record<string, { label: string; avg: number }> = {};
      for (const [k, scores] of Object.entries(capTotals)) {
        capScores[k] = {
          label: CAP_MAP[k] ?? k,
          avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        };
      }

      const approved = reflections.filter((r: any) => r.status === 'approved');
      conversations_summary = {
        total: allConvs.length,
        with_reflection: reflections.length,
        approved_reflections: approved.length,
        total_xp_earned: approved.reduce((s: number, r: any) => s + (r.xp_earned ?? 0), 0),
        cap_scores: capScores,
        latest: allConvs.slice(0, 5).map((c: any) => ({
          date: c.created_at,
          resultado: c.analysis?.resultado_probable ?? '',
          xp: reflections.find((r: any) => r.analysis_id === c.id)?.xp_earned ?? 0,
        })),
      };
    } catch {}

    // ── Trainer ──────────────────────────────────────────────────────
    let trainer_summary = { total_sessions: 0, completed_sessions: 0, unique_scenarios: 0, last_evaluation: null as string | null, groups_practiced: [] as string[] };
    try {
      const { data: sessions } = await (admin as any)
        .from('trainer_sessions')
        .select('scenario_name, scenario_group, started_at, ended_at, last_evaluation, status')
        .eq('user_id', id)
        .order('started_at', { ascending: false });
      const all: any[] = sessions ?? [];
      trainer_summary = {
        total_sessions: all.length,
        completed_sessions: all.filter((s: any) => s.status === 'finished' || s.ended_at).length,
        unique_scenarios: new Set(all.map((s: any) => s.scenario_name)).size,
        last_evaluation: all.find((s: any) => s.last_evaluation)?.last_evaluation ?? null,
        groups_practiced: [...new Set(all.map((s: any) => s.scenario_group).filter(Boolean))] as string[],
      };
    } catch {}

    // ── Formularios ──────────────────────────────────────────────────
    let forms_summary = { completed: 0, avg_score: null as number | null, latest_nivel: null as string | null };
    try {
      const { data: subs } = await (admin as any)
        .from('reinforcement_submissions')
        .select('total_score, nivel_general, status, submitted_at')
        .eq('user_id', id)
        .eq('status', 'analyzed')
        .order('submitted_at', { ascending: false });
      const all: any[] = subs ?? [];
      const avg = all.length > 0 ? all.reduce((s: number, r: any) => s + (r.total_score ?? 0), 0) / all.length : null;
      forms_summary = {
        completed: all.length,
        avg_score: avg !== null ? Math.round(avg) : null,
        latest_nivel: all[0]?.nivel_general ?? null,
      };
    } catch {}

    return NextResponse.json({ leads_summary, conversations_summary, trainer_summary, forms_summary });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
