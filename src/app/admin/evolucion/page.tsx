'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Brain, Upload, ChevronDown, ChevronUp, CheckCircle,
  AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles,
  Target, Zap, RotateCcw, Send, Trash2, Calendar,
} from 'lucide-react';
import { CAPACIDADES, type CapacidadKey } from '@/lib/motor-cac-ceo';

// ── Types ─────────────────────────────────────────────────────────────────────
type CapSummary = { score: number; trend: 'up'|'down'|'flat'; nivel: string };
type Pattern    = { patron: string; tipo: string; capacidad: string; descripcion?: string };
type Exercise   = { id: string; capacity: string; title: string; description: string; status: string; assigned_at: string; due_at?: string; submission_text?: string; validation?: any };
type Profile    = {
  has_data: boolean;
  capacities: Record<CapacidadKey, CapSummary>;
  strongest_cap: { cap: string; score: number } | null;
  weakest_cap:   { cap: string; score: number } | null;
  distance_2030: number | null;
  negative_patterns: Pattern[]; positive_patterns: Pattern[];
  exercises: { active: Exercise[]; completed: Exercise[] };
  weekly_report: { report: any; week_start: string } | null;
  stats: { total_evidences: number; total_exercises: number; approved_exercises: number };
};
type Evidence = {
  id: string; title: string; type: string; context?: string;
  analysis_status: string; created_at: string;
  founder_analyses?: { id: string; capacities: any; analysis: any }[];
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CAP_KEYS = Object.keys(CAPACIDADES) as CapacidadKey[];

const TIPO_LABELS: Record<string, string> = {
  clase:'Clase', mentoria_grupal:'Mentoría grupal', mentoria_individual:'Mentoría individual',
  reunion_estrategica:'Reunión estratégica', reunion_equipo:'Reunión de equipo',
  reunion_lucas:'Reunión con Lucas', audio:'Audio', video:'Video',
  transcripcion:'Transcripción', documento:'Documento', conversacion:'Conversación',
  planificacion:'Planificación', discurso:'Discurso', presentacion:'Presentación',
  mensaje_equipo:'Mensaje al equipo',
};

const STATUS_EX: Record<string, { label: string; color: string }> = {
  pending:          { label: 'Pendiente',         color: 'text-zinc-400 border-zinc-600' },
  in_progress:      { label: 'En progreso',        color: 'text-sky-400 border-sky-600' },
  delivered:        { label: 'Entregado',          color: 'text-amber-400 border-amber-600' },
  needs_correction: { label: 'Req. corrección',    color: 'text-orange-400 border-orange-600' },
  approved:         { label: 'Aprobado',           color: 'text-emerald-400 border-emerald-600' },
  repeat:           { label: 'Repetir',            color: 'text-red-400 border-red-600' },
  validated:        { label: 'Validado',           color: 'text-violet-400 border-violet-600' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 7 ? 'text-emerald-400' : s >= 5 ? 'text-amber-400' : 'text-red-400';
}
function scoreBarColor(s: number) {
  return s >= 7 ? 'bg-emerald-500' : s >= 5 ? 'bg-amber-500' : 'bg-red-500';
}
function TrendIcon({ t }: { t: 'up'|'down'|'flat' }) {
  if (t === 'up')   return <TrendingUp   className="h-3 w-3 text-emerald-400"/>;
  if (t === 'down') return <TrendingDown className="h-3 w-3 text-red-400"/>;
  return <Minus className="h-3 w-3 text-zinc-500"/>;
}

// ── Radar SVG ─────────────────────────────────────────────────────────────────
function RadarChart({ scores }: { scores: Partial<Record<CapacidadKey, number>> }) {
  const N = CAP_KEYS.length;
  const cx = 110; const cy = 110; const R = 88;
  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt    = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });
  const dataPoints = CAP_KEYS.map((k, i) => pt(i, ((scores[k] ?? 0) / 10) * R));
  const path = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  return (
    <svg width={220} height={220} className="mx-auto">
      {[2,4,6,8,10].map(lvl => {
        const gpts = CAP_KEYS.map((_,i) => pt(i,(lvl/10)*R));
        return <path key={lvl} d={gpts.map((p,i)=>`${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')+'Z'} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>;
      })}
      {CAP_KEYS.map((_,i) => { const p=pt(i,R); return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>; })}
      <path d={path} fill="rgba(212,175,55,0.12)" stroke="rgba(212,175,55,0.65)" strokeWidth="1.5"/>
      {dataPoints.map((p,i) => { const s=scores[CAP_KEYS[i]]??0; const c=s>=7?'#10b981':s>=5?'#f59e0b':'#ef4444'; return <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill={c} stroke="#0a0a0a" strokeWidth="1.5"/>; })}
      {CAP_KEYS.map((k,i) => { const p=pt(i,R+20); const words=CAPACIDADES[k].split(' '); return (
        <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.45)" fontSize="7" fontWeight="600">
          {words.map((w,wi)=><tspan key={wi} x={p.x.toFixed(1)} dy={wi===0&&words.length>1?'-5':wi===0?'0':'9'}>{w}</tspan>)}
        </text>
      ); })}
    </svg>
  );
}

// ── CapBar ────────────────────────────────────────────────────────────────────
function CapBar({ capKey, data }: { capKey: CapacidadKey; data: CapSummary }) {
  const pct = Math.max(0, Math.min(100, (data.score / 10) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5"><span className="text-[11px] text-brand-muted">{CAPACIDADES[capKey]}</span><TrendIcon t={data.trend}/></div>
        <span className={`text-xs font-black ${scoreColor(data.score)}`}>{data.score}/10</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${scoreBarColor(data.score)} transition-all`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  );
}

// ── EvidenceCard ──────────────────────────────────────────────────────────────
function EvidenceCard({ ev, onDelete }: { ev: Evidence; onDelete: (id: string) => void }) {
  const [open, setOpen]       = useState(false);
  const [deleting, setDel]    = useState(false);
  const analysis = ev.founder_analyses?.[0];

  async function del() {
    setDel(true);
    await fetch(`/api/founder/evidences/${ev.id}`, { method: 'DELETE' });
    onDelete(ev.id);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#080808] overflow-hidden">
      <button onClick={() => setOpen(o=>!o)} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#0d0d0d] transition">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] text-brand-gold/60 font-bold uppercase">{TIPO_LABELS[ev.type] ?? ev.type}</span>
            {ev.analysis_status === 'analyzing' && <Loader2 className="h-3 w-3 animate-spin text-brand-gold"/>}
            {ev.analysis_status === 'ready'     && <CheckCircle className="h-3 w-3 text-emerald-400"/>}
            {ev.analysis_status === 'error'     && <AlertTriangle className="h-3 w-3 text-red-400"/>}
          </div>
          <p className="text-sm font-semibold text-brand-text truncate">{ev.title}</p>
          <p className="text-[10px] text-brand-muted/50">{new Date(ev.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}</p>
        </div>
        {analysis && (
          <div className="flex gap-1 flex-wrap shrink-0 max-w-36">
            {CAP_KEYS.map(k => { const s = analysis.capacities?.[k]?.score; if (s == null) return null;
              const c = s>=7?'bg-emerald-900/30 text-emerald-300':s>=5?'bg-amber-900/30 text-amber-300':'bg-red-900/30 text-red-300';
              return <span key={k} className={`text-[9px] font-black px-1.5 py-0.5 rounded ${c}`}>{s}</span>;
            }).filter(Boolean).slice(0,4)}
          </div>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-brand-muted shrink-0"/> : <ChevronDown className="h-4 w-4 text-brand-muted shrink-0"/>}
      </button>

      {open && analysis && (
        <div className="border-t border-zinc-800 p-4 space-y-3">
          <div className="space-y-2.5">
            {CAP_KEYS.map(k => {
              const cap = analysis.capacities?.[k];
              if (!cap || cap.nivel === 'sin_datos' || cap.score == null) return null;
              return (
                <div key={k} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-brand-muted">{CAPACIDADES[k]}</span>
                    <span className={`text-xs font-black ${scoreColor(cap.score)}`}>{cap.score}/10</span>
                  </div>
                  {cap.observacion && <p className="text-[10px] text-brand-muted/70 leading-snug">{cap.observacion}</p>}
                  {cap.comportamientos_negativos?.slice(0,2).map((b: string, i: number) =>
                    <p key={i} className="text-[10px] text-red-300/70">✗ {b}</p>
                  )}
                  {cap.comportamientos_positivos?.slice(0,1).map((b: string, i: number) =>
                    <p key={i} className="text-[10px] text-emerald-300/70">✓ {b}</p>
                  )}
                </div>
              );
            })}
          </div>
          {analysis.analysis?.feedback_general && (
            <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-3">
              <p className="text-[9px] font-bold uppercase text-brand-gold mb-1">Feedback Motor CAC CEO</p>
              <p className="text-xs text-brand-text leading-relaxed">{analysis.analysis.feedback_general}</p>
            </div>
          )}
          {analysis.analysis?.prediccion && (
            <div className="rounded-xl border border-violet-500/15 bg-violet-900/5 p-3">
              <p className="text-[9px] font-bold uppercase text-violet-400 mb-1">Predicción</p>
              <p className="text-xs text-brand-text leading-relaxed">{analysis.analysis.prediccion}</p>
            </div>
          )}
          {(analysis.analysis?.momento_mas_potente || analysis.analysis?.momento_mas_critico) && (
            <div className="grid grid-cols-2 gap-2">
              {analysis.analysis?.momento_mas_potente && (
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-900/5 p-2.5">
                  <p className="text-[9px] font-bold uppercase text-emerald-400 mb-0.5">Momento potente</p>
                  <p className="text-[10px] text-brand-text leading-snug">{analysis.analysis.momento_mas_potente}</p>
                </div>
              )}
              {analysis.analysis?.momento_mas_critico && (
                <div className="rounded-xl border border-red-500/10 bg-red-900/5 p-2.5">
                  <p className="text-[9px] font-bold uppercase text-red-400 mb-0.5">Momento crítico</p>
                  <p className="text-[10px] text-brand-text leading-snug">{analysis.analysis.momento_mas_critico}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={del} disabled={deleting} className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition">
              <Trash2 className="h-3 w-3"/>{deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ExerciseCard ──────────────────────────────────────────────────────────────
function ExerciseCard({ ex, onUpdate }: { ex: Exercise; onUpdate: (u: Exercise) => void }) {
  const [open, setOpen]      = useState(false);
  const [text, setText]      = useState('');
  const [sub,  setSub]       = useState(false);
  const [err,  setErr]       = useState<string|null>(null);
  const st = STATUS_EX[ex.status] ?? { label: ex.status, color: 'text-zinc-400 border-zinc-600' };
  const capLabel = CAPACIDADES[ex.capacity as CapacidadKey] ?? ex.capacity;
  const isDone   = ['approved','validated'].includes(ex.status);

  async function submit() {
    if (!text.trim()) return;
    setSub(true); setErr(null);
    try {
      const res  = await fetch(`/api/founder/exercises/${ex.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_text: text }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? 'Error'); return; }
      onUpdate(json.exercise ?? json);
      setText('');
    } catch { setErr('Error de conexión'); }
    finally { setSub(false); }
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${isDone ? 'border-emerald-500/10 bg-emerald-900/3' : 'border-zinc-800 bg-[#080808]'}`}>
      <button onClick={() => setOpen(o=>!o)} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#0d0d0d] transition">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
            <span className="text-[10px] text-brand-gold/50 font-semibold">{capLabel}</span>
          </div>
          <p className="text-sm font-semibold text-brand-text">{ex.title}</p>
          {ex.due_at && !isDone && (
            <p className="text-[10px] text-brand-muted/50 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3"/>Vence: {new Date(ex.due_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}
            </p>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-brand-muted shrink-0"/> : <ChevronDown className="h-4 w-4 text-brand-muted shrink-0"/>}
      </button>

      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-3">
          <div className="rounded-xl border border-zinc-700/50 bg-[#0d0d0d] p-3">
            <p className="text-[9px] font-bold uppercase text-brand-muted mb-1">Qué hacer</p>
            <p className="text-xs text-brand-text leading-relaxed whitespace-pre-wrap">{ex.description}</p>
          </div>
          {ex.validation && (
            <div className={`rounded-xl border p-3 space-y-1 ${isDone ? 'border-emerald-500/20 bg-emerald-900/5' : 'border-orange-500/20 bg-orange-900/5'}`}>
              <p className={`text-[9px] font-bold uppercase ${isDone ? 'text-emerald-400' : 'text-orange-400'}`}>
                {isDone ? 'Aprobado por Motor CAC CEO' : 'Requiere corrección'}
              </p>
              <p className="text-xs text-brand-text">{ex.validation.feedback}</p>
              {ex.validation.evidencia_de_cambio && <p className="text-[10px] text-brand-muted/60 italic">{ex.validation.evidencia_de_cambio}</p>}
            </div>
          )}
          {!isDone && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold uppercase text-brand-muted">Tu evidencia</p>
              <textarea value={text} onChange={e=>setText(e.target.value)}
                placeholder="Describí qué hiciste, qué aprendiste, qué resultado obtuviste. El Motor CAC CEO lo valida…"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30 resize-none h-24"/>
              {err && <p className="text-xs text-red-400">{err}</p>}
              <button onClick={submit} disabled={sub || !text.trim()}
                className="flex items-center gap-1.5 rounded-xl border border-brand-gold/30 bg-[rgba(212,175,55,0.08)] px-4 py-2 text-xs font-bold text-brand-gold disabled:opacity-40 hover:bg-[rgba(212,175,55,0.12)] transition">
                {sub ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Send className="h-3.5 w-3.5"/>}
                {sub ? 'Validando con Motor CAC CEO…' : 'Entregar y validar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── NewEvidenceForm ───────────────────────────────────────────────────────────
function NewEvidenceForm({ onSuccess }: { onSuccess: () => void }) {
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState({ title:'', type:'transcripcion', content_text:'', context:'', duration_min:'', date_recorded:'' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string|null>(null);
  const [result,  setResult]  = useState<any>(null);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(f=>({...f,[k]:e.target.value}));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content_text.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res  = await fetch('/api/founder/evidences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duration_min: form.duration_min ? parseInt(form.duration_min) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error'); return; }
      setResult(json.analysis);
      setForm({ title:'', type:'transcripcion', content_text:'', context:'', duration_min:'', date_recorded:'' });
      onSuccess();
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.02)] overflow-hidden">
      <button onClick={() => setOpen(o=>!o)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(212,175,55,0.03)] transition">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-brand-gold"/>
          <p className="text-sm font-bold text-brand-text">Cargar evidencia</p>
          <span className="text-[10px] text-brand-muted/50">Pegá texto, transcripción, documento o conversación</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-brand-muted"/> : <ChevronDown className="h-4 w-4 text-brand-muted"/>}
      </button>

      {open && (
        <div className="border-t border-brand-gold/10 p-4">
          {result ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/5 p-3">
                <p className="text-xs font-bold text-emerald-400 mb-1">✓ Análisis completado por Motor CAC CEO</p>
                {result.feedback_general && <p className="text-xs text-brand-text leading-relaxed">{result.feedback_general}</p>}
              </div>
              {result.intervencion_prioritaria && (
                <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.05)] p-3">
                  <p className="text-[9px] font-bold uppercase text-brand-gold mb-1">Ejercicio generado automáticamente</p>
                  <p className="text-sm font-semibold text-brand-text">{result.intervencion_prioritaria.titulo}</p>
                  <p className="text-xs text-brand-muted mt-0.5">{result.intervencion_prioritaria.descripcion}</p>
                </div>
              )}
              <button onClick={() => { setResult(null); setOpen(false); }} className="text-xs text-brand-gold hover:text-brand-gold/80">
                Cargar otra evidencia
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1">Título *</label>
                  <input value={form.title} onChange={set('title')} required placeholder="Ej: Mentoría grupo 3 — Semana 8"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1">Tipo *</label>
                  <select value={form.type} onChange={set('type')}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold/30">
                    {Object.entries(TIPO_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1">Fecha</label>
                  <input type="date" value={form.date_recorded} onChange={set('date_recorded')}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-gold/30"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1">Duración (min)</label>
                  <input type="number" value={form.duration_min} onChange={set('duration_min')} placeholder="Ej: 45"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30"/>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1">Contexto adicional</label>
                <input value={form.context} onChange={set('context')} placeholder="Ej: Reunión semanal con Lucas — estrategia de equipo"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30"/>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1">Contenido — Transcripción / Texto *</label>
                <textarea value={form.content_text} onChange={set('content_text')} required
                  placeholder="Pegá aquí la transcripción, el documento, la conversación o el texto a analizar…"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30 resize-none h-40"/>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button type="submit" disabled={loading || !form.title.trim() || !form.content_text.trim()}
                className="flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-[rgba(212,175,55,0.08)] px-5 py-2.5 text-sm font-bold text-brand-gold hover:bg-[rgba(212,175,55,0.12)] transition disabled:opacity-40">
                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Brain className="h-4 w-4"/>}
                {loading ? 'Motor CAC CEO analizando con o3…' : 'Analizar evidencia'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function EvolucionPage() {
  const [profile,    setProfile]    = useState<Profile|null>(null);
  const [evidences,  setEvidences]  = useState<Evidence[]>([]);
  const [loadingP,   setLoadingP]   = useState(true);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [genWeekly,  setGenWeekly]  = useState(false);

  const loadProfile = useCallback(() => {
    setLoadingP(true);
    fetch('/api/founder/profile').then(r=>r.json()).then(d=>{ if (!d.error) setProfile(d); }).finally(()=>setLoadingP(false));
  }, []);
  const loadEvidences = useCallback(() => {
    fetch('/api/founder/evidences?limit=20').then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setEvidences(d); });
  }, []);

  useEffect(() => { loadProfile(); loadEvidences(); }, [loadProfile, loadEvidences]);

  const handleDelete  = (id: string) => setEvidences(prev => prev.filter(e => e.id !== id));
  const handleExUpdate = (updated: Exercise) => setProfile(prev => {
    if (!prev) return prev;
    const up = (list: Exercise[]) => list.map(e => e.id === updated.id ? updated : e);
    return { ...prev, exercises: { active: up(prev.exercises.active), completed: up(prev.exercises.completed) } };
  });

  async function generateWeekly() {
    setGenWeekly(true);
    await fetch('/api/cron/founder-weekly');
    loadProfile();
    setGenWeekly(false);
    setWeeklyOpen(true);
  }

  if (loadingP) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold"/></div>;

  const p        = profile;
  const hasData  = p?.has_data ?? false;
  const wr       = p?.weekly_report;
  const activeEx = p?.exercises.active ?? [];
  const doneEx   = p?.exercises.completed ?? [];

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Sistema de Evolución del Fundador</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Diego 2030</h1>
        <p className="text-sm text-brand-muted mt-0.5">
          Motor CAC CEO · {p?.stats.total_evidences ?? 0} evidencias · {p?.stats.total_exercises ?? 0} ejercicios · {p?.stats.approved_exercises ?? 0} aprobados
        </p>
      </div>

      {/* Perfil evolutivo */}
      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-brand-text">Radar Diego 2030</p>
              {p?.distance_2030 != null && (
                <div className="text-right">
                  <p className={`text-2xl font-black ${scoreColor(p.distance_2030)}`}>{p.distance_2030}/10</p>
                  <p className="text-[10px] text-brand-muted/50">distancia al 2030</p>
                </div>
              )}
            </div>
            <RadarChart scores={Object.fromEntries(Object.entries(p?.capacities ?? {}).map(([k,v]) => [k, v.score]))}/>
          </div>
          <div className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-4 space-y-2.5">
            <p className="text-xs font-bold text-brand-text mb-3">Estado por capacidad</p>
            {Object.entries(p?.capacities ?? {}).map(([k, data]) => (
              <CapBar key={k} capKey={k as CapacidadKey} data={data}/>
            ))}
            {p?.strongest_cap && p?.weakest_cap && (
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800">
                <div><p className="text-[9px] font-bold uppercase text-emerald-400 mb-0.5">Más fuerte</p><p className="text-[11px] font-semibold text-brand-text">{CAPACIDADES[p.strongest_cap.cap as CapacidadKey] ?? p.strongest_cap.cap}</p></div>
                <div><p className="text-[9px] font-bold uppercase text-red-400 mb-0.5">Prioridad a entrenar</p><p className="text-[11px] font-semibold text-brand-text">{CAPACIDADES[p.weakest_cap.cap as CapacidadKey] ?? p.weakest_cap.cap}</p></div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-10 text-center">
          <Brain className="h-10 w-10 text-brand-gold/20 mx-auto mb-4"/>
          <p className="text-sm text-brand-muted font-semibold">Motor CAC CEO listo para analizar</p>
          <p className="text-xs text-brand-muted/50 mt-1 max-w-xs mx-auto">Cargá la primera evidencia — transcripción de una clase, mentoría, reunión o conversación — y el sistema comienza a medir tu evolución.</p>
        </div>
      )}

      {/* Patrones */}
      {hasData && ((p?.negative_patterns.length ?? 0) + (p?.positive_patterns.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(p?.negative_patterns.length ?? 0) > 0 && (
            <div className="rounded-xl border border-red-500/15 bg-red-900/5 p-4">
              <p className="text-[9px] font-bold uppercase text-red-400 mb-2.5 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3"/>Patrones a corregir</p>
              {p!.negative_patterns.slice(0,4).map((pt, i) => (
                <div key={i} className="mb-2">
                  <p className="text-[11px] font-semibold text-brand-text">{pt.patron}</p>
                  <p className="text-[10px] text-brand-muted/60">{CAPACIDADES[pt.capacidad as CapacidadKey] ?? pt.capacidad}</p>
                </div>
              ))}
            </div>
          )}
          {(p?.positive_patterns.length ?? 0) > 0 && (
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-900/5 p-4">
              <p className="text-[9px] font-bold uppercase text-emerald-400 mb-2.5 flex items-center gap-1.5"><CheckCircle className="h-3 w-3"/>Patrones positivos</p>
              {p!.positive_patterns.slice(0,4).map((pt, i) => (
                <div key={i} className="mb-2">
                  <p className="text-[11px] font-semibold text-brand-text">{pt.patron}</p>
                  <p className="text-[10px] text-brand-muted/60">{CAPACIDADES[pt.capacidad as CapacidadKey] ?? pt.capacidad}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nueva evidencia */}
      <NewEvidenceForm onSuccess={() => { loadProfile(); loadEvidences(); }}/>

      {/* Ejercicios activos */}
      {activeEx.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-brand-gold"/><h2 className="text-sm font-bold text-brand-text">Ejercicios activos ({activeEx.length})</h2></div>
          {activeEx.map(ex => <ExerciseCard key={ex.id} ex={ex} onUpdate={handleExUpdate}/>)}
        </section>
      )}

      {/* Evidencias */}
      {evidences.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-brand-gold"/><h2 className="text-sm font-bold text-brand-text">Evidencias analizadas ({evidences.length})</h2></div>
          {evidences.map(ev => <EvidenceCard key={ev.id} ev={ev} onDelete={handleDelete}/>)}
        </section>
      )}

      {/* Ejercicios aprobados */}
      {doneEx.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400"/><h2 className="text-sm font-bold text-brand-text">Completados ({doneEx.length})</h2></div>
          {doneEx.map(ex => <ExerciseCard key={ex.id} ex={ex} onUpdate={handleExUpdate}/>)}
        </section>
      )}

      {/* Reporte semanal */}
      <section>
        <div className="rounded-xl border border-[rgba(212,175,55,0.15)] bg-[rgba(212,175,55,0.02)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-gold"/>
              <p className="text-sm font-bold text-brand-text">Reporte semanal</p>
              {wr && <span className="text-[10px] text-brand-muted/50">Semana del {new Date(wr.week_start+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long'})}</span>}
            </div>
            <div className="flex items-center gap-2">
              {wr && <button onClick={() => setWeeklyOpen(o=>!o)} className="text-[11px] text-zinc-400 border border-zinc-700 rounded-lg px-2.5 py-1">{weeklyOpen?'Cerrar':'Ver reporte'}</button>}
              <button onClick={generateWeekly} disabled={genWeekly}
                className="flex items-center gap-1.5 rounded-xl border border-brand-gold/20 px-2.5 py-1 text-[10px] text-brand-muted/60 hover:text-brand-gold transition disabled:opacity-40">
                {genWeekly ? <Loader2 className="h-3 w-3 animate-spin"/> : <RotateCcw className="h-3 w-3"/>}
                {genWeekly ? 'Generando…' : wr ? 'Actualizar' : 'Generar'}
              </button>
            </div>
          </div>
          {wr?.report && weeklyOpen && (
            <div className="border-t border-brand-gold/10 px-4 py-5 space-y-4">
              <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.05)] p-4">
                <p className="text-[9px] font-bold uppercase text-brand-gold mb-1">Evaluación de la semana</p>
                <p className="text-sm text-brand-text leading-relaxed">{wr.report.evaluacion_semana}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase text-emerald-400 mb-2">3 mayores avances</p>
                  {wr.report.avances?.map((a: string, i: number) => <p key={i} className="text-xs text-brand-text mb-1.5 flex gap-1.5"><span className="text-emerald-400 shrink-0">✓</span>{a}</p>)}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-red-400 mb-2">3 mayores limitaciones</p>
                  {wr.report.limitaciones?.map((l: string, i: number) => <p key={i} className="text-xs text-brand-text mb-1.5 flex gap-1.5"><span className="text-red-400 shrink-0">✗</span>{l}</p>)}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Entrenar','que_entrenar','text-brand-gold'],['Delegar','que_delegar','text-sky-400'],['Dejar de hacer','que_dejar_de_hacer','text-red-400'],['Cerrar','que_cerrar','text-amber-400']].map(([label,key,color]) => (
                  <div key={key} className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-3">
                    <p className={`text-[9px] font-bold uppercase ${color} mb-1`}>{label}</p>
                    <p className="text-[10px] text-brand-text leading-snug">{(wr.report as any)[key]}</p>
                  </div>
                ))}
              </div>
              {wr.report.proxima_mejor_accion && (
                <div className="rounded-xl border border-brand-gold/25 bg-[rgba(212,175,55,0.08)] p-4">
                  <p className="text-[9px] font-bold uppercase text-brand-gold mb-1">Próxima mejor acción</p>
                  <p className="text-sm font-bold text-brand-gold">{wr.report.proxima_mejor_accion}</p>
                </div>
              )}
            </div>
          )}
          {!wr && !genWeekly && (
            <div className="border-t border-zinc-800 px-4 py-5 text-center">
              <p className="text-xs text-brand-muted/50">El reporte semanal se genera cada lunes a las 9:00 AM automáticamente o podés generarlo manualmente.</p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
