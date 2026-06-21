'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, GripVertical, Loader2, Save,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Star, Zap, Brain, Users2, FileText,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'cerebro_predictivo', label: 'Cerebro predictivo' },
  { value: 'cingulo', label: 'Cíngulo e incongruencia' },
  { value: 'amigdala', label: 'Amígdala y defensa' },
  { value: 'lobulo_frontal', label: 'Lóbulo frontal' },
  { value: 'rapport_falso', label: 'Rapport falso' },
  { value: 'rapport_genuino', label: 'Rapport genuino' },
  { value: 'conexion_genuina', label: 'Conexión genuina' },
  { value: 'criterio_comercial', label: 'Criterio comercial' },
  { value: 'aplicacion_practica', label: 'Aplicación práctica' },
];

type Question = { id: string; question_text: string; category: string | null; is_required: boolean; is_bonus: boolean; order_index: number };
type Form = { id: string; title: string; description: string | null; topic: string | null; is_active: boolean; reinforcement_questions: Question[] };
type SetterRow = { user_id: string; name: string; email: string; submission: any | null };

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/15'
    : score >= 50 ? 'text-amber-400 border-amber-500/20 bg-amber-900/15'
    : 'text-red-400 border-red-500/20 bg-red-900/15';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{score}/100</span>;
}

function AIRiskBadge({ risk }: { risk: string }) {
  const c = risk === 'bajo' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10'
    : risk === 'medio' ? 'text-amber-400 border-amber-500/20 bg-amber-900/10'
    : 'text-red-400 border-red-500/20 bg-red-900/10';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c}`}>IA {risk}</span>;
}

function SubmissionDetail({ s, questions }: { s: any; questions: Question[] }) {
  const a = s.analysis ?? {};
  const answers = s.reinforcement_answers ?? [];
  const ansMap = new Map(answers.map((r: any) => [r.question_id, r]));

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#111] p-3 text-center">
          <p className="text-xl font-bold text-brand-gold">{a.total_score ?? '—'}</p>
          <p className="text-[10px] text-brand-muted">Puntaje</p>
        </div>
        <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#111] p-3 text-center">
          <p className="text-sm font-bold text-brand-text capitalize">{a.nivel_general ?? '—'}</p>
          <p className="text-[10px] text-brand-muted">Nivel</p>
        </div>
        <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#111] p-3 text-center">
          <p className={`text-sm font-bold capitalize ${a.ai_risk === 'alto' ? 'text-red-400' : a.ai_risk === 'medio' ? 'text-amber-400' : 'text-emerald-400'}`}>{a.ai_risk ?? '—'}</p>
          <p className="text-[10px] text-brand-muted">Riesgo IA</p>
        </div>
      </div>

      {/* Alertas */}
      {(a.alertas?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3">
          <p className="text-[10px] font-bold uppercase text-red-400 mb-1.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Alertas</p>
          {a.alertas.map((al: string, i: number) => <p key={i} className="text-xs text-red-300">• {al}</p>)}
        </div>
      )}

      {/* Feedback general */}
      {a.feedback_general && (
        <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-3">
          <p className="text-[10px] font-bold uppercase text-brand-gold mb-1 flex items-center gap-1"><Brain className="h-3 w-3" />Diagnóstico Motor CAC</p>
          <p className="text-xs text-brand-text leading-relaxed">{a.feedback_general}</p>
        </div>
      )}

      {/* Fortalezas / Debilidades */}
      <div className="grid grid-cols-2 gap-2">
        {a.fortalezas?.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-3">
            <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Fortalezas</p>
            {a.fortalezas.map((f: string, i: number) => <p key={i} className="text-[11px] text-brand-text">• {f}</p>)}
          </div>
        )}
        {a.debilidades?.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3">
            <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Debilidades</p>
            {a.debilidades.map((d: string, i: number) => <p key={i} className="text-[11px] text-brand-text">• {d}</p>)}
          </div>
        )}
      </div>

      {/* Ejercicios recomendados */}
      {a.ejercicios_recomendados?.length > 0 && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-900/10 p-3">
          <p className="text-[10px] font-bold uppercase text-violet-400 mb-1">Ejercicios recomendados</p>
          {a.ejercicios_recomendados.map((e: string, i: number) => <p key={i} className="text-[11px] text-brand-text">• {e}</p>)}
        </div>
      )}

      {/* Per-question breakdown */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Respuestas por pregunta</p>
        {questions.map((q, i) => {
          const ans: any = ansMap.get(q.id);
          const qs = a.question_scores?.[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-brand-gold/60 shrink-0 mt-0.5">P{i + 1}{q.is_bonus ? ' 🎯' : ''}</span>
                <p className="text-xs text-brand-muted leading-relaxed flex-1">{q.question_text}</p>
                {qs && <span className="shrink-0 text-sm font-bold text-brand-gold">{qs.score}/10</span>}
              </div>
              {ans?.answer_text && (
                <div className="rounded-lg border border-zinc-700/50 bg-[#111] px-3 py-2">
                  <p className="text-xs text-brand-text whitespace-pre-wrap leading-relaxed">{ans.answer_text}</p>
                </div>
              )}
              {qs?.feedback && (
                <div className={`rounded-lg px-3 py-1.5 ${qs.parece_ia ? 'border border-red-500/20 bg-red-900/10' : 'border border-brand-gold/10 bg-[rgba(212,175,55,0.03)]'}`}>
                  {qs.parece_ia && <p className="text-[10px] text-red-400 font-bold mb-0.5">⚠ Posible respuesta IA</p>}
                  <p className="text-xs text-brand-text">{qs.feedback}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState<'config' | 'questions' | 'submissions'>('questions');
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<SetterRow[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Question editor state
  const [newQ, setNewQ] = useState({ text: '', category: '', required: true, bonus: false });
  const [addingQ, setAddingQ] = useState(false);
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const [editQText, setEditQText] = useState('');
  const [editQCat, setEditQCat] = useState('');

  const loadForm = useCallback(() => {
    fetch(`/api/admin/forms/${id}`).then(r => r.json()).then(setForm);
  }, [id]);

  useEffect(() => { loadForm(); }, [loadForm]);

  useEffect(() => {
    if (tab === 'submissions') {
      setLoadingSubs(true);
      fetch(`/api/admin/forms/${id}/submissions`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setSubmissions(d);
        setLoadingSubs(false);
      });
    }
  }, [tab, id]);

  async function saveConfig() {
    if (!form) return;
    setSaving(true);
    await fetch(`/api/admin/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, description: form.description, topic: form.topic }),
    });
    setSaving(false);
  }

  async function toggleActive() {
    if (!form) return;
    const r = await fetch(`/api/admin/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !form.is_active }),
    });
    const d = await r.json();
    setForm(f => f ? { ...f, is_active: d.is_active } : f);
  }

  async function addQuestion() {
    if (!newQ.text.trim()) return;
    setSaving(true);
    const r = await fetch(`/api/admin/forms/${id}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_text: newQ.text, category: newQ.category || null, is_required: newQ.required, is_bonus: newQ.bonus }),
    });
    const q = await r.json();
    setForm(f => f ? { ...f, reinforcement_questions: [...f.reinforcement_questions, q] } : f);
    setNewQ({ text: '', category: '', required: true, bonus: false });
    setAddingQ(false);
    setSaving(false);
  }

  async function deleteQ(qid: string) {
    await fetch(`/api/admin/forms/questions/${qid}`, { method: 'DELETE' });
    setForm(f => f ? { ...f, reinforcement_questions: f.reinforcement_questions.filter(q => q.id !== qid) } : f);
  }

  async function saveEditQ(qid: string) {
    const r = await fetch(`/api/admin/forms/questions/${qid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_text: editQText, category: editQCat || null }),
    });
    const updated = await r.json();
    setForm(f => f ? { ...f, reinforcement_questions: f.reinforcement_questions.map(q => q.id === qid ? { ...q, ...updated } : q) } : f);
    setEditingQ(null);
  }

  if (!form) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>;

  const submittedCount = submissions.filter(s => s.submission).length;
  const pendingCount   = submissions.filter(s => !s.submission).length;
  const avgScore       = submittedCount > 0
    ? Math.round(submissions.filter(s => s.submission?.total_score != null).reduce((a, s) => a + (s.submission?.total_score ?? 0), 0) / submittedCount)
    : null;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <button onClick={() => router.push('/admin/forms')} className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-text mb-3">
          <ArrowLeft className="h-4 w-4" /> Formularios
        </button>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">{form.topic ?? 'Formulario'}</p>
            <h1 className="text-xl font-bold text-brand-text mt-0.5">{form.title}</h1>
          </div>
          <button onClick={toggleActive}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition
              ${form.is_active ? 'border-emerald-500/30 bg-emerald-900/20 text-emerald-400' : 'border-zinc-700 bg-zinc-800/50 text-zinc-400'}`}>
            {form.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {form.is_active ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {([
          { k: 'config', l: 'Configuración' },
          { k: 'questions', l: `Preguntas (${form.reinforcement_questions.length})` },
          { k: 'submissions', l: `Respuestas${submittedCount ? ` (${submittedCount})` : ''}` },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px
              ${tab === t.k ? 'border-brand-gold text-brand-gold' : 'border-transparent text-brand-muted hover:text-brand-text'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* CONFIG TAB */}
      {tab === 'config' && (
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Título *</label>
            <input value={form.title} onChange={e => setForm(f => f ? { ...f, title: e.target.value } : f)}
              className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Descripción</label>
            <textarea value={form.description ?? ''} onChange={e => setForm(f => f ? { ...f, description: e.target.value } : f)} rows={3}
              className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30 resize-none" />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Tema / Clase</label>
            <input value={form.topic ?? ''} onChange={e => setForm(f => f ? { ...f, topic: e.target.value } : f)}
              className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
          </div>
          <button onClick={saveConfig} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      )}

      {/* QUESTIONS TAB */}
      {tab === 'questions' && (
        <div className="space-y-3">
          {form.reinforcement_questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4">
              {editingQ === q.id ? (
                <div className="space-y-3">
                  <textarea value={editQText} onChange={e => setEditQText(e.target.value)} rows={3} autoFocus
                    className="w-full rounded-xl border border-brand-gold/30 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none resize-none" />
                  <select value={editQCat} onChange={e => setEditQCat(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111] px-3 py-2 text-sm text-brand-text focus:outline-none">
                    <option value="">Sin categoría</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => saveEditQ(q.id)} className="rounded-xl bg-brand-gold px-4 py-1.5 text-xs font-bold text-black">Guardar</button>
                    <button onClick={() => setEditingQ(null)} className="rounded-xl border border-zinc-700 px-4 py-1.5 text-xs text-brand-muted">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-brand-gold/60">P{i + 1}</span>
                      {q.is_bonus && <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand-gold/30 text-brand-gold">BONUS</span>}
                      {!q.is_required && <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500">OPCIONAL</span>}
                      {q.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-500/20 text-sky-400 bg-sky-900/10">
                          {CATEGORIES.find(c => c.value === q.category)?.label ?? q.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-brand-text leading-relaxed">{q.question_text}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditingQ(q.id); setEditQText(q.question_text); setEditQCat(q.category ?? ''); }}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-brand-muted hover:text-brand-text transition">
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteQ(q.id)}
                      className="p-1.5 rounded-lg hover:bg-red-900/20 text-brand-muted hover:text-red-400 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add question */}
          {addingQ ? (
            <div className="rounded-xl border border-brand-gold/20 bg-[rgba(212,175,55,0.03)] p-4 space-y-3">
              <textarea value={newQ.text} onChange={e => setNewQ(v => ({ ...v, text: e.target.value }))} rows={3} autoFocus
                placeholder="Escribí la pregunta..."
                className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <select value={newQ.category} onChange={e => setNewQ(v => ({ ...v, category: e.target.value }))}
                  className="rounded-xl border border-zinc-800 bg-[#111] px-3 py-2 text-sm text-brand-text focus:outline-none">
                  <option value="">Sin categoría</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <div className="flex gap-3 items-center">
                  <label className="flex items-center gap-1.5 text-xs text-brand-muted cursor-pointer">
                    <input type="checkbox" checked={newQ.required} onChange={e => setNewQ(v => ({ ...v, required: e.target.checked }))} className="accent-brand-gold" />
                    Obligatoria
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-brand-muted cursor-pointer">
                    <input type="checkbox" checked={newQ.bonus} onChange={e => setNewQ(v => ({ ...v, bonus: e.target.checked }))} className="accent-brand-gold" />
                    Bonus
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addQuestion} disabled={!newQ.text.trim() || saving}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Agregar
                </button>
                <button onClick={() => setAddingQ(false)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-brand-muted">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingQ(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3.5 text-sm text-brand-muted hover:border-brand-gold/30 hover:text-brand-text transition">
              <Plus className="h-4 w-4" /> Agregar pregunta
            </button>
          )}
        </div>
      )}

      {/* SUBMISSIONS TAB */}
      {tab === 'submissions' && (
        <div className="space-y-5">
          {/* Team stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Respondieron', value: submittedCount, color: 'text-emerald-400' },
              { label: 'Pendientes', value: pendingCount, color: 'text-amber-400' },
              { label: 'Puntaje promedio', value: avgScore != null ? `${avgScore}/100` : '—', color: 'text-brand-gold' },
              { label: 'Total setters', value: submissions.length, color: 'text-brand-text' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Conceptos más débiles (del equipo) */}
          {(() => {
            const catScores: Record<string, number[]> = {};
            for (const row of submissions) {
              if (!row.submission?.analysis?.question_scores) continue;
              for (const [qid, qs] of Object.entries(row.submission.analysis.question_scores as Record<string, any>)) {
                const q = form.reinforcement_questions.find(q => q.id === qid);
                const cat = q?.category ?? 'otro';
                if (!catScores[cat]) catScores[cat] = [];
                catScores[cat].push(qs.score ?? 0);
              }
            }
            const catAvgs = Object.entries(catScores).map(([k, scores]) => ({
              cat: k, avg: scores.reduce((a, b) => a + b, 0) / scores.length,
              label: CATEGORIES.find(c => c.value === k)?.label ?? k,
            })).sort((a, b) => a.avg - b.avg);
            if (!catAvgs.length) return null;
            return (
              <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-3">Promedio por concepto — equipo completo</p>
                <div className="space-y-2">
                  {catAvgs.map(c => (
                    <div key={c.cat} className="flex items-center gap-3">
                      <p className="text-[11px] text-brand-muted w-36 shrink-0 truncate">{c.label}</p>
                      <div className="flex-1 h-2 rounded-full bg-zinc-800">
                        <div className={`h-2 rounded-full ${c.avg >= 7 ? 'bg-emerald-500' : c.avg >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${(c.avg / 10) * 100}%` }} />
                      </div>
                      <p className="text-[11px] font-bold text-brand-muted w-8 text-right">{c.avg.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Individual setters */}
          {loadingSubs ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>
          ) : (
            <div className="space-y-2">
              {submissions.map(row => {
                const sub = row.submission;
                const isOpen = expanded === row.user_id;
                return (
                  <div key={row.user_id} className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] overflow-hidden">
                    <button onClick={() => setExpanded(isOpen ? null : row.user_id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#111] transition text-left">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-xs font-bold text-brand-gold">
                        {row.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-brand-text truncate">{row.name}</p>
                        <p className="text-[11px] text-brand-muted">{row.email}</p>
                      </div>
                      {sub ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <ScoreBadge score={sub.total_score ?? 0} />
                          <AIRiskBadge risk={sub.ai_risk ?? 'bajo'} />
                          <span className="text-[10px] text-brand-muted capitalize">{sub.nivel_general}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-900/15 shrink-0">Pendiente</span>
                      )}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-brand-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-brand-muted shrink-0" />}
                    </button>
                    {isOpen && sub && (
                      <div className="border-t border-zinc-800 px-4 py-4">
                        <SubmissionDetail s={sub} questions={form.reinforcement_questions} />
                      </div>
                    )}
                    {isOpen && !sub && (
                      <div className="border-t border-zinc-800 px-4 py-4 text-center">
                        <p className="text-sm text-brand-muted">Este setter todavía no respondió el formulario.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
