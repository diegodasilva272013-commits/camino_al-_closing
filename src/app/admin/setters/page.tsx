'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Loader2, AlertTriangle, ChevronDown, ChevronUp, Trophy, Brain,
  TrendingUp, TrendingDown, Minus, CheckCircle, XCircle,
  ClipboardList, Sparkles, Target, Download,
} from 'lucide-react';

// ── Types lista ───────────────────────────────────────────────────────
type CatAvg   = { cat: string; label: string; avg: number; count: number };
type SetterRow = {
  user_id: string; name: string; email: string; role: string;
  forms_completed: number; forms_pending: number; avg_score: number | null;
  ai_risk_flags: number; nivel_general: string | null; alerts: string[];
  rank: number | null; category_scores: Record<string, number>;
  top_category: { cat: string; label: string; score: number } | null;
  weak_category: { cat: string; label: string; score: number } | null;
  points: number;
  leads_total: number; leads_meetings: number; leads_no_fit: number;
  leads_response_rate: number; leads_interest_rate: number;
  leads_by_status: Record<string, number>;
};
type FormCompliance = {
  form_id: string; form_title: string; form_topic: string | null;
  total_setters: number; submitted_count: number; avg_score: number | null;
  pending: { user_id: string; name: string }[];
  submitted: { user_id: string; name: string; total_score: number | null; ai_risk: string | null; nivel_general: string | null }[];
};
type TeamStats = {
  total_setters: number; active_setters: number; total_forms: number;
  active_forms: number; total_submissions: number; team_avg_score: number | null;
  alerts_count: number;
};
type DashData = { team_stats: TeamStats; setters: SetterRow[]; team_category_avgs: CatAvg[]; form_compliance: FormCompliance[] };

// ── Types ficha individual ────────────────────────────────────────────
type CatScore  = { avg: number; count: number; label: string };
type CatPoint  = { date: string; score: number; form: string };
type Answer    = { id: string; question_id: string; answer_text: string; score: number | null; analysis: any; question: { question_text: string; category: string | null; is_bonus: boolean; order_index: number } | null };
type Sub       = { id: string; form_title: string; form_topic: string | null; total_score: number | null; ai_risk: string | null; nivel_general: string | null; status: string; submitted_at: string; analysis: any; answers: Answer[] };
type Conv      = { id: string; created_at: string; analysis: any; reflection: { xp_earned: number; status: string; evaluation: any; answers: Record<string, string> } | null };
type TrainerSes = { id: string; scenario_name: string; scenario_group: string; scenario_tag: string; difficulty: number; mode: string; started_at: string; ended_at: string | null; message_count: number; last_evaluation: string | null; status: string };
type Lead      = { id: string; first_name: string; last_name: string; phone: string; current_status: string; is_closed: boolean; follow_up_count: number; updated_at: string };
type LeadsSummary = { total: number; contacted: number; responded: number; interested: number; meetings: number; no_fit: number; closed: number; contact_rate: number; response_rate: number; meeting_rate: number; interest_rate?: number; leads_by_status?: Record<string, number> };
type SetterDetail = {
  profile: { id: string; full_name: string; email: string; role: string; created_at: string; points: number };
  submissions: Sub[]; avg_form_score: number | null;
  category_scores: Record<string, CatScore>; category_evolution: Record<string, CatPoint[]>;
  conversations: Conv[]; conv_cap_scores: Record<string, { label: string; avg: number }>;
  trainer_sessions: TrainerSes[];
  leads: Lead[]; leads_summary: LeadsSummary;
  alerts: string[]; recommendations: string[]; conceptos_a_reforzar: string[];
};
type EvolutionAI = { resumen: string; capacidades: any; patrones: any; aprendizajes: any; recomendaciones: any };

// ── Helpers ───────────────────────────────────────────────────────────
const NIVEL_BADGE: Record<string, string> = {
  principiante: 'text-zinc-400 border-zinc-600 bg-zinc-800/40',
  en_desarrollo: 'text-sky-400 border-sky-500/20 bg-sky-900/15',
  intermedio:    'text-amber-400 border-amber-500/20 bg-amber-900/15',
  avanzado:      'text-emerald-400 border-emerald-500/20 bg-emerald-900/15',
};
const NIVEL_LABEL: Record<string, string> = {
  principiante: 'Principiante', en_desarrollo: 'En desarrollo',
  intermedio: 'Intermedio', avanzado: 'Avanzado',
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  NO_CONTACTADO:        { label: 'Sin contactar',   color: 'bg-zinc-700/50 text-zinc-300' },
  APERTURA_ENVIADA:     { label: 'Apertura env.',   color: 'bg-blue-900/40 text-blue-300' },
  CONTACTADO:           { label: 'Contactado',      color: 'bg-sky-900/40 text-sky-300' },
  RESPONDIO:            { label: 'Respondió',       color: 'bg-cyan-900/40 text-cyan-300' },
  NO_RESPONDE:          { label: 'No responde',     color: 'bg-zinc-800/60 text-zinc-400' },
  INTERES_DETECTADO:    { label: 'Interesado',      color: 'bg-yellow-900/40 text-yellow-300' },
  INVITADO_AL_GRUPO:    { label: 'Inv. grupo',      color: 'bg-orange-900/40 text-orange-300' },
  INGRESO_AL_GRUPO:     { label: 'Ing. grupo',      color: 'bg-amber-900/40 text-amber-300' },
  ACTIVO_EN_GRUPO:      { label: 'Activo grupo',    color: 'bg-lime-900/40 text-lime-300' },
  DIAGNOSTICO_INICIADO: { label: 'Diagnóstico',     color: 'bg-emerald-900/40 text-emerald-300' },
  DIAGNOSTICO_PROFUNDO: { label: 'Diag. profundo',  color: 'bg-teal-900/40 text-teal-300' },
  REUNION_PROPUESTA:    { label: 'Reun. propuesta', color: 'bg-violet-900/40 text-violet-300' },
  REUNION_AGENDADA:     { label: 'Reun. agendada',  color: 'bg-yellow-900/40 text-yellow-200' },
  NO_CALIFICA:          { label: 'No califica',     color: 'bg-red-900/40 text-red-400' },
  SEGUIMIENTO_FUTURO:   { label: 'Seg. futuro',     color: 'bg-indigo-900/40 text-indigo-300' },
};
const CAT_ORDER = ['cerebro_predictivo','cingulo','amigdala','lobulo_frontal','rapport_falso','rapport_genuino','conexion_genuina','criterio_comercial','aplicacion_practica'];

function scoreColor(s: number | null) {
  if (s === null) return 'text-zinc-600';
  return s >= 70 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400';
}

// ── Subcomponentes de la ficha ────────────────────────────────────────
function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/60">{label}</p>
      <div className="flex-1 h-px bg-[rgba(212,175,55,0.08)]" />
    </div>
  );
}

function CatBar({ label, avg, evolution }: { label: string; avg: number; evolution?: CatPoint[] }) {
  const pct   = Math.max(0, Math.min(100, (avg / 10) * 100));
  const color = avg >= 7 ? 'bg-emerald-500' : avg >= 5 ? 'bg-amber-500' : 'bg-red-500';
  const sc    = avg >= 7 ? 'text-emerald-400' : avg >= 5 ? 'text-amber-400' : 'text-red-400';
  let trend: 'up'|'down'|'flat'|null = null;
  if (evolution && evolution.length >= 2) {
    const d = evolution[evolution.length-1].score - evolution[evolution.length-2].score;
    trend = d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'flat';
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-brand-muted">{label}</span>
        <div className="flex items-center gap-1">
          {trend === 'up'   && <TrendingUp   className="h-3 w-3 text-emerald-400" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
          {trend === 'flat' && <Minus        className="h-3 w-3 text-zinc-500" />}
          <span className={`text-xs font-bold ${sc}`}>{avg}/10</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {evolution && evolution.length > 1 && (
        <div className="flex items-end gap-0.5 h-3">
          {evolution.map((p, i) => {
            const h = Math.max(3, Math.round((p.score/10)*12));
            const c = p.score>=7?'bg-emerald-500/60':p.score>=5?'bg-amber-500/60':'bg-red-500/60';
            return <div key={i} className={`w-1.5 rounded-sm ${c}`} style={{ height:`${h}px` }} title={`${p.form}: ${p.score}`} />;
          })}
        </div>
      )}
    </div>
  );
}

function SubCard({ sub }: { sub: Sub }) {
  const [open, setOpen] = useState(false);
  const a = sub.analysis ?? {};
  const nivel = sub.nivel_general ? NIVEL_BADGE[sub.nivel_general] : null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#080808] overflow-hidden">
      <button onClick={() => setOpen(o=>!o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0d0d0d] transition">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text">{sub.form_title}</p>
          {sub.form_topic && <p className="text-[10px] text-brand-muted/60">{sub.form_topic}</p>}
          <p className="text-[10px] text-brand-muted">{new Date(sub.submitted_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sub.total_score!=null && <span className={`text-lg font-black ${sub.total_score>=70?'text-emerald-400':sub.total_score>=50?'text-amber-400':'text-red-400'}`}>{sub.total_score}</span>}
          {nivel && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${nivel}`}>{NIVEL_LABEL[sub.nivel_general!]}</span>}
          {sub.ai_risk==='alto' && <span className="text-[10px] font-bold text-red-400 border border-red-500/20 bg-red-900/15 px-1.5 py-0.5 rounded-full">IA</span>}
          {open ? <ChevronUp className="h-4 w-4 text-brand-muted" /> : <ChevronDown className="h-4 w-4 text-brand-muted" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          {a.feedback_general && (
            <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-3">
              <p className="text-[10px] font-bold uppercase text-brand-gold mb-1 flex items-center gap-1"><Brain className="h-3 w-3" />Diagnóstico Motor CAC</p>
              <p className="text-xs text-brand-text leading-relaxed">{a.feedback_general}</p>
            </div>
          )}
          {a.alertas?.length>0 && a.alertas.map((al:string,i:number)=><p key={i} className="text-[11px] text-amber-400">⚠ {al}</p>)}
          <div className="space-y-3">
            {sub.answers.map((ans,i)=>{
              const qs=a.question_scores?.[ans.question_id];
              return (
                <div key={ans.id} className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-brand-gold/50 shrink-0">P{i+1}{ans.question?.is_bonus?' 🎯':''}</span>
                    <p className="text-[11px] text-brand-muted flex-1 leading-snug">{ans.question?.question_text}</p>
                    {qs&&<span className={`text-sm font-black shrink-0 ${qs.score>=7?'text-emerald-400':qs.score>=5?'text-amber-400':'text-red-400'}`}>{qs.score}/10</span>}
                  </div>
                  <div className="rounded-lg border border-zinc-700/40 bg-[#0a0a0a] px-3 py-2">
                    <p className="text-xs text-brand-text whitespace-pre-wrap leading-relaxed">{ans.answer_text}</p>
                  </div>
                  {qs?.feedback && (
                    <div className={`rounded-lg px-2.5 py-1.5 ${qs.parece_ia?'border border-red-500/15 bg-red-900/10':'border border-zinc-800/50'}`}>
                      {qs.parece_ia&&<p className="text-[10px] text-red-400 font-bold mb-0.5">Posible IA</p>}
                      <p className="text-[11px] text-brand-muted">{qs.feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ConvCard({ conv, index }: { conv: Conv; index: number }) {
  const [open, setOpen] = useState(false);
  const a = conv.analysis ?? {};
  const r = conv.reflection;
  const capColor = (v:string) => v==='alta'?'text-emerald-400 bg-emerald-900/20 border-emerald-500/20':v==='media'?'text-amber-400 bg-amber-900/20 border-amber-500/20':'text-red-400 bg-red-900/20 border-red-500/20';
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#080808] overflow-hidden">
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0d0d0d] transition">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text">Conversación #{index+1}</p>
          <p className="text-[10px] text-brand-muted">
            {new Date(conv.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}
            {a.resultado_probable&&<span className="ml-2 text-brand-muted/60">· {a.resultado_probable}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r?.status==='approved'&&<span className="text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-900/15 px-1.5 py-0.5 rounded-full">+{r.xp_earned} XP</span>}
          {r&&r.status!=='approved'&&<span className="text-[10px] text-brand-muted border border-zinc-700 px-1.5 py-0.5 rounded-full">{r.status}</span>}
          {!r&&<span className="text-[10px] text-brand-muted/40">sin reflexión</span>}
          {open?<ChevronUp className="h-4 w-4 text-brand-muted"/>:<ChevronDown className="h-4 w-4 text-brand-muted"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-3">
          {Object.keys(a.capacidades_impactadas??{}).length>0&&(
            <div>
              <p className="text-[10px] uppercase text-brand-gold/50 mb-1.5">Capacidades impactadas</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(a.capacidades_impactadas).filter(([,v])=>v!=='no_mostrada').map(([k,v])=>(
                  <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${capColor(String(v))}`}>{k.replace(/_/g,' ')} · {String(v)}</span>
                ))}
              </div>
            </div>
          )}
          {a.fortalezas?.length>0&&(
            <div><p className="text-[10px] uppercase text-emerald-400/60 mb-1">Fortalezas</p>
            {a.fortalezas.map((f:string,i:number)=><p key={i} className="text-xs text-brand-text">✓ {f}</p>)}</div>
          )}
          {a.errores?.length>0&&(
            <div><p className="text-[10px] uppercase text-red-400/60 mb-1">Errores</p>
            {a.errores.map((e:string,i:number)=><p key={i} className="text-xs text-brand-text">✗ {e}</p>)}</div>
          )}
          {a.donde_se_rompio&&(
            <div className="rounded-xl border border-red-500/15 bg-red-900/10 p-3">
              <p className="text-[10px] uppercase text-red-400/60 mb-1">Punto de quiebre</p>
              <p className="text-xs text-brand-text">{a.donde_se_rompio}</p>
            </div>
          )}
          {a.que_haria_operador_cac&&(
            <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-3">
              <p className="text-[10px] uppercase text-brand-gold/60 mb-1">Qué haría el operador CAC</p>
              <p className="text-xs text-brand-text">{a.que_haria_operador_cac}</p>
            </div>
          )}
          {r&&(
            <div className="rounded-xl border border-zinc-700 bg-[#0d0d0d] p-3 space-y-2">
              <p className="text-[10px] uppercase text-brand-gold/50">Reflexión del setter</p>
              {r.answers&&Object.entries(r.answers).map(([k,v])=>v&&(
                <div key={k}><p className="text-[10px] text-brand-muted capitalize">{k.replace(/_/g,' ')}</p><p className="text-xs text-brand-text">{String(v)}</p></div>
              ))}
              {r.evaluation?.feedback&&(
                <div className="mt-2 pt-2 border-t border-zinc-700">
                  <p className="text-[10px] uppercase text-brand-gold/50 mb-1">Evaluación Motor CAC</p>
                  <p className="text-xs text-brand-text">{r.evaluation.feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrainerCard({ session, index }: { session: TrainerSes; index: number }) {
  const [open, setOpen] = useState(false);
  const done = session.status==='finished'||session.ended_at;
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#080808] overflow-hidden">
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0d0d0d] transition">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text">{session.scenario_name}</p>
          <p className="text-[10px] text-brand-muted">{session.scenario_group} · {session.mode} · dif. {session.difficulty} · {new Date(session.started_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${done?'text-emerald-400 border-emerald-500/20 bg-emerald-900/15':'text-zinc-400 border-zinc-600 bg-zinc-800/40'}`}>{done?'Completa':'En curso'}</span>
          <span className="text-[10px] text-brand-muted">{session.message_count} msg</span>
          {open?<ChevronUp className="h-4 w-4 text-brand-muted"/>:<ChevronDown className="h-4 w-4 text-brand-muted"/>}
        </div>
      </button>
      {open&&(
        <div className="border-t border-zinc-800 px-4 py-3">
          {session.last_evaluation
            ? <><p className="text-[10px] uppercase text-brand-gold/50 mb-1">Última evaluación</p><p className="text-xs text-brand-text leading-relaxed whitespace-pre-wrap">{session.last_evaluation}</p></>
            : <p className="text-xs text-brand-muted/50">Sin evaluación registrada.</p>}
        </div>
      )}
    </div>
  );
}

// ── Tipos para leads reales del dashboard ────────────────────────────
type LeadsReal = {
  total: number; responded: number; interested: number;
  meetingScheduled: number; meetingProposed: number;
  responseRate: number; interestRate: number;
  byStatus: Record<string, number>;
};

// ── Ficha completa del setter (inline, sin navegación) ────────────────
function SetterFicha({ setterId, name }: { setterId: string; name: string }) {
  const [detail, setDetail] = useState<SetterDetail | null>(null);
  const [leadsReal, setLeadsReal] = useState<LeadsReal | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolution, setEvolution] = useState<EvolutionAI | null>(null);
  const [evoLoading, setEvoLoading] = useState(false);
  const [evoError, setEvoError] = useState<string|null>(null);

  useEffect(() => {
    // Carga en paralelo: ficha del setter + leads reales del mismo endpoint que usa el dashboard
    Promise.all([
      fetch(`/api/admin/setters/${setterId}`).then(r=>r.json()),
      fetch(`/api/admin/leads/metrics`).then(r=>r.json()),
    ]).then(([d, metricsData]) => {
      if (d.profile) setDetail(d);
      // Buscar este setter en el ranking de leads reales
      if (metricsData?.ranking) {
        const row = metricsData.ranking.find((r: any) => r.id === setterId);
        if (row) setLeadsReal(row);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [setterId]);

  async function generateEvolution() {
    setEvoLoading(true); setEvoError(null);
    try {
      const res = await fetch(`/api/admin/conversations/evolution?user_id=${setterId}`);
      const json = await res.json();
      if (!res.ok) { setEvoError(json.error??'Error'); return; }
      setEvolution(json);
    } catch { setEvoError('Error de conexión'); }
    finally { setEvoLoading(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>;
  if (!detail) return <p className="text-sm text-brand-muted py-8 text-center">No se pudo cargar la ficha.</p>;

  const { submissions, avg_form_score, category_scores, category_evolution,
    conversations, conv_cap_scores, trainer_sessions, leads, leads_summary,
    alerts, recommendations, conceptos_a_reforzar } = detail;

  const completedSubs = submissions.filter(s=>s.status==='analyzed');
  const catEntries    = Object.entries(category_scores).sort((a,b)=>a[1].avg-b[1].avg);
  const weakCats      = catEntries.filter(([,d])=>d.avg<6);

  const statusGroups: Record<string,Lead[]> = {};
  for (const lead of leads) {
    if (!statusGroups[lead.current_status]) statusGroups[lead.current_status]=[];
    statusGroups[lead.current_status].push(lead);
  }

  return (
    <div className="space-y-2">

      {/* Alertas */}
      {alerts.length>0&&(
        <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase text-red-400 flex items-center gap-1 mb-1.5"><AlertTriangle className="h-3 w-3"/>Alertas</p>
          {alerts.map((a,i)=><p key={i} className="text-xs text-red-300">• {a}</p>)}
        </div>
      )}

      {/* Análisis IA de evolución */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-900/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-violet-300 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5"/>Análisis de Evolución — Motor CAC</p>
          {!evolution&&(
            <button onClick={generateEvolution} disabled={evoLoading||conversations.length===0}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-900/20 px-3 py-1 text-[11px] text-violet-300 hover:bg-violet-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed">
              {evoLoading?<Loader2 className="h-3 w-3 animate-spin"/>:<Brain className="h-3 w-3"/>}
              {evoLoading?'Analizando…':'Generar análisis'}
            </button>
          )}
        </div>
        {conversations.length===0&&!evolution&&<p className="text-[11px] text-brand-muted/50">Necesita al menos 1 conversación para generar el análisis.</p>}
        {evoError&&<p className="text-xs text-red-400">{evoError}</p>}
        {evolution&&(
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-500/15 bg-[rgba(88,28,135,0.08)] p-3">
              <p className="text-xs text-violet-100 leading-relaxed">{evolution.resumen}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {evolution.capacidades?.fuertes?.length>0&&<div><p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Fuertes</p>{evolution.capacidades.fuertes.map((c:string,i:number)=><p key={i} className="text-xs text-brand-text">✓ {c}</p>)}</div>}
              {evolution.capacidades?.debiles?.length>0&&<div><p className="text-[10px] font-bold uppercase text-red-400 mb-1">Débiles</p>{evolution.capacidades.debiles.map((c:string,i:number)=><p key={i} className="text-xs text-brand-text">✗ {c}</p>)}</div>}
              {evolution.capacidades?.en_crecimiento?.length>0&&<div><p className="text-[10px] font-bold uppercase text-sky-400 mb-1">En crecimiento</p>{evolution.capacidades.en_crecimiento.map((c:string,i:number)=><p key={i} className="text-xs text-brand-text flex items-center gap-1"><TrendingUp className="h-3 w-3 text-sky-400 shrink-0"/>{c}</p>)}</div>}
              {evolution.capacidades?.en_riesgo?.length>0&&<div><p className="text-[10px] font-bold uppercase text-amber-400 mb-1">En riesgo</p>{evolution.capacidades.en_riesgo.map((c:string,i:number)=><p key={i} className="text-xs text-brand-text flex items-center gap-1"><TrendingDown className="h-3 w-3 text-amber-400 shrink-0"/>{c}</p>)}</div>}
            </div>
            {evolution.aprendizajes?.errores_repetidos?.length>0&&(
              <div><p className="text-[10px] font-bold uppercase text-red-400 mb-1">Errores que se repiten</p>
              {evolution.aprendizajes.errores_repetidos.map((e:string,i:number)=><p key={i} className="text-xs text-red-300">• {e}</p>)}</div>
            )}
            {evolution.aprendizajes?.mejoras_observadas?.length>0&&(
              <div><p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Mejoras observadas</p>
              {evolution.aprendizajes.mejoras_observadas.map((m:string,i:number)=><p key={i} className="text-xs text-brand-text flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400 shrink-0"/>{m}</p>)}</div>
            )}
            {evolution.recomendaciones&&(
              <div className="rounded-xl border border-violet-500/15 bg-violet-900/10 p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase text-violet-400 mb-1">Recomendaciones</p>
                {evolution.recomendaciones.que_entrenar&&<p className="text-xs text-brand-text"><span className="text-violet-400">Entrenar:</span> {evolution.recomendaciones.que_entrenar}</p>}
                {evolution.recomendaciones.clase_recomendada&&<p className="text-xs text-brand-text"><span className="text-violet-400">Clase urgente:</span> {evolution.recomendaciones.clase_recomendada}</p>}
                {evolution.recomendaciones.mentoria_sugerida&&<p className="text-xs text-brand-text"><span className="text-violet-400">Mentoría:</span> {evolution.recomendaciones.mentoria_sugerida}</p>}
              </div>
            )}
            <button onClick={()=>setEvolution(null)} className="text-[10px] text-brand-muted/40 hover:text-brand-muted transition">Regenerar</button>
          </div>
        )}
      </div>

      {/* Categorías CAC + promedio */}
      {catEntries.length>0&&(
        <>
          <SectionTitle label={`Conocimiento CAC — ${completedSubs.length} formulario${completedSubs.length!==1?'s':''} · Promedio: ${avg_form_score??'—'}/100`} />
          <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4 space-y-3">
            {CAT_ORDER.map(cat=>{const d=category_scores[cat];if(!d)return null;return<CatBar key={cat} label={d.label} avg={d.avg} evolution={category_evolution[cat]}/>;}) }
            {catEntries.filter(([cat])=>!CAT_ORDER.includes(cat)).map(([cat,d])=><CatBar key={cat} label={d.label} avg={d.avg} evolution={category_evolution[cat]}/>)}
            {(weakCats.length>0||conceptos_a_reforzar.length>0||recommendations.length>0)&&(
              <div className="pt-3 border-t border-zinc-800 space-y-2">
                {weakCats.length>0&&<div><p className="text-[10px] uppercase text-red-400 mb-1">Categorías débiles</p>{weakCats.map(([,d])=><p key={d.label} className="text-xs text-brand-text">✗ {d.label} ({d.avg}/10)</p>)}</div>}
                {conceptos_a_reforzar.length>0&&<div><p className="text-[10px] uppercase text-amber-400 mb-1">Conceptos a reforzar</p><div className="flex flex-wrap gap-1.5">{conceptos_a_reforzar.map((c,i)=><span key={i} className="text-[11px] px-2 py-0.5 rounded-lg border border-amber-500/20 text-amber-300">{c}</span>)}</div></div>}
                {recommendations.length>0&&<div><p className="text-[10px] uppercase text-amber-400 mb-1">Ejercicios sugeridos</p>{recommendations.map((r,i)=><p key={i} className="text-xs text-brand-text">• {r}</p>)}</div>}
              </div>
            )}
          </div>
        </>
      )}

      {/* Formularios */}
      {submissions.length>0&&(
        <>
          <SectionTitle label={`Formularios (${completedSubs.length} completados)`} />
          <div className="space-y-2">
            {[...submissions].reverse().map(sub=><SubCard key={sub.id} sub={sub}/>)}
          </div>
        </>
      )}

      {/* Conversaciones */}
      <SectionTitle label={`Conversaciones analizadas (${conversations.length})`} />
      {conversations.length===0
        ? <p className="text-xs text-brand-muted/50 italic py-2">Sin conversaciones cargadas.</p>
        : (
          <div className="space-y-2">
            {Object.keys(conv_cap_scores).length>0&&(
              <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-3 space-y-2 mb-2">
                <p className="text-[10px] uppercase text-brand-gold/50">Capacidades promedio en conversaciones reales</p>
                {Object.entries(conv_cap_scores).sort((a,b)=>b[1].avg-a[1].avg).map(([k,v])=>{
                  const pct=Math.round((v.avg/3)*100);
                  const color=v.avg>=2.5?'bg-emerald-500':v.avg>=1.5?'bg-amber-500':'bg-red-500';
                  return(
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-[11px] text-brand-muted truncate">{v.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800"><div className={`h-full rounded-full ${color}`} style={{width:`${pct}%`}}/></div>
                      <span className="text-[10px] text-brand-muted w-10 text-right">{v.avg>=2.5?'Alta':v.avg>=1.5?'Media':'Baja'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {conversations.map((conv,i)=><ConvCard key={conv.id} conv={conv} index={i}/>)}
          </div>
        )
      }

      {/* Trainer */}
      <SectionTitle label={`Sesiones de entrenamiento (${trainer_sessions.length})`} />
      {trainer_sessions.length===0
        ? <p className="text-xs text-brand-muted/50 italic py-2">Sin sesiones de entrenamiento.</p>
        : <div className="space-y-2">{[...trainer_sessions].reverse().map((s,i)=><TrainerCard key={s.id} session={s} index={i}/>)}</div>
      }

      {/* Leads — datos del mismo endpoint que el leads dashboard */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/60">
            Leads asignados ({leadsReal?.total ?? leads_summary.total})
          </p>
          <div className="flex-1 h-px bg-[rgba(212,175,55,0.08)]" />
        </div>
        <a
          href={`/api/admin/setters/${setterId}/leads`}
          download
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-900/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-900/20 transition"
        >
          <Download className="h-3 w-3" />
          Exportar Excel
        </a>
      </div>
      {(!leadsReal && leads_summary.total===0)
        ? <p className="text-xs text-brand-muted/50 italic py-2">Sin leads asignados.</p>
        : (() => {
            const lr = leadsReal;
            const total = lr?.total ?? leads_summary.total;
            if (total === 0) return <p className="text-xs text-brand-muted/50 italic py-2">Sin leads asignados.</p>;
            const byStatus = lr?.byStatus ?? leads_summary.leads_by_status ?? {};
            const respRate  = lr?.responseRate ?? leads_summary.response_rate;
            const interRate = lr?.interestRate ?? 0;
            const meetings  = lr?.meetingScheduled ?? leads_summary.meetings;
            return (
              <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4 space-y-4">
                {/* Barra proporcional por estado */}
                <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                  {[
                    {k:'REUNION_AGENDADA',    c:'bg-yellow-400'},
                    {k:'REUNION_PROPUESTA',   c:'bg-violet-500'},
                    {k:'DIAGNOSTICO_PROFUNDO',c:'bg-teal-500'},
                    {k:'DIAGNOSTICO_INICIADO',c:'bg-emerald-500'},
                    {k:'INTERES_DETECTADO',   c:'bg-yellow-600'},
                    {k:'RESPONDIO',           c:'bg-cyan-500'},
                    {k:'CONTACTADO',          c:'bg-sky-700'},
                    {k:'NO_RESPONDE',         c:'bg-zinc-600'},
                    {k:'APERTURA_ENVIADA',    c:'bg-blue-900'},
                    {k:'NO_CONTACTADO',       c:'bg-zinc-800'},
                  ].map(({k,c})=>{
                    const n = byStatus[k] ?? 0;
                    if (!n) return null;
                    return <div key={k} className={c} style={{width:`${(n/total)*100}%`}} title={`${STATUS_META[k]?.label??k}: ${n}`}/>;
                  })}
                </div>
                {/* Chips por estado */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(byStatus).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a).map(([st,cnt])=>{
                    const meta = STATUS_META[st];
                    return (
                      <span key={st} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${meta?.color??'bg-zinc-800 text-zinc-400'}`}>
                        <span className="font-bold">{cnt}</span>
                        <span className="opacity-75">{meta?.label??st}</span>
                      </span>
                    );
                  })}
                </div>
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {l:'% Respuesta', v:`${respRate}%`,  ok:respRate>=20},
                    {l:'% Interés',   v:`${interRate}%`, ok:interRate>=10},
                    {l:'Reuniones',   v:String(meetings), ok:meetings>0},
                  ].map(s=>(
                    <div key={s.l} className={`rounded-xl border p-2.5 text-center ${s.ok?'border-emerald-500/20 bg-emerald-900/10':'border-zinc-700'}`}>
                      <p className={`text-xl font-black ${s.ok?'text-emerald-400':'text-amber-400'}`}>{s.v}</p>
                      <p className="text-[10px] text-brand-muted">{s.l}</p>
                    </div>
                  ))}
                </div>
                {/* Diagnóstico */}
                <div className="space-y-1 pt-1 border-t border-zinc-800">
                  {respRate<10&&<p className="text-xs text-red-400">⚠ Menos del 10% de respuesta — revisar apertura y seguimiento.</p>}
                  {respRate>=10&&respRate<25&&<p className="text-xs text-amber-400">⚠ Tasa de respuesta baja ({respRate}%) — hay margen de mejora.</p>}
                  {(byStatus['NO_RESPONDE']??0)>total*0.4&&<p className="text-xs text-amber-400">⚠ {byStatus['NO_RESPONDE']} leads sin respuesta — considerar seguimiento diferente.</p>}
                  {(byStatus['NO_CALIFICA']??0)>meetings&&<p className="text-xs text-red-400">⚠ Más descartados que reuniones — revisar criterio de calificación.</p>}
                  {meetings>=3&&<p className="text-xs text-emerald-400">✓ {meetings} reuniones agendadas.</p>}
                </div>
              </div>
            );
          })()
      }
    </div>
  );
}

// ── Card de cada setter en la lista ───────────────────────────────────
function SetterCard({ setter, expanded, onToggle }: { setter: SetterRow; expanded: boolean; onToggle: () => void }) {
  const nivel = setter.nivel_general ? NIVEL_BADGE[setter.nivel_general] : null;
  return (
    <div className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] overflow-hidden">
      {/* Cabecera — click para expandir */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#111] transition group">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-sm font-bold text-brand-gold">
          {(setter.name[0]??'?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-brand-text">{setter.name}</span>
            {nivel&&<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${nivel}`}>{NIVEL_LABEL[setter.nivel_general!]}</span>}
            {setter.ai_risk_flags>0&&<span className="text-[10px] font-bold text-red-400 border border-red-500/20 bg-red-900/15 px-1.5 py-0.5 rounded-full">IA ×{setter.ai_risk_flags}</span>}
            {setter.forms_pending>0&&<span className="text-[10px] font-bold text-amber-400 border border-amber-500/20 bg-amber-900/15 px-1.5 py-0.5 rounded-full">{setter.forms_pending} pendiente{setter.forms_pending>1?'s':''}</span>}
            {setter.alerts.length>0&&<span className="text-[10px] font-bold text-amber-400 border border-amber-500/20 bg-amber-900/15 px-1.5 py-0.5 rounded-full">⚠ {setter.alerts.length}</span>}
          </div>
          <p className="text-[11px] text-brand-muted mt-0.5">
            {setter.leads_total>0 && <><span className="text-brand-text font-semibold">{setter.leads_total}</span> leads · </>}
            {setter.leads_meetings>0 && <><span className="text-yellow-400 font-bold">{setter.leads_meetings} reunión{setter.leads_meetings>1?'es':''}</span> · </>}
            {setter.leads_response_rate>0 && <><span>{setter.leads_response_rate}% resp</span> · </>}
            {setter.forms_completed} form{setter.forms_completed!==1?'s':''} · {setter.points} XP
          </p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className={`text-2xl font-black ${scoreColor(setter.avg_score)}`}>{setter.avg_score??'—'}</p>
          <p className="text-[10px] text-brand-muted">/100</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-brand-gold shrink-0"/> : <ChevronDown className="h-4 w-4 text-brand-muted shrink-0 group-hover:text-brand-text"/>}
      </button>

      {/* Datos completos — inline, sin navegación */}
      {expanded && (
        <div className="border-t border-[rgba(212,175,55,0.1)] bg-[#080808] px-4 pb-6 pt-4">
          <SetterFicha setterId={setter.user_id} name={setter.name} />
        </div>
      )}
    </div>
  );
}

// ── Tipos análisis de equipo ──────────────────────────────────────────
type PuntoCritico = { problema: string; evidencia: string; impacto: string; accion: string };
type DiagnosisData = {
  estado_actual: string; fortalezas: string[];
  puntos_criticos: PuntoCritico[];
  patron_del_equipo: string; proxima_prioridad: string;
};
type DiagnosticRecord = {
  id: number; diagnosis: DiagnosisData;
  meta: { date: string; setters: number; forms: number; conversations: number; trainer_sessions: number; leads: number; docs_loaded: number };
  created_at: string;
};

function DiagnosisContent({ d }: { d: DiagnosisData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.05)] p-4">
        <p className="text-[10px] font-bold uppercase text-brand-gold mb-2">Estado actual</p>
        <p className="text-sm text-brand-text leading-relaxed">{d.estado_actual}</p>
      </div>
      {d.fortalezas?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase text-emerald-400 mb-2 flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3"/>Fortalezas
          </p>
          <div className="space-y-1.5">
            {d.fortalezas.map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-emerald-500/10 bg-emerald-900/5 px-3 py-2">
                <span className="text-emerald-400 text-xs mt-0.5 shrink-0">✓</span>
                <p className="text-xs text-brand-text leading-relaxed">{f}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.puntos_criticos?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase text-red-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3"/>Puntos críticos
          </p>
          <div className="space-y-3">
            {d.puntos_criticos.map((p, i) => (
              <div key={i} className="rounded-xl border border-red-500/15 bg-red-900/5 p-4 space-y-2">
                <p className="text-sm font-bold text-red-300">{p.problema}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><p className="text-[9px] font-bold uppercase text-zinc-500 mb-0.5">Evidencia</p><p className="text-xs text-brand-muted leading-snug">{p.evidencia}</p></div>
                  <div><p className="text-[9px] font-bold uppercase text-zinc-500 mb-0.5">Impacto</p><p className="text-xs text-brand-muted leading-snug">{p.impacto}</p></div>
                  <div><p className="text-[9px] font-bold uppercase text-amber-400/70 mb-0.5">Acción</p><p className="text-xs text-amber-200 leading-snug">{p.accion}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.patron_del_equipo && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-900/5 p-4">
          <p className="text-[10px] font-bold uppercase text-violet-400 mb-2 flex items-center gap-1.5"><Target className="h-3 w-3"/>Patrón del equipo</p>
          <p className="text-sm text-brand-text leading-relaxed">{d.patron_del_equipo}</p>
        </div>
      )}
      {d.proxima_prioridad && (
        <div className="rounded-xl border border-brand-gold/25 bg-[rgba(212,175,55,0.08)] p-4">
          <p className="text-[10px] font-bold uppercase text-brand-gold mb-2">Prioridad de la semana</p>
          <p className="text-sm font-semibold text-brand-gold leading-relaxed">{d.proxima_prioridad}</p>
        </div>
      )}
    </div>
  );
}

function TeamDiagnosticsPanel() {
  const [records, setRecords]       = useState<DiagnosticRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [histOpen, setHistOpen]     = useState(false);
  const [selectedId, setSelectedId] = useState<number|null>(null);

  useEffect(() => {
    fetch('/api/admin/team/diagnostics?limit=30')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRecords(d); })
      .finally(() => setLoading(false));
  }, []);

  const latest   = records[0] ?? null;
  const history  = records.slice(1);
  const selected = selectedId !== null ? records.find(r => r.id === selectedId) : null;

  if (loading) return (
    <div className="rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.03)] p-6 flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-brand-gold"/>
      <p className="text-xs text-brand-muted">Cargando diagnóstico del equipo…</p>
    </div>
  );

  if (!latest) return (
    <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-5 text-center">
      <Sparkles className="h-5 w-5 text-brand-gold/40 mx-auto mb-2"/>
      <p className="text-xs text-brand-muted">El primer diagnóstico se generará automáticamente esta noche.</p>
      <p className="text-[10px] text-brand-muted/50 mt-1">El sistema corre todos los días a las 8:00 AM.</p>
    </div>
  );

  const active = selected ?? latest;

  return (
    <div className="rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.03)] overflow-hidden">

      {/* Header con fecha y stats */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-brand-gold/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-gold"/>
          <p className="text-sm font-bold text-brand-text">Diagnóstico de Equipo</p>
          <span className="text-[10px] text-brand-muted/50">Motor CAC · o3</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={() => setHistOpen(o=>!o)}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-zinc-600 transition">
              {histOpen ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
              Historial ({records.length})
            </button>
          )}
        </div>
      </div>

      {/* Historial de fechas */}
      {histOpen && history.length > 0 && (
        <div className="border-b border-zinc-800 px-4 py-3 flex gap-2 flex-wrap bg-[#080808]">
          <button
            onClick={() => setSelectedId(null)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition ${
              selectedId === null
                ? 'border-brand-gold/40 bg-[rgba(212,175,55,0.12)] text-brand-gold'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            Hoy — {new Date(latest.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}
          </button>
          {history.map(r => (
            <button key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition ${
                selectedId === r.id
                  ? 'border-brand-gold/40 bg-[rgba(212,175,55,0.12)] text-brand-gold'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {new Date(r.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}
            </button>
          ))}
        </div>
      )}

      {/* Meta del diagnóstico activo */}
      <div className="px-4 pt-3 pb-1 flex flex-wrap gap-3">
        <span className="text-[10px] text-brand-muted/50">
          {new Date(active.created_at).toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
        </span>
        <span className="text-[10px] text-brand-muted/40">·</span>
        <span className="text-[10px] text-brand-muted/50">{active.meta.setters} setters</span>
        <span className="text-[10px] text-brand-muted/50">{active.meta.conversations} convs</span>
        <span className="text-[10px] text-brand-muted/50">{active.meta.leads} leads</span>
        <span className="text-[10px] text-brand-muted/50">{active.meta.docs_loaded} docs CAC</span>
      </div>

      {/* Diagnóstico */}
      <div className="px-4 pb-5 pt-3">
        <DiagnosisContent d={active.diagnosis} />
      </div>

    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────
type Filter = 'all'|'alerts'|'inactive'|'at_risk'|'advanced';

export default function AdminSettersPage() {
  const [data, setData]       = useState<DashData|null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [openForm, setOpenForm] = useState<string|null>(null);

  useEffect(()=>{
    fetch('/api/admin/setters').then(r=>r.json()).then(d=>{if(d.team_stats)setData(d);setLoading(false);});
  },[]);

  const toggle = useCallback((id:string)=>{
    setExpanded(prev => prev===id ? null : id);
  },[]);

  const visible = useMemo(()=>{
    if (!data) return [];
    switch(filter){
      case 'alerts':   return data.setters.filter(s=>s.alerts.length>0);
      case 'inactive': return data.setters.filter(s=>s.forms_completed===0);
      case 'at_risk':  return data.setters.filter(s=>s.ai_risk_flags>0||(s.avg_score!==null&&s.avg_score<50));
      case 'advanced': return data.setters.filter(s=>(s.avg_score??0)>=70);
      default:         return data.setters;
    }
  },[data,filter]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold"/></div>;

  const stats      = data?.team_stats;
  const cats       = data?.team_category_avgs??[];
  const setters    = data?.setters??[];
  const compliance = data?.form_compliance??[];
  const withAlerts = setters.filter(s=>s.alerts.length>0).sort((a,b)=>b.alerts.length-a.alerts.length);

  const FILTERS: {k:Filter;l:string}[] = [
    {k:'all',      l:`Todos (${setters.length})`},
    {k:'alerts',   l:`Alertas (${setters.filter(s=>s.alerts.length>0).length})`},
    {k:'inactive', l:`Sin actividad (${setters.filter(s=>s.forms_completed===0).length})`},
    {k:'at_risk',  l:`En riesgo (${setters.filter(s=>s.ai_risk_flags>0||(s.avg_score!==null&&s.avg_score<50)).length})`},
    {k:'advanced', l:`Avanzados (${setters.filter(s=>(s.avg_score??0)>=70).length})`},
  ];

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-8">

      <div>
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Equipo</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Setters</h1>
        <p className="text-sm text-brand-muted mt-0.5">Clickeá cualquier setter para ver todos sus datos y evolución.</p>
      </div>

      {/* Stats generales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {l:'Setters',            v:stats?.total_setters??0,              c:'text-brand-text'},
          {l:'Activos',            v:stats?.active_setters??0,             c:'text-emerald-400'},
          {l:'Promedio equipo',    v:stats?.team_avg_score!=null?`${stats.team_avg_score}/100`:'—', c:scoreColor(stats?.team_avg_score??null)},
          {l:'Forms activos',      v:stats?.active_forms??0,               c:'text-brand-gold'},
          {l:'Respuestas totales', v:stats?.total_submissions??0,          c:'text-sky-400'},
          {l:'Con alertas',        v:stats?.alerts_count??0,               c:(stats?.alerts_count??0)>0?'text-red-400':'text-zinc-500'},
        ].map(s=>(
          <div key={s.l} className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-3">
            <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
            <p className="text-[10px] font-semibold text-brand-muted mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Formularios — compliance */}
      {compliance.length>0&&(
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-gold"/>
            <h2 className="text-sm font-bold text-brand-text">Formularios activos</h2>
          </div>
          {compliance.map(fc=>{
            const pct=fc.total_setters>0?Math.round((fc.submitted_count/fc.total_setters)*100):0;
            const isOpen=openForm===fc.form_id;
            return(
              <div key={fc.form_id} className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] overflow-hidden">
                <button onClick={()=>setOpenForm(isOpen?null:fc.form_id)} className="w-full flex items-start gap-4 px-4 py-3.5 hover:bg-[#111] transition text-left">
                  <div className="flex-1 min-w-0">
                    {fc.form_topic&&<p className="text-[10px] uppercase text-brand-gold/50 mb-0.5">{fc.form_topic}</p>}
                    <p className="text-sm font-semibold text-brand-text">{fc.form_title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 max-w-40 h-1.5 rounded-full bg-zinc-800">
                        <div className={`h-1.5 rounded-full ${pct===100?'bg-emerald-500':pct>50?'bg-amber-500':'bg-red-500'}`} style={{width:`${pct}%`}}/>
                      </div>
                      <span className="text-[11px] font-bold text-brand-muted">{fc.submitted_count}/{fc.total_setters} respondieron</span>
                      {fc.avg_score!=null&&<span className={`text-[11px] font-bold ${scoreColor(fc.avg_score)}`}>Prom: {fc.avg_score}/100</span>}
                    </div>
                  </div>
                  {isOpen?<ChevronUp className="h-4 w-4 text-brand-muted shrink-0"/>:<ChevronDown className="h-4 w-4 text-brand-muted shrink-0"/>}
                </button>
                {isOpen&&(
                  <div className="border-t border-zinc-800 px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Respondieron ({fc.submitted_count})</p>
                      {fc.submitted.length===0?<p className="text-xs text-brand-muted">Nadie respondió.</p>:fc.submitted.map(s=>(
                        <div key={s.user_id} className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-brand-text truncate">{s.name}</span>
                          <span className={`text-xs font-black ml-auto shrink-0 ${scoreColor(s.total_score)}`}>{s.total_score??'—'}</span>
                          {s.ai_risk==='alto'&&<span className="text-[9px] font-bold text-red-400 border border-red-500/20 px-1 py-0.5 rounded shrink-0">IA</span>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-amber-400 mb-2 flex items-center gap-1"><XCircle className="h-3 w-3"/>Pendientes ({fc.pending.length})</p>
                      {fc.pending.length===0?<p className="text-xs text-emerald-400 font-semibold">¡Todos respondieron!</p>:fc.pending.map(p=>(
                        <div key={p.user_id} className="flex items-center gap-1.5 mb-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"/>
                          <span className="text-xs text-brand-muted">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Categorías débiles del equipo */}
      {cats.length>0&&(
        <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-4 w-4 text-brand-gold"/>
            <p className="text-sm font-bold text-brand-text">Qué reforzar — promedio del equipo</p>
          </div>
          <div className="space-y-2">
            {cats.map((c,i)=>{
              const pct=Math.max(0,Math.min(100,(c.avg/10)*100));
              const color=c.avg>=7?'bg-emerald-500':c.avg>=5?'bg-amber-500':'bg-red-500';
              const tc=c.avg>=7?'text-emerald-400':c.avg>=5?'text-amber-400':'text-red-400';
              return(
                <div key={c.cat}>
                  {i===0&&cats.length>3&&<p className="text-[9px] uppercase text-red-400 font-bold mb-1">▼ Más débiles</p>}
                  {i===Math.ceil(cats.length/2)&&<p className="text-[9px] uppercase text-emerald-400 font-bold mt-2 mb-1">▲ Más fuertes</p>}
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-brand-muted w-44 shrink-0 truncate">{c.label}</p>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800"><div className={`h-2 rounded-full ${color}`} style={{width:`${pct}%`}}/></div>
                    <span className={`text-[11px] font-bold w-8 text-right ${tc}`}>{c.avg}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Diagnóstico automático de equipo */}
      <TeamDiagnosticsPanel />

      {/* Lista de setters con expansión inline */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-brand-gold"/>
          <h2 className="text-sm font-bold text-brand-text">Equipo</h2>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-4">
          {FILTERS.map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${filter===f.k?'border-brand-gold/40 bg-[rgba(212,175,55,0.1)] text-brand-gold':'border-zinc-800 text-brand-muted hover:text-brand-text'}`}>
              {f.l}
            </button>
          ))}
        </div>

        {visible.length===0
          ? <div className="flex h-24 items-center justify-center rounded-xl border border-zinc-800"><p className="text-sm text-brand-muted">Sin setters en esta categoría.</p></div>
          : <div className="space-y-2">
              {visible.map(s=>(
                <SetterCard
                  key={s.user_id}
                  setter={s}
                  expanded={expanded===s.user_id}
                  onToggle={()=>toggle(s.user_id)}
                />
              ))}
            </div>
        }
      </section>

    </div>
  );
}
