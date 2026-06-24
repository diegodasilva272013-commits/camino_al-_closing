'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Send, CheckCircle, AlertTriangle,
  Brain, Star, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';

type Question = { id: string; question_text: string; category: string | null; is_required: boolean; is_bonus: boolean; order_index: number };
type FormData = {
  id: string; title: string; description: string | null; topic: string | null;
  reinforcement_questions: Question[];
  submission: { id: string; status: string; total_score: number; nivel_general: string; ai_risk: string; analysis: any } | null;
  answers: { question_id: string; answer_text: string; score: number; analysis: any }[];
};

const NIVEL_COLORS: Record<string, string> = {
  principiante: 'text-zinc-400',
  en_desarrollo: 'text-sky-400',
  intermedio: 'text-amber-400',
  avanzado: 'text-emerald-400',
};

const NIVEL_LABELS: Record<string, string> = {
  principiante: 'Principiante',
  en_desarrollo: 'En desarrollo',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ResultView({ form, onBack }: { form: FormData; onBack: () => void }) {
  const sub = form.submission!;
  const a = sub.analysis ?? {};
  const ansMap = new Map((form.answers ?? []).map(r => [r.question_id, r]));
  const [openQ, setOpenQ] = useState<string | null>(null);

  const scoreColor = sub.total_score >= 70 ? 'text-emerald-400'
    : sub.total_score >= 50 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className="space-y-5">
      {/* Hero score */}
      <div className="rounded-2xl border border-brand-gold/20 bg-[rgba(212,175,55,0.04)] p-6 text-center">
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60 mb-2">Tu resultado</p>
        <p className={`text-6xl font-black ${scoreColor}`}>{sub.total_score}</p>
        <p className="text-sm text-brand-muted mt-1">sobre 100</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className={`text-sm font-bold ${NIVEL_COLORS[sub.nivel_general] ?? 'text-brand-text'}`}>
            {NIVEL_LABELS[sub.nivel_general] ?? sub.nivel_general}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold
            ${sub.ai_risk === 'bajo' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10'
            : sub.ai_risk === 'medio' ? 'text-amber-400 border-amber-500/20 bg-amber-900/10'
            : 'text-red-400 border-red-500/20 bg-red-900/10'}`}>
            Riesgo IA: {sub.ai_risk}
          </span>
        </div>
        {sub.ai_risk === 'alto' && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-900/10 px-4 py-2">
            <p className="text-xs text-red-300">Las respuestas detectadas como generadas por IA no acumulan XP. La próxima vez respondé con tus propias palabras.</p>
          </div>
        )}
      </div>

      {/* Alertas */}
      {a.alertas?.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-4">
          <p className="text-xs font-bold uppercase text-red-400 mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Alertas del Motor CAC</p>
          {a.alertas.map((al: string, i: number) => <p key={i} className="text-sm text-red-300">• {al}</p>)}
        </div>
      )}

      {/* Feedback general */}
      {a.feedback_general && (
        <div className="rounded-xl border border-brand-gold/15 bg-[rgba(212,175,55,0.04)] p-4">
          <p className="text-xs font-bold uppercase text-brand-gold mb-2 flex items-center gap-1"><Brain className="h-3.5 w-3.5" />Diagnóstico Motor CAC</p>
          <p className="text-sm text-brand-text leading-relaxed">{a.feedback_general}</p>
        </div>
      )}

      {/* Fortalezas y debilidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {a.fortalezas?.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-3">
            <p className="text-xs font-bold uppercase text-emerald-400 mb-2">Fortalezas</p>
            {a.fortalezas.map((f: string, i: number) => <p key={i} className="text-sm text-brand-text">• {f}</p>)}
          </div>
        )}
        {a.debilidades?.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3">
            <p className="text-xs font-bold uppercase text-red-400 mb-2">A mejorar</p>
            {a.debilidades.map((d: string, i: number) => <p key={i} className="text-sm text-brand-text">• {d}</p>)}
          </div>
        )}
      </div>

      {/* Conceptos a reforzar */}
      {a.conceptos_a_reforzar?.length > 0 && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-900/10 p-4">
          <p className="text-xs font-bold uppercase text-sky-400 mb-2">Conceptos a reforzar</p>
          <div className="flex flex-wrap gap-2">
            {a.conceptos_a_reforzar.map((c: string, i: number) => (
              <span key={i} className="text-xs px-2 py-1 rounded-lg border border-sky-500/20 text-sky-300">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Ejercicios recomendados */}
      {a.ejercicios_recomendados?.length > 0 && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-900/10 p-4">
          <p className="text-xs font-bold uppercase text-violet-400 mb-2 flex items-center gap-1"><Zap className="h-3.5 w-3.5" />Ejercicios recomendados</p>
          {a.ejercicios_recomendados.map((e: string, i: number) => (
            <p key={i} className="text-sm text-brand-text">• {e}</p>
          ))}
        </div>
      )}

      {/* Per-question breakdown */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-3">Desglose por pregunta</p>
        <div className="space-y-2">
          {form.reinforcement_questions.map((q, i) => {
            const ans = ansMap.get(q.id);
            const qs = a.question_scores?.[q.id];
            const isOpen = openQ === q.id;
            return (
              <div key={q.id} className="rounded-xl border border-zinc-800 bg-[#0d0d0d] overflow-hidden">
                <button onClick={() => setOpenQ(isOpen ? null : q.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#111] transition">
                  <span className="text-[10px] text-brand-gold/50 font-bold shrink-0 w-5">P{i + 1}</span>
                  <p className="text-xs text-brand-text flex-1 leading-snug line-clamp-2">{q.question_text}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {qs && <span className={`text-sm font-bold ${qs.score >= 7 ? 'text-emerald-400' : qs.score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{qs.score}/10</span>}
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-brand-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-brand-muted" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
                    {ans?.answer_text && (
                      <div className="rounded-lg border border-zinc-700/50 bg-[#111] px-3 py-2.5">
                        <p className="text-[10px] uppercase text-brand-muted mb-1">Tu respuesta</p>
                        <p className="text-sm text-brand-text whitespace-pre-wrap leading-relaxed">{ans.answer_text}</p>
                      </div>
                    )}
                    {qs && (
                      <div className={`rounded-lg px-3 py-2.5 ${qs.parece_ia ? 'border border-red-500/20 bg-red-900/10' : 'border border-brand-gold/10 bg-[rgba(212,175,55,0.03)]'}`}>
                        {qs.parece_ia && <p className="text-xs text-red-400 font-bold mb-1">⚠ Posible uso de IA detectado</p>}
                        <p className="text-xs text-brand-text">{qs.feedback}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          <span className={`text-[10px] ${qs.usa_propias_palabras ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {qs.usa_propias_palabras ? '✓' : '✗'} Palabras propias
                          </span>
                          <span className={`text-[10px] ${qs.da_ejemplos ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {qs.da_ejemplos ? '✓' : '✗'} Da ejemplos
                          </span>
                          <span className={`text-[10px] ${qs.aplica_a_ventas ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {qs.aplica_a_ventas ? '✓' : '✗'} Aplica a ventas
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={onBack}
        className="w-full rounded-xl border border-zinc-800 py-3 text-sm text-brand-muted hover:text-brand-text transition">
        Volver a formularios
      </button>
    </div>
  );
}

export default function FormularioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadForm = useCallback(() => {
    return fetch(`/api/forms/${id}`).then(r => r.json()).then(d => {
      setForm(d);
      setLoading(false);
      return d;
    });
  }, [id]);

  useEffect(() => { loadForm(); }, [loadForm]);

  // Auto-poll mientras el análisis esté pendiente
  useEffect(() => {
    if (form?.submission?.status === 'analyzing') {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const d = await loadForm();
        if (d?.submission?.status !== 'analyzing') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      }, 3000);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [form?.submission?.status, loadForm]);

  async function submit() {
    if (!form) return;
    setError('');
    setSubmitting(true);
    const r = await fetch(`/api/forms/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setError(d.error ?? 'Error al enviar'); return; }
    // Cargar para mostrar el estado "analyzing" y arrancar polling
    loadForm();
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>;
  if (!form) return null;

  const questions = form.reinforcement_questions ?? [];

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-2xl mx-auto">
      <button onClick={() => router.push('/formularios')} className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-text mb-4">
        <ArrowLeft className="h-4 w-4" /> Formularios
      </button>

      <div className="mb-6">
        {form.topic && <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">{form.topic}</p>}
        <h1 className="text-xl font-bold text-brand-text mt-0.5">{form.title}</h1>
        {form.description && <p className="text-sm text-brand-muted mt-1 leading-relaxed">{form.description}</p>}
      </div>

      {/* Already submitted → show results */}
      {form.submission && form.submission.status !== 'analyzing' ? (
        <ResultView form={form} onBack={() => router.push('/formularios')} />
      ) : form.submission?.status === 'analyzing' ? (
        <div className="flex flex-col items-center py-20 text-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand-gold" />
          <p className="text-brand-text font-semibold">El Motor CAC está analizando tus respuestas...</p>
          <p className="text-sm text-brand-muted">Actualizando automáticamente en segundos.</p>
        </div>
      ) : (
        /* Fill form */
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-500/20 bg-amber-900/10 p-3">
            <p className="text-xs text-amber-300 leading-relaxed">
              Respondé con tus propias palabras. El Motor CAC detecta copias de IA y las penaliza. Una respuesta breve y honesta vale más que una perfecta y falsa.
            </p>
          </div>

          {questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-brand-gold/50 mt-1 shrink-0 w-5">P{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {q.is_bonus && <span className="text-[10px] font-bold text-brand-gold border border-brand-gold/30 px-1.5 py-0.5 rounded">BONUS</span>}
                    {!q.is_required && !q.is_bonus && <span className="text-[10px] text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded">OPCIONAL</span>}
                  </div>
                  <p className="text-sm font-medium text-brand-text leading-relaxed">{q.question_text}</p>
                </div>
              </div>
              <textarea
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                rows={4}
                placeholder={q.is_required ? 'Respuesta obligatoria (mínimo 15 caracteres)...' : 'Respuesta opcional...'}
                className={`w-full rounded-xl border bg-[#0d0d0d] px-4 py-3 text-sm text-brand-text placeholder:text-zinc-600 focus:outline-none focus:border-brand-gold/30 resize-none transition
                  ${q.is_required && !answers[q.id]?.trim() ? 'border-zinc-800' : 'border-zinc-800'}`}
              />
              {q.is_required && answers[q.id]?.trim() && answers[q.id].trim().length < 15 && (
                <p className="text-[11px] text-amber-400 pl-7">Mínimo 15 caracteres</p>
              )}
            </div>
          ))}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button onClick={submit} disabled={submitting || questions.filter(q => q.is_required).some(q => !answers[q.id]?.trim() || answers[q.id].trim().length < 15)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-gold py-3.5 text-sm font-bold text-black disabled:opacity-40 transition">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Analizando con Motor CAC...</> : <><Send className="h-4 w-4" />Enviar formulario</>}
          </button>

          <p className="text-center text-[11px] text-brand-muted">Una vez enviado no podés editar las respuestas.</p>
        </div>
      )}
    </div>
  );
}
