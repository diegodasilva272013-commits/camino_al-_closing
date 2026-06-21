'use client';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Brain, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConvMessage = { id: string; direction: 'outbound' | 'inbound'; body: string; sent_at: string };
type Evaluation = {
  id: string; score_total: number; score_opening: number; score_connection: number;
  score_questions: number; score_defense_handling: number; score_rapport: number;
  score_advance: number; score_commercial_criteria: number;
  summary: string; strengths: string[]; weaknesses: string[]; mistakes: string[];
  recommendations: string[]; next_exercise: string; created_at: string;
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const color = score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-zinc-400">{label}</span>
        <span className={cn('text-[10px] font-bold', score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400')}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800">
        <div className={cn('h-1 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ConversationPanel({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResponse, setShowResponse] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [addingResponse, setAddingResponse] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/prospecting/${leadId}/conversation`);
      const d = await r.json();
      setMessages(d.messages ?? []);
      setEvaluation(d.evaluation ?? null);
    } catch {}
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  async function addResponse() {
    if (!responseText.trim()) return;
    setAddingResponse(true);
    setError('');
    try {
      const r = await fetch(`/api/prospecting/${leadId}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: responseText.trim() }),
      });
      if (r.ok) { setResponseText(''); setShowResponse(false); await load(); }
      else { const d = await r.json(); setError(d.error ?? 'Error'); }
    } catch { setError('Error de red'); }
    setAddingResponse(false);
  }

  async function evaluate() {
    setEvaluating(true);
    setError('');
    try {
      const r = await fetch(`/api/prospecting/${leadId}/evaluate`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Error de IA'); return; }
      setEvaluation(d);
      setShowEval(true);
    } catch { setError('Error de red'); }
    setEvaluating(false);
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-zinc-600"><Loader2 className="h-3 w-3 animate-spin" /> Cargando conversación...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Conversación ({messages.length} mensajes)</p>
        {messages.length >= 2 && (
          <button onClick={evaluate} disabled={evaluating}
            className="flex items-center gap-1 text-[10px] font-bold text-violet-400 border border-violet-500/25 rounded-lg px-2 py-1 hover:bg-violet-500/10 transition disabled:opacity-40">
            {evaluating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            Evaluar con IA
          </button>
        )}
      </div>

      {/* Thread */}
      {messages.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {messages.map(m => (
            <div key={m.id} className={cn('rounded-xl px-3 py-2 text-sm max-w-[85%]', m.direction === 'outbound' ? 'ml-auto bg-emerald-900/30 border border-emerald-700/25 text-emerald-100' : 'bg-zinc-800/60 border border-zinc-700/30 text-zinc-200')}>
              <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
              <p className="text-[9px] text-zinc-600 mt-1">{m.direction === 'outbound' ? 'Vos' : 'Lead'} · {new Date(m.sent_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600 italic">Sin mensajes. Usá &quot;Contactar&quot; para registrar tu apertura.</p>
      )}

      {/* Add response */}
      {messages.length > 0 && (
        <div>
          {!showResponse ? (
            <button onClick={() => setShowResponse(true)}
              className="flex items-center gap-1.5 text-xs text-sky-400 border border-sky-500/20 rounded-xl px-3 py-1.5 hover:bg-sky-500/10 transition">
              <Plus className="h-3.5 w-3.5" /> Registrar respuesta del lead
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                rows={3} autoFocus
                placeholder="Pegá la respuesta que te mandó el lead en WhatsApp..."
                className="w-full rounded-xl border border-sky-500/25 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button onClick={addResponse} disabled={!responseText.trim() || addingResponse}
                  className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40 flex items-center gap-1.5">
                  {addingResponse && <Loader2 className="h-3 w-3 animate-spin" />} Registrar
                </button>
                <button onClick={() => { setShowResponse(false); setResponseText(''); }}
                  className="rounded-xl border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Evaluation */}
      {evaluation && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-900/10 overflow-hidden">
          <button onClick={() => setShowEval(v => !v)}
            className="flex items-center justify-between w-full px-3 py-2">
            <div className="flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-bold text-violet-300">Evaluación IA</span>
              <span className={cn('text-sm font-black', (evaluation.score_total ?? 0) >= 7 ? 'text-emerald-400' : (evaluation.score_total ?? 0) >= 5 ? 'text-yellow-400' : 'text-red-400')}>
                {evaluation.score_total?.toFixed(1)}/10
              </span>
            </div>
            {showEval ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
          </button>

          {showEval && (
            <div className="border-t border-violet-500/10 px-3 py-3 space-y-3">
              {evaluation.summary && <p className="text-xs text-zinc-300 leading-relaxed">{evaluation.summary}</p>}

              <div className="grid grid-cols-2 gap-2">
                <ScoreBar label="Apertura" score={evaluation.score_opening ?? 0} />
                <ScoreBar label="Conexión" score={evaluation.score_connection ?? 0} />
                <ScoreBar label="Preguntas" score={evaluation.score_questions ?? 0} />
                <ScoreBar label="Defensa" score={evaluation.score_defense_handling ?? 0} />
                <ScoreBar label="Rapport" score={evaluation.score_rapport ?? 0} />
                <ScoreBar label="Avance" score={evaluation.score_advance ?? 0} />
                <ScoreBar label="Criterio" score={evaluation.score_commercial_criteria ?? 0} />
              </div>

              {evaluation.strengths?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Fortalezas</p>
                  {evaluation.strengths.map((s, i) => <p key={i} className="text-xs text-zinc-300">· {s}</p>)}
                </div>
              )}
              {evaluation.weaknesses?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase mb-1">A mejorar</p>
                  {evaluation.weaknesses.map((s, i) => <p key={i} className="text-xs text-zinc-300">· {s}</p>)}
                </div>
              )}
              {evaluation.next_exercise && (
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                  <p className="text-[10px] font-bold text-yellow-400 uppercase mb-1">Ejercicio recomendado</p>
                  <p className="text-xs text-yellow-200">{evaluation.next_exercise}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
