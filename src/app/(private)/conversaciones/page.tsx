'use client';

import { useEffect, useState } from 'react';
import {
  FileText, Upload, ChevronRight, CheckCircle, XCircle, Clock,
  Zap, Flame, Star, AlertTriangle, TrendingUp, Target, MessageSquare,
  Loader2, ArrowLeft, ChevronDown, ChevronUp, Award,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
type CapLevel = 'alta' | 'media' | 'baja' | 'no_mostrada';

type Analysis = {
  resultado_probable: string;
  fortalezas: string[];
  errores: string[];
  momento_gano_confianza: string;
  momento_perdio_confianza: string;
  donde_se_rompio: string;
  capacidades_impactadas: Record<string, CapLevel>;
  que_haria_operador_cac: string;
};

type Evaluation = {
  copia_detectada: boolean; copia_parcial: boolean; intento_engano: boolean;
  profundidad: string; coherencia: boolean; comprension_conceptual: boolean;
  capacidad_analisis: string;
  xp_base: number; xp_comprension: number; xp_identificacion: number;
  xp_aprendizaje: number; xp_penalty: number; xp_total: number;
  aprobada: boolean; feedback: string; razon_rechazo: string | null;
};

type ListItem = {
  id: string; status: string; created_at: string;
  analysis: Analysis | null;
  reflection: { status: string; xp_earned: number } | null;
};

type FullItem = ListItem & {
  raw_text: string;
  reflection: ({ answers: Record<string, string>; evaluation: Evaluation; xp_earned: number; status: string }) | null;
};

// ── Constants ──────────────────────────────────────────────────────
const REFLECTION_QUESTIONS: { key: string; label: string; placeholder: string }[] = [
  { key: 'que_ocurrio', label: '¿Qué ocurrió?', placeholder: 'Describí la conversación con tus palabras. ¿Cómo empezó, cómo siguió, cómo terminó?' },
  { key: 'donde_se_rompio', label: '¿Dónde se rompió?', placeholder: 'Identificá el momento exacto o la cadena de errores que cambió el rumbo de la conversación.' },
  { key: 'que_hiciste_bien', label: '¿Qué hiciste bien?', placeholder: 'Sé honesto. ¿Qué estuvo bien aunque el resultado no fue el esperado?' },
  { key: 'que_hiciste_mal', label: '¿Qué hiciste mal?', placeholder: 'Sin excusas. ¿Qué harías diferente si pudieras volver atrás?' },
  { key: 'que_aprendiste', label: '¿Qué aprendiste?', placeholder: 'No lo que dice el análisis. Lo que vos entendiste después de leerlo.' },
  { key: 'que_aplicaras', label: '¿Qué aplicarás la próxima vez?', placeholder: 'Algo concreto. Un cambio específico en tu forma de manejar conversaciones.' },
];

const CAP_LABELS: Record<string, string> = {
  intencion: 'Intención', rapport: 'Rapport', empatia_profesional: 'Empatía profesional',
  diagnostico: 'Diagnóstico', generacion_interes: 'Generación de interés',
  seguimiento: 'Seguimiento', profesionalismo: 'Profesionalismo', criterio: 'Criterio',
};

// ── Helpers ────────────────────────────────────────────────────────
function capColor(level: CapLevel) {
  if (level === 'alta')        return 'bg-emerald-900/30 text-emerald-400 border-emerald-500/20';
  if (level === 'media')       return 'bg-amber-900/30 text-amber-400 border-amber-500/20';
  if (level === 'baja')        return 'bg-red-900/30 text-red-400 border-red-500/20';
  return 'bg-zinc-800/50 text-zinc-500 border-zinc-700/30';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Analysis Display ───────────────────────────────────────────────
function AnalysisCard({ a }: { a: Analysis }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div className="space-y-5">
      {/* Resultado */}
      <div className="flex items-center gap-3 rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.05)] px-4 py-3">
        <Target className="h-4 w-4 shrink-0 text-brand-gold" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60 mb-0.5">Resultado detectado</p>
          <p className="text-sm font-semibold text-brand-text">{a.resultado_probable}</p>
        </div>
      </div>

      {/* Fortalezas y errores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Fortalezas
          </p>
          <ul className="space-y-1.5">
            {(a.fortalezas ?? []).map((f, i) => (
              <li key={i} className="text-xs text-brand-text leading-relaxed flex gap-2">
                <span className="text-emerald-500 shrink-0 mt-0.5">•</span>{f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Errores
          </p>
          <ul className="space-y-1.5">
            {(a.errores ?? []).map((e, i) => (
              <li key={i} className="text-xs text-brand-text leading-relaxed flex gap-2">
                <span className="text-red-500 shrink-0 mt-0.5">•</span>{e}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Momentos clave */}
      <div className="space-y-2">
        {[
          { label: 'Ganó confianza', value: a.momento_gano_confianza, color: 'emerald' },
          { label: 'Perdió confianza', value: a.momento_perdio_confianza, color: 'amber' },
          { label: 'Dónde se rompió', value: a.donde_se_rompio, color: 'red' },
        ].map(m => (
          <div key={m.label} className={`rounded-lg border px-4 py-3
            ${m.color === 'emerald' ? 'border-emerald-500/15 bg-emerald-900/10'
              : m.color === 'amber'  ? 'border-amber-500/15 bg-amber-900/10'
              : 'border-red-500/15 bg-red-900/10'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1
              ${m.color === 'emerald' ? 'text-emerald-400' : m.color === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
              {m.label}
            </p>
            <p className="text-xs text-brand-text leading-relaxed">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Capacidades */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-2">Capacidades</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(a.capacidades_impactadas ?? {}).map(([k, v]) => (
            <span key={k} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${capColor(v as CapLevel)}`}>
              {CAP_LABELS[k] ?? k}: {v.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Qué haría un operador CAC */}
      <div className="rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.04)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold mb-2 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5" /> Qué habría hecho un operador CAC
        </p>
        <p className="text-sm text-brand-text leading-relaxed">{a.que_haria_operador_cac}</p>
      </div>
    </div>
  );
}

// ── Reflection Form ────────────────────────────────────────────────
function ReflectionForm({ analysisId, onDone }: { analysisId: string; onDone: (r: { evaluation: Evaluation; xp_earned: number; status: string }) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError(''); setLoading(true);
    try {
      const r = await fetch(`/api/conversations/${analysisId}/reflect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      onDone(d);
    } catch (e: any) {
      setError(e?.message ?? 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  const allFilled = REFLECTION_QUESTIONS.every(q => (answers[q.key] ?? '').trim().length >= 20);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-900/10 px-4 py-3">
        <p className="text-xs text-amber-300 leading-relaxed">
          <strong className="text-amber-400">Reflexión obligatoria.</strong> No recibís puntos por subir la conversación ni por leer el análisis. Los puntos se ganan demostrando comprensión real. Respondé con tus propias palabras.
        </p>
      </div>

      {REFLECTION_QUESTIONS.map(q => (
        <div key={q.key}>
          <label className="block text-sm font-semibold text-brand-text mb-2">{q.label}</label>
          <textarea
            value={answers[q.key] ?? ''}
            onChange={e => setAnswers(v => ({ ...v, [q.key]: e.target.value }))}
            placeholder={q.placeholder}
            rows={3}
            className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-3 text-sm text-brand-text placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30 resize-none"
          />
          <p className="text-[10px] text-brand-muted mt-1">{(answers[q.key] ?? '').trim().length} caracteres (mínimo 20)</p>
        </div>
      ))}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={!allFilled || loading}
        className="w-full rounded-xl bg-brand-gold py-3 font-bold text-black text-sm hover:bg-brand-gold/90 disabled:opacity-40 transition flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluando reflexión...</> : 'Enviar reflexión'}
      </button>
    </div>
  );
}

// ── Evaluation Result ──────────────────────────────────────────────
function EvaluationResult({ ev, xp }: { ev: Evaluation; xp: number }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl border p-4 flex items-center gap-4
        ${ev.aprobada ? 'border-emerald-500/30 bg-emerald-900/20' : 'border-red-500/30 bg-red-900/20'}`}>
        {ev.aprobada
          ? <CheckCircle className="h-8 w-8 text-emerald-400 shrink-0" />
          : <XCircle className="h-8 w-8 text-red-400 shrink-0" />}
        <div>
          <p className={`font-bold text-lg ${ev.aprobada ? 'text-emerald-400' : 'text-red-400'}`}>
            {ev.aprobada ? 'Reflexión aprobada' : 'Reflexión rechazada'}
          </p>
          {ev.aprobada
            ? <p className="text-sm text-brand-text">+{xp} XP acreditados</p>
            : <p className="text-sm text-red-300">{ev.razon_rechazo}</p>}
        </div>
        {ev.aprobada && xp > 0 && (
          <div className="ml-auto flex items-center gap-1.5 rounded-xl border border-brand-gold/30 bg-[rgba(212,175,55,0.1)] px-4 py-2">
            <Zap className="h-4 w-4 text-brand-gold" />
            <span className="text-xl font-black text-brand-gold">+{xp}</span>
            <span className="text-xs text-brand-gold/60">XP</span>
          </div>
        )}
      </div>

      {/* XP breakdown */}
      {ev.aprobada && (
        <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-3">Desglose de puntos</p>
          <div className="space-y-2">
            {[
              { label: 'Reflexión aprobada (base)', val: ev.xp_base },
              { label: 'Comprensión profunda', val: ev.xp_comprension },
              { label: 'Identificación correcta del error', val: ev.xp_identificacion },
              { label: 'Aprendizaje demostrado', val: ev.xp_aprendizaje },
              ...(ev.xp_penalty > 0 ? [{ label: 'Penalización (copia)', val: -ev.xp_penalty }] : []),
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-brand-muted">{r.label}</span>
                <span className={`font-bold ${r.val > 0 ? 'text-brand-gold' : 'text-red-400'}`}>
                  {r.val > 0 ? '+' : ''}{r.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      {ev.aprobada && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: `Profundidad: ${ev.profundidad}`, color: ev.profundidad === 'profunda' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/20' : ev.profundidad === 'adecuada' ? 'text-amber-400 border-amber-500/20 bg-amber-900/20' : 'text-zinc-400 border-zinc-700 bg-zinc-800/50' },
            { label: `Análisis: ${ev.capacidad_analisis}`, color: ev.capacidad_analisis === 'alta' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/20' : ev.capacidad_analisis === 'media' ? 'text-amber-400 border-amber-500/20 bg-amber-900/20' : 'text-zinc-400 border-zinc-700 bg-zinc-800/50' },
            ...(ev.comprension_conceptual ? [{ label: 'Entiende conceptos CAC', color: 'text-sky-400 border-sky-500/20 bg-sky-900/20' }] : []),
            ...(ev.coherencia ? [{ label: 'Análisis coherente', color: 'text-violet-400 border-violet-500/20 bg-violet-900/20' }] : []),
          ].map(b => (
            <span key={b.label} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${b.color}`}>{b.label}</span>
          ))}
        </div>
      )}

      {/* Feedback */}
      <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold mb-2 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Feedback del Motor CAC
        </p>
        <p className="text-sm text-brand-text leading-relaxed">{ev.feedback}</p>
      </div>
    </div>
  );
}

// ── Detail View ────────────────────────────────────────────────────
function DetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<FullItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [reflResult, setReflResult] = useState<{ evaluation: Evaluation; xp_earned: number; status: string } | null>(null);

  useEffect(() => {
    fetch(`/api/conversations/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
    </div>
  );
  if (!data) return <p className="text-center text-brand-muted py-20">No encontrado.</p>;

  const reflection = reflResult
    ? { ...reflResult, answers: {} as Record<string, string> }
    : data.reflection;

  const evaluation = reflResult?.evaluation ?? (data.reflection as any)?.evaluation ?? null;
  const xpEarned = reflResult?.xp_earned ?? data.reflection?.xp_earned ?? 0;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-brand-muted hover:text-brand-text transition">
        <ArrowLeft className="h-4 w-4" /> Volver al historial
      </button>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Motor CAC · Análisis</p>
          <p className="text-xs text-brand-muted mt-0.5">{fmtDate(data.created_at)}</p>
        </div>
        {reflection && (
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border
            ${reflection.status === 'approved' ? 'border-emerald-500/30 bg-emerald-900/20 text-emerald-400'
              : reflection.status === 'rejected' ? 'border-red-500/30 bg-red-900/20 text-red-400'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400'}`}>
            {reflection.status === 'approved' ? `+${xpEarned} XP` : reflection.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
          </span>
        )}
      </div>

      {/* Raw text toggle */}
      <button onClick={() => setShowRaw(v => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-3 text-xs text-brand-muted hover:text-brand-text">
        <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />Ver conversación original</span>
        {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {showRaw && (
        <pre className="rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-4 text-xs text-brand-muted whitespace-pre-wrap max-h-60 overflow-y-auto">
          {data.raw_text}
        </pre>
      )}

      {/* Analysis */}
      {data.analysis && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-3">Diagnóstico</p>
          <AnalysisCard a={data.analysis} />
        </div>
      )}

      {/* Reflection */}
      <div className="border-t border-[rgba(212,175,55,0.1)] pt-6">
        {evaluation ? (
          <EvaluationResult ev={evaluation} xp={xpEarned} />
        ) : (
          <>
            <p className="text-sm font-bold text-brand-text mb-1">Tu reflexión</p>
            <p className="text-xs text-brand-muted mb-4">Leé el análisis antes de responder. No recibís puntos por leerlo — los puntos son por lo que comprendés.</p>
            <ReflectionForm
              analysisId={id}
              onDone={(r) => setReflResult(r)}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── New Conversation ───────────────────────────────────────────────
function NewConversation({ onDone }: { onDone: (id: string) => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      onDone(d.id);
    } catch (e: any) {
      setError(e?.message ?? 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-brand-text mb-1">Pegá la conversación completa</p>
        <p className="text-xs text-brand-muted mb-3">
          Puede ser de WhatsApp, Instagram, email o cualquier canal. Copiá y pegá exactamente como ocurrió. El Motor CAC la analiza en segundos.
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Ejemplo:\n\nVos: Hola! Vi que tenés una PyME y quería consultarte algo...\nProspecto: Sí, quién sos?\nVos: Me llamo Diego, trabajo con...`}
          rows={14}
          className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-3 text-sm text-brand-text placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30 resize-none font-mono"
        />
        <p className="text-[10px] text-brand-muted mt-1">{text.length} / 30.000 caracteres</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.05)] px-4 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-brand-gold shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-text">Analizando conversación...</p>
            <p className="text-xs text-brand-muted">El Motor CAC está evaluando las 8 dimensiones. Puede tomar hasta 20 segundos.</p>
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={text.trim().length < 50 || loading}
        className="w-full rounded-xl bg-brand-gold py-3 font-bold text-black text-sm hover:bg-brand-gold/90 disabled:opacity-40 transition flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {loading ? 'Analizando...' : 'Enviar al Motor CAC'}
      </button>

      <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-2">Cómo funciona</p>
        <div className="space-y-1.5 text-xs text-brand-muted">
          <p className="flex gap-2"><span className="text-brand-gold">1.</span> Pegás la conversación → <span className="text-brand-text">0 XP</span></p>
          <p className="flex gap-2"><span className="text-brand-gold">2.</span> Leés el análisis → <span className="text-brand-text">0 XP</span></p>
          <p className="flex gap-2"><span className="text-brand-gold">3.</span> Respondés la reflexión con comprensión real → <span className="text-brand-gold font-bold">hasta 45 XP</span></p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function ConversacionesPage() {
  const [list, setList] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [detailId, setDetailId] = useState<string | null>(null);

  function loadList() {
    setLoadingList(true);
    fetch('/api/conversations')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setList(d); setLoadingList(false); });
  }

  useEffect(() => { loadList(); }, []);

  function openDetail(id: string) { setDetailId(id); setView('detail'); }
  function backToList() { setView('list'); setDetailId(null); loadList(); }
  function onNewDone(id: string) { loadList(); openDetail(id); }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-2xl mx-auto">
      {/* Header */}
      {view === 'list' && (
        <>
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Sistema 1</p>
            <h1 className="text-2xl font-bold text-brand-text mt-1">Análisis de conversaciones</h1>
            <p className="text-sm text-brand-muted mt-0.5">Convertí conversaciones reales en aprendizaje. Los puntos son por comprensión, no por actividad.</p>
          </div>

          {/* Stats banner */}
          {list.length > 0 && (() => {
            const total = list.length;
            const approved = list.filter(l => l.reflection?.status === 'approved').length;
            const totalXp = list.reduce((a, l) => a + (l.reflection?.xp_earned ?? 0), 0);
            return (
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: 'Analizadas', value: total, icon: <FileText className="h-3.5 w-3.5" /> },
                  { label: 'Aprobadas', value: approved, icon: <CheckCircle className="h-3.5 w-3.5" /> },
                  { label: 'XP ganado', value: totalXp, icon: <Zap className="h-3.5 w-3.5" /> },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-3 text-center">
                    <div className="flex justify-center mb-1 text-brand-gold/40">{s.icon}</div>
                    <p className="text-lg font-bold text-brand-gold">{s.value}</p>
                    <p className="text-[10px] text-brand-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          <button
            onClick={() => setView('new')}
            className="w-full mb-5 flex items-center justify-center gap-2 rounded-xl border border-brand-gold/30 bg-[rgba(212,175,55,0.05)] py-3.5 text-sm font-bold text-brand-gold hover:bg-[rgba(212,175,55,0.1)] transition"
          >
            <Upload className="h-4 w-4" /> Nueva conversación
          </button>

          {/* List */}
          {loadingList ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-gold" />
            </div>
          ) : !list.length ? (
            <div className="flex flex-col items-center py-20 text-center">
              <FileText className="h-10 w-10 text-brand-gold/20 mb-3" />
              <p className="text-brand-text font-semibold">Todavía no analizaste conversaciones</p>
              <p className="text-sm text-brand-muted mt-1 max-w-xs">Subí tu primera conversación real y aprendé de lo que realmente pasó.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(item => {
                const refl = item.reflection;
                return (
                  <button key={item.id} onClick={() => openDetail(item.id)}
                    className="w-full flex items-center gap-3 rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] px-4 py-4 text-left hover:bg-[#111] transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-text truncate">
                        {item.analysis?.resultado_probable ?? 'Analizando...'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-brand-muted" />
                        <span className="text-[11px] text-brand-muted">{fmtDate(item.created_at)}</span>
                      </div>
                    </div>
                    {!refl ? (
                      <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-900/20 text-amber-400">
                        Reflexión pendiente
                      </span>
                    ) : refl.status === 'approved' ? (
                      <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-900/20 text-emerald-400 flex items-center gap-1">
                        <Zap className="h-3 w-3" />+{refl.xp_earned} XP
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border border-red-500/20 bg-red-900/20 text-red-400">
                        Rechazada
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-brand-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === 'new' && (
        <>
          <button onClick={backToList} className="flex items-center gap-2 text-sm text-brand-muted hover:text-brand-text transition mb-5">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Motor CAC</p>
            <h2 className="text-xl font-bold text-brand-text mt-1">Nueva conversación</h2>
          </div>
          <NewConversation onDone={onNewDone} />
        </>
      )}

      {view === 'detail' && detailId && (
        <DetailView id={detailId} onBack={backToList} />
      )}
    </div>
  );
}
