'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertTriangle, Brain, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Sparkles, CheckCircle, Target,
  LayoutGrid, BarChart2, UserCog, Search, X, StickyNote, ChevronRight,
  RefreshCw, Check,
} from 'lucide-react';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

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
type MainTab = 'analisis' | 'kanban' | 'perfil';

export default function SetterFichaPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [tab,  setTab]  = useState<MainTab>('analisis');
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

  const TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: 'analisis', label: 'Análisis',      icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: 'kanban',   label: 'Leads Kanban',  icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: 'perfil',   label: 'Editar Perfil', icon: <UserCog className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">

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

      {/* ── Tab nav ── */}
      <div className="flex gap-1 border-b border-zinc-800 -mb-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all',
              tab === t.id ? 'text-brand-gold border-brand-gold' : 'text-zinc-500 border-transparent hover:text-zinc-300')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: KANBAN ── */}
      {tab === 'kanban' && <SetterKanbanTab setterId={id} />}

      {/* ── TAB: PERFIL ── */}
      {tab === 'perfil' && <SetterPerfilTab setterId={id} profile={profile} onSaved={(p) => setData(prev => prev ? { ...prev, profile: { ...prev.profile, ...p } } : prev)} />}

      {/* ── TAB: ANÁLISIS (contenido existente) ── */}
      {tab === 'analisis' && <>

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

      </>} {/* fin tab analisis */}

    </div>
  );
}

// ─── SetterKanbanTab ──────────────────────────────────────────────────────────

const KMACRO = [
  { id:'sin_contactar', label:'Sin Contactar', statuses:['NO_CONTACTADO','APERTURA_ENVIADA'],                                                                            dropStatus:'NO_CONTACTADO',        col:'border-zinc-700/60',   header:'text-zinc-300',   bar:'bg-zinc-500',   over:'ring-2 ring-zinc-400 bg-zinc-800/30',   badge:'bg-zinc-700 text-zinc-300' },
  { id:'contactado',    label:'Contactado',    statuses:['CONTACTADO','NO_RESPONDE'],                                                                                     dropStatus:'CONTACTADO',           col:'border-blue-800/50',   header:'text-blue-400',   bar:'bg-blue-500',   over:'ring-2 ring-blue-500 bg-blue-950/30',   badge:'bg-blue-900/60 text-blue-300' },
  { id:'respondio',     label:'Respondió',     statuses:['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO'],                       dropStatus:'RESPONDIO',            col:'border-blue-600/40',   header:'text-blue-300',   bar:'bg-blue-400',   over:'ring-2 ring-blue-400 bg-blue-900/20',   badge:'bg-blue-800/60 text-blue-200' },
  { id:'diagnostico',   label:'Diagnóstico',   statuses:['DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA'],                                              dropStatus:'DIAGNOSTICO_INICIADO', col:'border-yellow-700/50', header:'text-yellow-400', bar:'bg-yellow-400', over:'ring-2 ring-yellow-400 bg-yellow-950/20',badge:'bg-yellow-900/50 text-yellow-300' },
  { id:'reunion',       label:'Reunión ✓',     statuses:['REUNION_AGENDADA'],                                                                                             dropStatus:'REUNION_AGENDADA',     col:'border-emerald-700/50',header:'text-emerald-400',bar:'bg-emerald-400',over:'ring-2 ring-emerald-400 bg-emerald-950/20',badge:'bg-emerald-900/50 text-emerald-300' },
  { id:'no_avanza',     label:'No Avanza',     statuses:['SEGUIMIENTO_FUTURO','NO_CALIFICA'],                                                                             dropStatus:'NO_CALIFICA',          col:'border-zinc-800/60',   header:'text-zinc-600',   bar:'bg-zinc-700',   over:'ring-2 ring-red-600 bg-red-950/20',     badge:'bg-zinc-800 text-zinc-500' },
] as const;

type KMacroId = (typeof KMACRO)[number]['id'];

const KALL_STATUSES = [
  'NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','NO_RESPONDE',
  'RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO',
  'DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA',
  'REUNION_AGENDADA','SEGUIMIENTO_FUTURO','NO_CALIFICA',
] as const;

type SLead = {
  id: string; first_name: string; last_name: string | null; phone: string;
  current_status: string; notes: string | null; assigned_to_user_id: string;
};

function getKMacro(s: string) {
  return KMACRO.find(m => (m.statuses as readonly string[]).includes(s));
}

function SetterKanbanTab({ setterId }: { setterId: string }) {
  const [leads,       setLeads]       = useState<SLead[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [activeMacro, setActiveMacro] = useState<KMacroId>('sin_contactar');
  const [noteModal,   setNoteModal]   = useState<SLead | null>(null);
  const [noteDraft,   setNoteDraft]   = useState('');
  const [moveTarget,  setMoveTarget]  = useState<SLead | null>(null);
  const [dragging,    setDragging]    = useState<SLead | null>(null);
  const [dragOver,    setDragOver]    = useState<KMacroId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/setter-leads/${setterId}`).then(r => r.json()).catch(() => ({}));
    setLeads(r.leads ?? []);
    setLoading(false);
  }, [setterId]);

  useEffect(() => { load(); }, [load]);

  async function patchLead(leadId: string, updates: Record<string, unknown>) {
    setSaving(leadId);
    const res = await fetch(`/api/admin/setter-leads/${setterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, ...updates }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updated } : l));
    }
    setSaving(null);
    setMoveTarget(null);
    setDragging(null);
    setDragOver(null);
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l => `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) || l.phone.includes(q));
  }, [leads, search]);

  const byMacroTotal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of KMACRO) map[m.id] = 0;
    for (const l of visible) { const m = getKMacro(l.current_status); if (m) map[m.id]++; }
    return map;
  }, [visible]);

  const byMacro = useMemo(() => {
    const map: Record<string, SLead[]> = {};
    for (const m of KMACRO) map[m.id] = [];
    for (const l of visible) { const m = getKMacro(l.current_status); if (m) map[m.id].push(l); }
    return map;
  }, [visible]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{leads.length} leads personales del setter</p>
        <button onClick={load} className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..."
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-10 pr-9 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-zinc-500" /></button>}
      </div>

      {/* Mobile: tab selector */}
      <div className="lg:hidden flex overflow-x-auto gap-1 pb-1 scrollbar-none">
        {KMACRO.map(col => (
          <button key={col.id} onClick={() => setActiveMacro(col.id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all',
              activeMacro === col.id ? cn('border text-white bg-zinc-800', col.col) : 'text-zinc-500 hover:text-zinc-300')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', col.bar)} />
            {col.label} <span className={cn('text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center', col.badge)}>{byMacroTotal[col.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="lg:hidden space-y-2 max-h-[60vh] overflow-y-auto">
        {(byMacro[activeMacro] ?? []).map(lead => (
          <KLeadCard key={lead.id} lead={lead} macro={KMACRO.find(m => m.id === activeMacro)!}
            saving={saving === lead.id}
            onMove={() => setMoveTarget(lead)}
            onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
            onDragStart={() => setDragging(lead)} onDragEnd={() => { setDragging(null); setDragOver(null); }} />
        ))}
      </div>

      {/* Desktop kanban */}
      <div className="hidden lg:grid grid-cols-6 gap-2.5" style={{ height: '65vh' }}>
        {KMACRO.map(col => {
          const colLeads = byMacro[col.id] ?? [];
          const isOver = dragOver === col.id;
          return (
            <div key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
              onDrop={e => { e.preventDefault(); if (dragging) patchLead(dragging.id, { current_status: col.dropStatus }); setDragOver(null); }}
              className={cn('flex flex-col rounded-2xl border bg-zinc-900/40 transition-all min-h-0', col.col, isOver && col.over)}>
              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className={cn('text-[11px] font-bold uppercase tracking-wider', col.header)}>{col.label}</p>
                  <span className={cn('text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center', col.badge)}>{byMacroTotal[col.id] ?? 0}</span>
                </div>
                <div className={cn('h-0.5 rounded-full opacity-50', col.bar)} />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-4 space-y-2">
                {colLeads.length === 0
                  ? <div className="h-16 rounded-xl border-2 border-dashed border-zinc-800 flex items-center justify-center"><p className="text-[10px] text-zinc-700">Soltar aquí</p></div>
                  : colLeads.map(lead => (
                    <KLeadCard key={lead.id} lead={lead} macro={col}
                      saving={saving === lead.id}
                      onMove={() => setMoveTarget(lead)}
                      onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
                      onDragStart={() => setDragging(lead)} onDragEnd={() => { setDragging(null); setDragOver(null); }} />
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nota */}
      {noteModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setNoteModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl p-5 pb-8">
            <p className="text-base font-bold text-white mb-1">{noteModal.first_name} {noteModal.last_name}</p>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={5}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setNoteModal(null)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400">Cancelar</button>
              <button onClick={async () => { await patchLead(noteModal.id, { notes: noteDraft }); setNoteModal(null); }} disabled={saving === noteModal.id}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-black disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet mover */}
      {moveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setMoveTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl">
            <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-zinc-700" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-white">{moveTarget.first_name} {moveTarget.last_name}</p>
              <p className="text-xs text-zinc-500">Estado actual: {STATUS_LABELS[moveTarget.current_status as LeadStatus] ?? moveTarget.current_status}</p>
            </div>
            <div className="overflow-y-auto max-h-[52vh] px-3 pb-8 space-y-1">
              {KALL_STATUSES.map(key => {
                const isCurrent = moveTarget.current_status === key;
                const macro = getKMacro(key);
                return (
                  <button key={key} onClick={() => patchLead(moveTarget.id, { current_status: key })} disabled={isCurrent}
                    className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium transition text-left',
                      isCurrent ? 'border-brand-gold/40 bg-brand-gold/10 text-brand-gold cursor-default' : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200')}>
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', macro?.bar ?? 'bg-zinc-600')} />
                    <span className="flex-1">{STATUS_LABELS[key as LeadStatus] ?? key}</span>
                    {isCurrent && <span className="text-[10px] text-brand-gold/60">actual</span>}
                    {!isCurrent && <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KLeadCard({ lead, macro, saving, onMove, onNote, onDragStart, onDragEnd }: {
  lead: SLead; macro: (typeof KMACRO)[number]; saving: boolean;
  onMove: () => void; onNote: () => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2 cursor-grab select-none hover:border-zinc-700 transition-all">
      <span className={cn('text-[9px] font-semibold rounded-full px-1.5 py-0.5', macro.badge)}>
        {STATUS_LABELS[lead.current_status as LeadStatus] ?? lead.current_status}
      </span>
      <p className="text-[13px] font-bold text-white">{lead.first_name} {lead.last_name ?? ''}</p>
      <a href={`https://wa.me/${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()} className="text-[11px] text-blue-400 font-mono block hover:text-blue-300">{lead.phone}</a>
      {lead.notes && <p className="text-[10px] text-zinc-500 line-clamp-2 bg-zinc-900/60 rounded-lg px-2 py-1">{lead.notes}</p>}
      <div className="flex items-center justify-end gap-1">
        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onNote(); }}
          className={cn('p-1 rounded-lg border transition', lead.notes ? 'border-yellow-700/40 text-yellow-600' : 'border-zinc-700 text-zinc-500 hover:text-zinc-200')}>
          <StickyNote className="h-3 w-3" />
        </button>
        <button disabled={saving} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMove(); }}
          className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 disabled:opacity-40">
          {saving ? '...' : <>Mover <ChevronRight className="h-3 w-3" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── SetterPerfilTab ──────────────────────────────────────────────────────────

function SetterPerfilTab({ setterId, profile, onSaved }: {
  setterId: string;
  profile: Profile;
  onSaved: (p: Partial<Profile>) => void;
}) {
  const [name,         setName]         = useState(profile.full_name ?? '');
  const [points,       setPoints]       = useState(String(profile.points ?? 0));
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetMsg,     setResetMsg]     = useState('');

  async function save() {
    setSaving(true); setError('');
    const res = await fetch(`/api/admin/setter-leads/${setterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name.trim(), points: parseInt(points) || 0 }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) { onSaved({ full_name: name.trim(), points: parseInt(points) || 0 }); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError(json.error ?? 'Error al guardar');
  }

  return (
    <div className="space-y-5 max-w-sm">
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Editar perfil del setter</p>

      <div>
        <label className="text-xs text-zinc-500 font-medium">Nombre completo</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
      </div>

      <div>
        <label className="text-xs text-zinc-500 font-medium">Puntos XP (total)</label>
        <input type="number" value={points} onChange={e => setPoints(e.target.value)} min={0}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
        <p className="text-[10px] text-zinc-600 mt-1">Modificar directamente el total de puntos del setter</p>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}

      <button onClick={save} disabled={saving || !name.trim()}
        className={cn('w-full rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2',
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-gold text-black hover:bg-yellow-400 disabled:opacity-50')}>
        {saved ? <><Check className="h-4 w-4" />Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Reset contraseña */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-400">Resetear contraseña</p>
        <p className="text-[11px] text-zinc-600">Le llegará un email a <span className="text-zinc-400">{profile.email}</span> con un enlace para crear nueva contraseña.</p>
        {resetMsg && <p className="text-[11px] text-emerald-400">{resetMsg}</p>}
        <button onClick={async () => {
          setResetSending(true); setResetMsg('');
          const r = await fetch('/api/admin/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: profile.email }) });
          setResetSending(false);
          if (r.ok) setResetMsg('✓ Email de reset enviado correctamente.');
          else { const j = await r.json(); setResetMsg(`Error: ${j.error ?? 'no se pudo enviar'}`); }
        }} disabled={resetSending}
          className="w-full rounded-xl border border-zinc-700 py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-40 transition">
          {resetSending ? 'Enviando...' : 'Enviar email de reset de contraseña'}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs space-y-2">
        <p className="text-zinc-400 font-semibold">Info del setter</p>
        <p className="text-zinc-600">Email: <span className="text-zinc-400">{profile.email}</span></p>
        <p className="text-zinc-600">Rol: <span className="text-zinc-400">{profile.role}</span></p>
        <p className="text-zinc-600">ID: <span className="font-mono text-zinc-500 break-all">{setterId}</span></p>
        <p className="text-zinc-600">Desde: <span className="text-zinc-400">{new Date(profile.created_at).toLocaleDateString('es-AR')}</span></p>
      </div>
    </div>
  );
}
