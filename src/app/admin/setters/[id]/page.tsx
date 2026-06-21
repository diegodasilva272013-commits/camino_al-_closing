'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertTriangle, Brain, Zap, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Sparkles, CheckCircle, Target,
} from 'lucide-react';

// ── tipos ────────────────────────────────────────────────────────────
type Profile      = { id: string; full_name: string; email: string; role: string; created_at: string; points: number };
type CatScore     = { avg: number; count: number; label: string };
type CatPoint     = { date: string; score: number; form: string };
type Answer       = { id: string; question_id: string; answer_text: string; score: number | null; analysis: any; question: { question_text: string; category: string | null; is_bonus: boolean; order_index: number } | null };
type Submission   = { id: string; form_title: string; form_topic: string | null; total_score: number | null; ai_risk: string | null; nivel_general: string | null; status: string; submitted_at: string; analysis: any; answers: Answer[] };
type Conversation = { id: string; created_at: string; analysis: any; reflection: { xp_earned: number; status: string; evaluation: any; answers: Record<string, string> } | null };
type TrainerSession = { id: string; scenario_name: string; scenario_group: string; scenario_tag: string; difficulty: number; mode: string; started_at: string; ended_at: string | null; message_count: number; evaluations_count: number; last_evaluation: string | null; status: string };
type Lead         = { id: string; first_name: string; last_name: string; phone: string; current_status: string; is_closed: boolean; follow_up_count: number; updated_at: string };
type LeadsSummary = { total: number; contacted: number; responded: number; interested: number; meetings: number; no_fit: number; closed: number; contact_rate: number; response_rate: number; meeting_rate: number };
type EvolutionAI  = { resumen: string; capacidades: any; patrones: any; aprendizajes: any; recomendaciones: any };

type SetterData = {
  profile: Profile;
  submissions: Submission[];
  avg_form_score: number | null;
  category_scores: Record<string, CatScore>;
  category_evolution: Record<string, CatPoint[]>;
  conversations: Conversation[];
  conv_cap_scores: Record<string, { label: string; avg: number }>;
  trainer_sessions: TrainerSession[];
  leads: Lead[];
  leads_summary: LeadsSummary;
  alerts: string[];
  recommendations: string[];
  conceptos_a_reforzar: string[];
};

// ── constantes ───────────────────────────────────────────────────────
const NIVEL_LABEL: Record<string, { l: string; c: string }> = {
  principiante: { l: 'Principiante', c: 'text-zinc-400 border-zinc-600 bg-zinc-800/40' },
  en_desarrollo: { l: 'En desarrollo', c: 'text-sky-400 border-sky-500/20 bg-sky-900/15' },
  intermedio:    { l: 'Intermedio',    c: 'text-amber-400 border-amber-500/20 bg-amber-900/15' },
  avanzado:      { l: 'Avanzado',      c: 'text-emerald-400 border-emerald-500/20 bg-emerald-900/15' },
};

const STATUS_LABEL: Record<string, string> = {
  NO_CONTACTADO: 'Sin contactar', APERTURA_ENVIADA: 'Apertura enviada',
  CONTACTADO: 'Contactado', RESPONDIO: 'Respondió', INTERES_DETECTADO: 'Interesado',
  INVITADO_AL_GRUPO: 'Invitado al grupo', INGRESO_AL_GRUPO: 'Ingresó al grupo',
  ACTIVO_EN_GRUPO: 'Activo en grupo', DIAGNOSTICO_INICIADO: 'Diagnóstico iniciado',
  DIAGNOSTICO_PROFUNDO: 'Diagnóstico profundo', REUNION_PROPUESTA: 'Reunión propuesta',
  REUNION_AGENDADA: 'Reunión agendada', NO_CALIFICA: 'No califica',
};

const CAT_ORDER = ['cerebro_predictivo','cingulo','amigdala','lobulo_frontal','rapport_falso','rapport_genuino','conexion_genuina','criterio_comercial','aplicacion_practica'];

// ── componentes pequeños ─────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-brand-gold">{label}</h2>
      {count !== undefined && <span className="text-[10px] border border-[rgba(212,175,55,0.2)] text-brand-gold/60 px-1.5 py-0.5 rounded">{count}</span>}
      <div className="flex-1 h-px bg-[rgba(212,175,55,0.1)]" />
    </div>
  );
}

function CatBar({ label, avg, evolution }: { label: string; avg: number; evolution?: CatPoint[] }) {
  const pct        = Math.max(0, Math.min(100, (avg / 10) * 100));
  const color      = avg >= 7 ? 'bg-emerald-500' : avg >= 5 ? 'bg-amber-500' : 'bg-red-500';
  const scoreColor = avg >= 7 ? 'text-emerald-400' : avg >= 5 ? 'text-amber-400' : 'text-red-400';
  let trend: 'up'|'down'|'flat'|null = null;
  if (evolution && evolution.length >= 2) {
    const diff = evolution[evolution.length - 1].score - evolution[evolution.length - 2].score;
    trend = diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'flat';
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-brand-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          {trend === 'up'   && <TrendingUp   className="h-3 w-3 text-emerald-400" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
          {trend === 'flat' && <Minus        className="h-3 w-3 text-zinc-500" />}
          <span className={`text-xs font-bold ${scoreColor}`}>{avg}/10</span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {evolution && evolution.length > 1 && (
        <div className="flex items-end gap-0.5 h-4">
          {evolution.map((p, i) => {
            const h = Math.max(4, Math.round((p.score / 10) * 16));
            const c = p.score >= 7 ? 'bg-emerald-500/60' : p.score >= 5 ? 'bg-amber-500/60' : 'bg-red-500/60';
            return <div key={i} className={`w-1.5 rounded-sm ${c}`} style={{ height: `${h}px` }} title={`${p.form}: ${p.score}/10`} />;
          })}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ sub }: { sub: Submission }) {
  const [open, setOpen] = useState(false);
  const a    = sub.analysis ?? {};
  const nivel = sub.nivel_general ? NIVEL_LABEL[sub.nivel_general] : null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0a] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#111] transition">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text">{sub.form_title}</p>
          {sub.form_topic && <p className="text-[10px] text-brand-muted/60">{sub.form_topic}</p>}
          <p className="text-[10px] text-brand-muted mt-0.5">
            {new Date(sub.submitted_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sub.total_score != null && (
            <span className={`text-xl font-black ${sub.total_score >= 70 ? 'text-emerald-400' : sub.total_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {sub.total_score}
            </span>
          )}
          {nivel && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${nivel.c}`}>{nivel.l}</span>}
          {sub.ai_risk === 'alto' && <span className="text-[10px] font-bold text-red-400 border border-red-500/20 bg-red-900/15 px-1.5 py-0.5 rounded-full">IA</span>}
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
          {a.alertas?.length > 0 && (
            <div className="space-y-1">
              {a.alertas.map((al: string, i: number) => <p key={i} className="text-[11px] text-amber-400">⚠ {al}</p>)}
            </div>
          )}
          <div className="space-y-3">
            {sub.answers.map((ans, i) => {
              const qs = a.question_scores?.[ans.question_id];
              return (
                <div key={ans.id} className="rounded-xl border border-zinc-800/60 bg-[#111] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-brand-gold/50 shrink-0 mt-0.5">P{i+1}{ans.question?.is_bonus ? ' 🎯' : ''}</span>
                    <p className="text-[11px] text-brand-muted flex-1 leading-snug">{ans.question?.question_text}</p>
                    {qs && <span className={`text-sm font-black shrink-0 ${qs.score>=7?'text-emerald-400':qs.score>=5?'text-amber-400':'text-red-400'}`}>{qs.score}/10</span>}
                  </div>
                  <div className="rounded-lg border border-zinc-700/40 bg-[#0d0d0d] px-3 py-2">
                    <p className="text-xs text-brand-text whitespace-pre-wrap leading-relaxed">{ans.answer_text}</p>
                  </div>
                  {qs?.feedback && (
                    <div className={`rounded-lg px-2.5 py-1.5 ${qs.parece_ia ? 'border border-red-500/15 bg-red-900/10' : 'border border-zinc-800/50'}`}>
                      {qs.parece_ia && <p className="text-[10px] text-red-400 font-bold mb-0.5">Posible IA</p>}
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

function ConversationCard({ conv, index }: { conv: Conversation; index: number }) {
  const [open, setOpen] = useState(false);
  const a = conv.analysis ?? {};
  const r = conv.reflection;
  const caps = a.capacidades_impactadas ?? {};

  const capColor = (v: string) => v === 'alta' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/20' : v === 'media' ? 'text-amber-400 bg-amber-900/20 border-amber-500/20' : 'text-red-400 bg-red-900/20 border-red-500/20';

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0a] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#111] transition">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text">Conversación #{index + 1}</p>
          <p className="text-[10px] text-brand-muted mt-0.5">
            {new Date(conv.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            {a.resultado_probable && <span className="ml-2 text-brand-muted/60">· {a.resultado_probable}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r?.status === 'approved' && <span className="text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-900/15 px-1.5 py-0.5 rounded-full">+{r.xp_earned} XP</span>}
          {r && r.status !== 'approved' && <span className="text-[10px] text-brand-muted border border-zinc-700 px-1.5 py-0.5 rounded-full">{r.status}</span>}
          {!r && <span className="text-[10px] text-brand-muted/40">sin reflexión</span>}
          {open ? <ChevronUp className="h-4 w-4 text-brand-muted" /> : <ChevronDown className="h-4 w-4 text-brand-muted" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          {/* Capacidades */}
          {Object.keys(caps).length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-brand-gold/50 mb-2">Capacidades impactadas</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(caps).filter(([,v]) => v !== 'no_mostrada').map(([k, v]) => (
                  <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${capColor(String(v))}`}>
                    {k.replace(/_/g,' ')} · {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Análisis */}
          {a.fortalezas?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-emerald-400/60 mb-1">Fortalezas</p>
              {a.fortalezas.map((f: string, i: number) => <p key={i} className="text-xs text-brand-text">✓ {f}</p>)}
            </div>
          )}
          {a.errores?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-red-400/60 mb-1">Errores</p>
              {a.errores.map((e: string, i: number) => <p key={i} className="text-xs text-brand-text">✗ {e}</p>)}
            </div>
          )}
          {a.donde_se_rompio && (
            <div className="rounded-xl border border-red-500/15 bg-red-900/10 p-3">
              <p className="text-[10px] uppercase text-red-400/60 mb-1">Punto de quiebre</p>
              <p className="text-xs text-brand-text">{a.donde_se_rompio}</p>
            </div>
          )}
          {a.que_haria_operador_cac && (
            <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-3">
              <p className="text-[10px] uppercase text-brand-gold/60 mb-1">Qué haría el operador CAC</p>
              <p className="text-xs text-brand-text">{a.que_haria_operador_cac}</p>
            </div>
          )}
          {/* Reflexión del setter */}
          {r && (
            <div className="rounded-xl border border-zinc-700 bg-[#111] p-3 space-y-2">
              <p className="text-[10px] uppercase text-brand-gold/50">Reflexión del setter</p>
              {r.answers && Object.entries(r.answers).map(([k, v]) => v && (
                <div key={k}>
                  <p className="text-[10px] text-brand-muted capitalize">{k.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-brand-text">{String(v)}</p>
                </div>
              ))}
              {r.evaluation?.feedback && (
                <div className="mt-2 border-t border-zinc-700 pt-2">
                  <p className="text-[10px] uppercase text-brand-gold/50 mb-1">Evaluación del Motor CAC</p>
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

function TrainerCard({ session, index }: { session: TrainerSession; index: number }) {
  const [open, setOpen] = useState(false);
  const done = session.status === 'finished' || session.ended_at;
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0a] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#111] transition">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text">{session.scenario_name}</p>
          <p className="text-[10px] text-brand-muted mt-0.5">
            {session.scenario_group} · {session.mode} · dificultad {session.difficulty}
            <span className="mx-1">·</span>
            {new Date(session.started_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${done ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/15' : 'text-zinc-400 border-zinc-600 bg-zinc-800/40'}`}>
            {done ? 'Completa' : 'En curso'}
          </span>
          <span className="text-[10px] text-brand-muted">{session.message_count} msg</span>
          {open ? <ChevronUp className="h-4 w-4 text-brand-muted" /> : <ChevronDown className="h-4 w-4 text-brand-muted" />}
        </div>
      </button>
      {open && session.last_evaluation && (
        <div className="border-t border-zinc-800 p-4">
          <p className="text-[10px] uppercase text-brand-gold/50 mb-2">Última evaluación del trainer</p>
          <p className="text-xs text-brand-text leading-relaxed whitespace-pre-wrap">{session.last_evaluation}</p>
        </div>
      )}
      {open && !session.last_evaluation && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="text-xs text-brand-muted/50">Sin evaluación registrada en esta sesión.</p>
        </div>
      )}
    </div>
  );
}

// ── página principal ─────────────────────────────────────────────────
export default function SetterFichaPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [data, setData] = useState<SetterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolution, setEvolution] = useState<EvolutionAI | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionError,   setEvolutionError]   = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/setters/${id}`).then(r => r.json()).then(d => {
      if (d.profile) setData(d);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function generateEvolution() {
    setEvolutionLoading(true);
    setEvolutionError(null);
    try {
      const res  = await fetch(`/api/admin/conversations/evolution?user_id=${id}`);
      const json = await res.json();
      if (!res.ok) { setEvolutionError(json.error ?? 'Error al generar'); return; }
      setEvolution(json);
    } catch {
      setEvolutionError('Error de conexión');
    } finally {
      setEvolutionLoading(false);
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>;
  if (!data)   return null;

  const { profile, submissions, avg_form_score, category_scores, category_evolution,
    conversations, conv_cap_scores, trainer_sessions, leads, leads_summary, alerts,
    recommendations, conceptos_a_reforzar } = data;

  const completedSubs = submissions.filter(s => s.status === 'analyzed');
  const lastSub = completedSubs[completedSubs.length - 1];
  const nivel   = lastSub?.nivel_general ? NIVEL_LABEL[lastSub.nivel_general] : null;
  const catEntries = Object.entries(category_scores).sort((a, b) => a[1].avg - b[1].avg);
  const weakCats   = catEntries.filter(([, d]) => d.avg < 6);

  const statusGroups: Record<string, Lead[]> = {};
  for (const lead of leads) {
    const s = lead.current_status;
    if (!statusGroups[s]) statusGroups[s] = [];
    statusGroups[s].push(lead);
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-10">

      {/* Volver */}
      <button onClick={() => router.push('/admin/setters')} className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft className="h-4 w-4" /> Todos los setters
      </button>

      {/* ── Cabecera del setter ── */}
      <div className="rounded-2xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[rgba(212,175,55,0.12)] text-xl font-black text-brand-gold">
            {(profile.full_name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-brand-text">{profile.full_name ?? '—'}</h1>
            <p className="text-sm text-brand-muted">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] uppercase text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded">{profile.role}</span>
              {nivel && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${nivel.c}`}>{nivel.l}</span>}
              <span className="text-[10px] text-brand-muted">{profile.points ?? 0} XP</span>
              <span className="text-[10px] text-brand-muted">
                desde {new Date(profile.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
          {avg_form_score !== null && (
            <div className="text-right shrink-0">
              <p className={`text-4xl font-black ${avg_form_score >= 70 ? 'text-emerald-400' : avg_form_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{avg_form_score}</p>
              <p className="text-[10px] text-brand-muted">prom. formularios</p>
            </div>
          )}
        </div>

        {/* Totales de actividad */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { l: 'Leads',         v: leads_summary.total },
            { l: 'Convos',        v: conversations.length },
            { l: 'Trainer',       v: trainer_sessions.length },
            { l: 'Formularios',   v: completedSubs.length },
          ].map(s => (
            <div key={s.l} className="rounded-xl border border-zinc-800 bg-[#111] p-2 text-center">
              <p className="text-xl font-black text-brand-text">{s.v}</p>
              <p className="text-[10px] text-brand-muted">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alertas ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-4 space-y-1">
          <p className="text-xs font-bold uppercase text-red-400 flex items-center gap-1 mb-2"><AlertTriangle className="h-3.5 w-3.5" />Alertas</p>
          {alerts.map((a, i) => <p key={i} className="text-sm text-red-300">• {a}</p>)}
        </div>
      )}

      {/* ── Análisis de Evolución IA ── */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-900/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-violet-300 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />Análisis de Evolución — Motor CAC
          </p>
          {!evolution && (
            <button
              onClick={generateEvolution}
              disabled={evolutionLoading || conversations.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-900/20 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {evolutionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              {evolutionLoading ? 'Analizando…' : 'Generar análisis'}
            </button>
          )}
        </div>

        {conversations.length === 0 && !evolution && (
          <p className="text-xs text-brand-muted/60">Necesita al menos 1 conversación analizada para generar el análisis de evolución.</p>
        )}
        {evolutionError && <p className="text-xs text-red-400">{evolutionError}</p>}

        {evolution && (
          <div className="space-y-4">
            <div className="rounded-xl border border-violet-500/15 bg-[rgba(88,28,135,0.08)] p-3">
              <p className="text-xs text-violet-100 leading-relaxed">{evolution.resumen}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {evolution.capacidades?.fuertes?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Capacidades fuertes</p>
                  {evolution.capacidades.fuertes.map((c: string, i: number) => <p key={i} className="text-xs text-brand-text">✓ {c}</p>)}
                </div>
              )}
              {evolution.capacidades?.debiles?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Necesita refuerzo</p>
                  {evolution.capacidades.debiles.map((c: string, i: number) => <p key={i} className="text-xs text-brand-text">✗ {c}</p>)}
                </div>
              )}
              {evolution.capacidades?.en_crecimiento?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-sky-400 mb-1">En crecimiento</p>
                  {evolution.capacidades.en_crecimiento.map((c: string, i: number) => <p key={i} className="text-xs text-brand-text flex items-center gap-1"><TrendingUp className="h-3 w-3 text-sky-400 shrink-0" />{c}</p>)}
                </div>
              )}
              {evolution.capacidades?.en_riesgo?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-400 mb-1">En riesgo</p>
                  {evolution.capacidades.en_riesgo.map((c: string, i: number) => <p key={i} className="text-xs text-brand-text flex items-center gap-1"><TrendingDown className="h-3 w-3 text-amber-400 shrink-0" />{c}</p>)}
                </div>
              )}
            </div>
            {evolution.aprendizajes?.errores_repetidos?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Errores que se repiten</p>
                {evolution.aprendizajes.errores_repetidos.map((e: string, i: number) => <p key={i} className="text-xs text-red-300">• {e}</p>)}
              </div>
            )}
            {evolution.aprendizajes?.mejoras_observadas?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Mejoras observadas</p>
                {evolution.aprendizajes.mejoras_observadas.map((m: string, i: number) => (
                  <p key={i} className="text-xs text-brand-text flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />{m}</p>
                ))}
              </div>
            )}
            {evolution.recomendaciones && (
              <div className="rounded-xl border border-violet-500/15 bg-violet-900/10 p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-violet-400 mb-2">Recomendaciones</p>
                {evolution.recomendaciones.que_entrenar && <p className="text-xs text-brand-text"><span className="text-violet-400">Entrenar:</span> {evolution.recomendaciones.que_entrenar}</p>}
                {evolution.recomendaciones.clase_recomendada && <p className="text-xs text-brand-text"><span className="text-violet-400">Clase urgente:</span> {evolution.recomendaciones.clase_recomendada}</p>}
                {evolution.recomendaciones.mentoria_sugerida && <p className="text-xs text-brand-text"><span className="text-violet-400">Mentoría:</span> {evolution.recomendaciones.mentoria_sugerida}</p>}
              </div>
            )}
            <button onClick={() => setEvolution(null)} className="text-[10px] text-brand-muted/40 hover:text-brand-muted transition">Regenerar</button>
          </div>
        )}
      </div>

      {/* ── Scores por categoría (formularios) ── */}
      {catEntries.length > 0 && (
        <div>
          <SectionHeader label="Conocimiento CAC por categoría" count={completedSubs.length} />
          <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-5 space-y-4">
            {CAT_ORDER.map(cat => {
              const d = category_scores[cat];
              if (!d) return null;
              return <CatBar key={cat} label={d.label} avg={d.avg} evolution={category_evolution[cat]} />;
            })}
            {catEntries.filter(([cat]) => !CAT_ORDER.includes(cat)).map(([cat, d]) => (
              <CatBar key={cat} label={d.label} avg={d.avg} evolution={category_evolution[cat]} />
            ))}
            {(weakCats.length > 0 || recommendations.length > 0 || conceptos_a_reforzar.length > 0) && (
              <div className="pt-3 border-t border-zinc-800 space-y-3">
                {weakCats.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Categorías débiles</p>
                    {weakCats.map(([, d]) => <p key={d.label} className="text-xs text-brand-text">✗ {d.label} ({d.avg}/10)</p>)}
                  </div>
                )}
                {conceptos_a_reforzar.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-amber-400 mb-1">Conceptos a reforzar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {conceptos_a_reforzar.map((c, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg border border-amber-500/20 text-amber-300">{c}</span>)}
                    </div>
                  </div>
                )}
                {recommendations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-amber-400 mb-1">Ejercicios sugeridos</p>
                    {recommendations.map((r, i) => <p key={i} className="text-xs text-brand-text">• {r}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Formularios — historial completo ── */}
      {submissions.length > 0 && (
        <div>
          <SectionHeader label="Formularios" count={completedSubs.length} />
          <div className="space-y-3">
            {[...submissions].reverse().map(sub => <SubmissionCard key={sub.id} sub={sub} />)}
          </div>
        </div>
      )}

      {/* ── Conversaciones — todas ── */}
      <div>
        <SectionHeader label="Conversaciones analizadas" count={conversations.length} />
        {conversations.length === 0 ? (
          <p className="text-sm text-brand-muted/50 italic">Sin conversaciones cargadas todavía.</p>
        ) : (
          <div className="space-y-3">
            {/* Capacidades globales */}
            {Object.keys(conv_cap_scores).length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4 space-y-2.5 mb-4">
                <p className="text-[10px] uppercase text-brand-gold/50 mb-1">Capacidades promedio en todas las conversaciones</p>
                {Object.entries(conv_cap_scores).sort((a, b) => b[1].avg - a[1].avg).map(([k, v]) => {
                  const pct   = Math.round((v.avg / 3) * 100);
                  const color = v.avg >= 2.5 ? 'bg-emerald-500' : v.avg >= 1.5 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-[11px] text-brand-muted truncate">{v.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-brand-muted w-10 text-right">{v.avg >= 2.5 ? 'Alta' : v.avg >= 1.5 ? 'Media' : 'Baja'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Cards individuales */}
            {conversations.map((conv, i) => <ConversationCard key={conv.id} conv={conv} index={i} />)}
          </div>
        )}
      </div>

      {/* ── Trainer — todas las sesiones ── */}
      <div>
        <SectionHeader label="Sesiones de entrenamiento" count={trainer_sessions.length} />
        {trainer_sessions.length === 0 ? (
          <p className="text-sm text-brand-muted/50 italic">Sin sesiones de entrenamiento todavía.</p>
        ) : (
          <div className="space-y-3">
            {[...trainer_sessions].reverse().map((s, i) => <TrainerCard key={s.id} session={s} index={i} />)}
          </div>
        )}
      </div>

      {/* ── Leads — todos agrupados por estado ── */}
      <div>
        <SectionHeader label="Leads asignados" count={leads_summary.total} />
        {leads.length === 0 ? (
          <p className="text-sm text-brand-muted/50 italic">Sin leads asignados.</p>
        ) : (
          <div className="space-y-4">
            {/* Tasas de conversión */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Tasa contacto',   v: `${leads_summary.contact_rate}%`,  sub: `${leads_summary.contacted}/${leads_summary.total}` },
                { l: 'Tasa respuesta',  v: `${leads_summary.response_rate}%`, sub: `${leads_summary.responded}/${leads_summary.contacted}` },
                { l: 'Tasa reunión',    v: `${leads_summary.meeting_rate}%`,  sub: `${leads_summary.meetings}/${leads_summary.interested}` },
              ].map(s => (
                <div key={s.l} className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-3 text-center">
                  <p className="text-xl font-black text-brand-text">{s.v}</p>
                  <p className="text-[10px] text-brand-muted">{s.l}</p>
                  <p className="text-[10px] text-brand-muted/50">{s.sub}</p>
                </div>
              ))}
            </div>
            {/* Distribución por estado */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-[#0d0d0d]">
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-brand-muted">Estado</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-brand-muted">Leads</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-brand-muted">%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statusGroups)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([status, group]) => {
                      const pct = leads.length ? Math.round((group.length / leads.length) * 100) : 0;
                      const isHot = ['REUNION_AGENDADA','REUNION_PROPUESTA','DIAGNOSTICO_PROFUNDO','DIAGNOSTICO_INICIADO'].includes(status);
                      const isCold = ['NO_CONTACTADO','APERTURA_ENVIADA'].includes(status);
                      return (
                        <tr key={status} className="border-b border-zinc-800/40 hover:bg-zinc-900/20">
                          <td className="px-3 py-2 text-brand-text">{STATUS_LABEL[status] ?? status}</td>
                          <td className={`px-3 py-2 text-right font-bold ${isHot ? 'text-emerald-400' : isCold ? 'text-brand-muted' : 'text-brand-text'}`}>
                            {group.length}
                          </td>
                          <td className="px-3 py-2 text-right text-brand-muted/60">{pct}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
