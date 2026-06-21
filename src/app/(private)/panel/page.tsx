'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { SetterWorkspace, PriorityItem } from '@/lib/workspace';
import {
  MessageSquare, Users, Clock, FileText, Zap, TrendingUp,
  CheckCircle, AlertCircle, RefreshCw, Send, ChevronRight,
  BarChart2, ArrowRight, Calendar,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(mins: number) {
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)}h`;
  return `hace ${Math.floor(mins / 1440)} día${Math.floor(mins / 1440) > 1 ? 's' : ''}`;
}

const STATUS_LABELS: Record<string, string> = {
  NO_CONTACTADO: 'Sin contactar',
  APERTURA_ENVIADA: 'Apertura enviada',
  CONTACTADO: 'Contactado',
  RESPONDIO: 'Respondió',
  INTERES_DETECTADO: 'Interés detectado',
  INVITADO_AL_GRUPO: 'Invitado al grupo',
  INGRESO_AL_GRUPO: 'Ingresó al grupo',
  REUNION_PROPUESTA: 'Reunión propuesta',
  REUNION_AGENDADA: 'Reunión agendada',
};

// ─── Block: Reply ────────────────────────────────────────────────────────────

function ReplyBlock({ item, onDone }: { item: PriorityItem; onDone: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const leadId = item.meta?.leadId;
  const meta = item.meta;
  if (!leadId || !meta) return null;

  async function sendReply() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/prospecting/${leadId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      setTimeout(onDone, 1800);
    } catch {
      setError('No se pudo enviar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-4">
        <CheckCircle size={18} className="text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-300">Respuesta enviada</p>
          <p className="text-xs text-white/40">La conversación se actualizó. Cargando próxima tarea...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-green-500/40 bg-[#0d1a0d] space-y-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-sm font-bold text-white">{meta.leadName}</p>
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400 uppercase tracking-wide">
            Respondió {timeAgo(item.minutesWaiting ?? 0)}
          </span>
        </div>
        {meta.leadPhone && (
          <span className="text-[10px] font-mono text-white/30">{meta.leadPhone}</span>
        )}
      </div>

      {/* Their message */}
      {meta.inboundMessage && (
        <div className="mx-4 rounded-xl border border-green-500/20 bg-green-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-green-500/60 mb-1.5">Ellos escribieron:</p>
          <p className="text-sm text-white/85 leading-relaxed">&ldquo;{meta.inboundMessage}&rdquo;</p>
        </div>
      )}

      {/* Reply composer */}
      <div className="px-4 space-y-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendReply(); }}
          placeholder="Escribí tu respuesta aquí..."
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-green-500/50 transition"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
        <button
          onClick={sendReply}
          disabled={!text.trim() || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-sm font-bold text-black disabled:opacity-30 hover:bg-green-400 transition"
        >
          <Send size={14} />
          {loading ? 'Enviando...' : 'Enviar respuesta'}
        </button>
        <Link
          href={`/inbox?conv=${meta.convId}`}
          className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white/50 hover:text-white hover:border-white/25 transition"
        >
          Ver historial
        </Link>
      </div>
    </div>
  );
}

// ─── Block: Contact lead ─────────────────────────────────────────────────────

function ContactBlock({ item, onDone }: { item: PriorityItem; onDone: () => void }) {
  const meta = item.meta;
  const leadId = meta?.leadId;
  const suggested = meta?.leadFirstName
    ? `Hola ${meta.leadFirstName}, ¿cómo estás? Te escribo porque vi que podrías estar buscando una oportunidad para desarrollarte en ventas. ¿Tenés unos minutos para contarme más?`
    : '';

  const [text, setText] = useState(suggested);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!leadId || !meta) return null;

  async function send() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/prospecting/${leadId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      setTimeout(onDone, 1800);
    } catch {
      setError('No se pudo enviar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
        <CheckCircle size={18} className="text-blue-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-300">Apertura enviada a {meta.leadName}</p>
          <p className="text-xs text-white/40">Lead actualizado a contactado. Cargando próxima tarea...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-500/40 bg-[#0a0d1a] space-y-3 overflow-hidden">
      {/* Lead info */}
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-400" />
            <p className="text-sm font-bold text-white">{meta.leadName}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            {meta.leadCountry && <span>{meta.leadCountry}</span>}
            {meta.leadPhone && <span className="font-mono">{meta.leadPhone}</span>}
            <span className="text-blue-400/70">{item.reason}</span>
          </div>
        </div>
        <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-wide">
          Sin contactar
        </span>
      </div>

      {/* Message composer */}
      <div className="px-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest text-white/30">Mensaje de apertura:</p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) send(); }}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-blue-500/50 transition"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
        <button
          onClick={send}
          disabled={!text.trim() || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 py-2.5 text-sm font-bold text-white disabled:opacity-30 hover:bg-blue-400 transition"
        >
          <Send size={14} />
          {loading ? 'Enviando...' : 'Contactar ahora'}
        </button>
        <button
          onClick={onDone}
          className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white/40 hover:text-white hover:border-white/25 transition"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}

// ─── Block: Follow-up vencido ────────────────────────────────────────────────

function FollowUpBlock({ item, onDone }: { item: PriorityItem; onDone: () => void }) {
  const meta = item.meta;
  const leadId = meta?.leadId;
  const [loading, setLoading] = useState<'done' | 'postpone' | null>(null);
  const [result, setResult] = useState<'done' | 'postponed' | null>(null);
  const [error, setError] = useState('');

  if (!leadId || !meta) return null;

  async function markDone() {
    setLoading('done');
    setError('');
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_follow_up_at: null }),
      });
      if (!res.ok) throw new Error();
      setResult('done');
      setTimeout(onDone, 1500);
    } catch {
      setError('Error al actualizar. Intentá de nuevo.');
      setLoading(null);
    }
  }

  async function postpone3() {
    setLoading('postpone');
    setError('');
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_follow_up_at: new Date(Date.now() + 3 * 86400000).toISOString() }),
      });
      if (!res.ok) throw new Error();
      setResult('postponed');
      setTimeout(onDone, 1500);
    } catch {
      setError('Error al actualizar. Intentá de nuevo.');
      setLoading(null);
    }
  }

  if (result === 'done') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-4">
        <CheckCircle size={18} className="text-green-400 shrink-0" />
        <p className="text-sm text-green-300">Seguimiento marcado como hecho.</p>
      </div>
    );
  }
  if (result === 'postponed') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4">
        <Calendar size={18} className="text-yellow-400 shrink-0" />
        <p className="text-sm text-yellow-300">Seguimiento reprogramado para en 3 días.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-yellow-500/40 bg-[#1a1500] overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-yellow-400" />
            <p className="text-sm font-bold text-white">{meta.leadName}</p>
            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
              VENCIDO
            </span>
          </div>
          <p className="text-xs text-white/40">{item.reason}</p>
          {meta.leadStatus && (
            <p className="text-xs text-white/30 mt-0.5">
              Estado: {STATUS_LABELS[meta.leadStatus] ?? meta.leadStatus}
            </p>
          )}
        </div>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
        <button
          onClick={markDone}
          disabled={loading !== null}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500/15 border border-green-500/30 py-2.5 text-sm font-bold text-green-400 disabled:opacity-40 hover:bg-green-500/25 transition"
        >
          <CheckCircle size={14} />
          {loading === 'done' ? 'Guardando...' : 'Marcar como hecho'}
        </button>
        <button
          onClick={postpone3}
          disabled={loading !== null}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-xs font-bold text-yellow-400 disabled:opacity-40 hover:bg-yellow-500/20 transition"
        >
          <Calendar size={12} />
          {loading === 'postpone' ? '...' : '+3 días'}
        </button>
      </div>
    </div>
  );
}

// ─── Block: Formulario pendiente ─────────────────────────────────────────────

function FormBlock({ item }: { item: PriorityItem }) {
  const { meta } = item;
  if (!meta?.formId) return null;

  return (
    <div className="rounded-2xl border border-purple-500/40 bg-[#120a1a] overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={14} className="text-purple-400" />
          <p className="text-[10px] uppercase tracking-widest text-purple-400/70">Formulario pendiente</p>
        </div>
        <p className="text-base font-bold text-white mb-1">{meta.formTitle}</p>
        <p className="text-xs text-white/40">{item.reason}</p>
      </div>
      <div className="border-t border-white/5 px-4 py-3">
        <Link
          href={`/formularios/${meta.formId}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 py-2.5 text-sm font-bold text-white hover:bg-purple-400 transition"
        >
          <FileText size={14} />
          Completar este formulario
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ─── Block: Evaluación IA (siempre inline) ───────────────────────────────────

function EvaluationPanel({ ws }: { ws: SetterWorkspace }) {
  const { latestEvaluation, currentStatus } = ws;

  if (!latestEvaluation && !currentStatus.currentWeakness) return null;

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-[#1a0e00] space-y-4 overflow-hidden">
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-orange-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-orange-400/70">Tu evaluación IA</p>
          </div>
          {latestEvaluation && (
            <div className="text-right">
              <span className="text-2xl font-black text-white">{latestEvaluation.scoreTotal.toFixed(1)}</span>
              <span className="text-sm text-white/30">/10</span>
            </div>
          )}
        </div>

        {latestEvaluation ? (
          <>
            {/* Scores */}
            <div className="space-y-2 mb-4">
              {Object.entries(latestEvaluation.scores).map(([label, val]) => {
                const color = val >= 7 ? 'bg-green-500' : val >= 5 ? 'bg-yellow-500' : 'bg-red-500';
                const isWeak = label === latestEvaluation.weakestSkill;
                return (
                  <div key={label} className={`flex items-center justify-between gap-2 ${isWeak ? 'opacity-100' : 'opacity-60'}`}>
                    <span className={`text-xs ${isWeak ? 'font-bold text-red-300' : 'text-white/60'}`}>
                      {isWeak ? '⚠ ' : ''}{label}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${(val / 10) * 100}%` }} />
                      </div>
                      <span className={`w-6 text-right text-xs font-bold ${isWeak ? 'text-red-300' : 'text-white/70'}`}>{val}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Punto débil + feedback */}
            {latestEvaluation.weakestSkill && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 mb-3">
                <p className="text-xs font-bold text-red-400 mb-1">
                  Tu punto débil: {latestEvaluation.weakestSkill}
                </p>
                {latestEvaluation.feedback && (
                  <p className="text-xs text-white/60 leading-relaxed">
                    &ldquo;{latestEvaluation.feedback}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Ejercicio recomendado */}
            {latestEvaluation.recommendedExercise && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 mb-1">
                <p className="text-[10px] uppercase tracking-widest text-orange-400/70 mb-1">Ejercicio recomendado:</p>
                <p className="text-sm text-white/80">{latestEvaluation.recommendedExercise}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-white/40">
            Todavía no tenés evaluaciones. Enviá mensajes a tus leads y evaluá con IA desde el inbox.
          </p>
        )}
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        <Link
          href="/trainer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500/15 border border-orange-500/30 py-2.5 text-sm font-bold text-orange-400 hover:bg-orange-500/25 transition"
        >
          <Zap size={14} />
          Practicar ahora
        </Link>
      </div>
    </div>
  );
}

// ─── Work block router ───────────────────────────────────────────────────────

function WorkBlock({ item, onDone }: { item: PriorityItem; onDone: () => void }) {
  switch (item.type) {
    case 'reply':        return <ReplyBlock item={item} onDone={onDone} />;
    case 'contact_lead': return <ContactBlock item={item} onDone={onDone} />;
    case 'follow_up':   return <FollowUpBlock item={item} onDone={onDone} />;
    case 'form':        return <FormBlock item={item} />;
    default:            return null;
  }
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function PanelPage() {
  const [ws, setWs] = useState<SetterWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setter/workspace');
      if (!res.ok) throw new Error();
      setWs(await res.json());
    } catch {
      setError('No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (error || !ws) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-white/50">{error}</p>
        <button onClick={load} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">Reintentar</button>
      </div>
    );
  }

  const { setter, currentStatus, priorityQueue, personalMetrics, funnel, latestEvaluation } = ws;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  const workItems = priorityQueue.filter(i => i.type !== 'evaluation');
  const hasWork = workItems.length > 0;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6 pb-28">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/30">{greeting}</p>
          <h1 className="text-xl font-black text-white">{setter.name.split(' ')[0]}</h1>
        </div>
        <button onClick={load} className="rounded-xl bg-white/5 p-2 text-white/30 hover:text-white transition">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { v: currentStatus.newReplies,        label: 'Respondieron', alert: currentStatus.newReplies > 0 },
          { v: currentStatus.overdueFollowUps,  label: 'Vencidos',     alert: currentStatus.overdueFollowUps > 0 },
          { v: currentStatus.leadsWithoutContact, label: 'Sin contactar', alert: false },
          { v: currentStatus.pendingForms,      label: 'Formularios',  alert: currentStatus.pendingForms > 0 },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border py-2.5 ${s.alert && s.v > 0 ? 'border-red-500/30 bg-red-500/8' : 'border-white/8 bg-white/3'}`}>
            <p className={`text-xl font-black ${s.alert && s.v > 0 ? 'text-red-400' : 'text-white'}`}>{s.v}</p>
            <p className="text-[10px] text-white/35">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── WORK QUEUE — Centro del panel ─────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-white/30" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            {hasWork ? `${workItems.length} tarea${workItems.length > 1 ? 's' : ''} ahora` : 'Sin tareas urgentes'}
          </p>
        </div>

        {!hasWork ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 py-12 text-center">
            <CheckCircle size={28} className="text-green-400" />
            <p className="text-sm font-bold text-white">Todo al día</p>
            <p className="text-xs text-white/30">No hay nada urgente en este momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workItems.map(item => (
              <WorkBlock key={item.priority} item={item} onDone={load} />
            ))}
          </div>
        )}
      </section>

      {/* ── Evaluación IA (siempre visible, datos reales) ─────────────── */}
      <EvaluationPanel ws={ws} />

      {/* ── Embudo personal (lectura) ──────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-white/30" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Tu embudo</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/3 divide-y divide-white/5 overflow-hidden">
          {[
            { label: 'Asignados',        v: funnel.assigned },
            { label: 'Sin contactar',    v: funnel.notContacted },
            { label: 'Contactados',      v: funnel.contacted },
            { label: 'Respondieron',     v: funnel.replied },
            { label: 'Con interés',      v: funnel.interested },
            { label: 'Reunión agendada', v: funnel.scheduled },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-white/60">{row.label}</span>
              <div className="flex items-center gap-3">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: funnel.assigned > 0 ? `${(row.v / funnel.assigned) * 100}%` : '0%' }}
                  />
                </div>
                <span className="w-7 text-right text-sm font-bold text-white">{row.v}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Métricas (lectura) ─────────────────────────────────────────── */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Tus métricas</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Mensajes enviados',  v: personalMetrics.messagesSent },
            { label: 'Tasa de respuesta',  v: `${personalMetrics.responseRate}%` },
            { label: 'Score IA promedio',  v: personalMetrics.averageAiScore != null ? `${personalMetrics.averageAiScore}/10` : '—' },
            { label: 'Evaluaciones',       v: personalMetrics.evaluationsCount },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
              <p className="text-xl font-black text-white">{m.v}</p>
              <p className="text-xs text-white/30">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
