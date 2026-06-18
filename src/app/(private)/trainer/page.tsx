'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, RotateCcw, ChevronLeft, History, MessageSquare, Star, Clock, ChevronRight, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

type SessionRow = {
  id: string;
  scenario_name: string;
  scenario_group: string;
  scenario_tag: string;
  difficulty: number;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  evaluations_count: number;
  last_evaluation: string | null;
  status: string;
};

type SessionDetail = SessionRow & {
  trainer_messages: { id: string; role: string; content: string; is_evaluation: boolean; created_at: string }[];
};

// ── Escenarios ─────────────────────────────────────────────────────
const SCENARIOS = [
  { id: 'fria-1',     group: 'FRÍA',     emoji: '🧊', name: 'Desconocido Abierto',    diff: 1,  tag: 'BÁSICO',     desc: 'No te conoce pero responde sin hostilidad. El mejor punto de partida para practicar apertura.',                          tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',      groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'fria-2',     group: 'FRÍA',     emoji: '🧊', name: 'Ocupado e Indiferente',  diff: 3,  tag: 'INTERMEDIO', desc: 'No tiene tiempo ni interés aparente. Hay que generar valor en los primeros dos mensajes.',                                tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',      groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'fria-3',     group: 'FRÍA',     emoji: '🧊', name: 'Escéptico Total',         diff: 6,  tag: 'AVANZADO',   desc: 'Desconfía de todo mensaje en frío. Detecta scripts. Requiere autenticidad total desde el principio.',                     tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',      groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'fria-4',     group: 'FRÍA',     emoji: '🧊', name: 'Hostil desde el Inicio',  diff: 9,  tag: 'ÉLITE',      desc: 'Responde mal desde el primer mensaje. Desactivar la agresividad es el único camino.',                                     tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',      groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'tibia-1',    group: 'TIBIA',    emoji: '🌡️', name: 'Vio tu Contenido',       diff: 2,  tag: 'BÁSICO',     desc: 'Interactuó con redes o vio un video. Hay apertura pero también dudas lógicas.',                                          tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'tibia-2',    group: 'TIBIA',    emoji: '🌡️', name: 'Referido con Dudas',     diff: 4,  tag: 'INTERMEDIO', desc: 'Lo recomendó alguien de confianza, pero tiene sus propias reservas sobre el programa.',                                   tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'tibia-3',    group: 'TIBIA',    emoji: '🌡️', name: 'Quemado por Cursos',     diff: 7,  tag: 'AVANZADO',   desc: 'Invirtió antes en formación y le fue mal. Tiene el contexto pero también la cicatriz.',                                   tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'tibia-4',    group: 'TIBIA',    emoji: '🌡️', name: 'Analítico Extremo',      diff: 10, tag: 'ÉLITE',      desc: 'Pide datos, pruebas y lógica en cada paso. Nada de promesas — solo evidencia.',                                           tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'caliente-1', group: 'CALIENTE', emoji: '🔥', name: 'Listo para Cerrar',       diff: 2,  tag: 'BÁSICO',     desc: 'Ya quiere entrar. Falta confirmar detalles. Practicá el cierre limpio sin sobrevender.',                                  tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',      groupColor: 'border-red-500/25 hover:border-red-400/50' },
  { id: 'caliente-2', group: 'CALIENTE', emoji: '🔥', name: 'Objeción de Precio',      diff: 5,  tag: 'INTERMEDIO', desc: 'Quiere entrar pero dice que es caro. Hay que manejar el valor sin bajar el precio.',                                      tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',      groupColor: 'border-red-500/25 hover:border-red-400/50' },
  { id: 'caliente-3', group: 'CALIENTE', emoji: '🔥', name: 'Trampa del Interesado',   diff: 8,  tag: 'AVANZADO',   desc: 'Parece que va a cerrar pero busca que prometas resultados. Integridad bajo presión máxima.',                              tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',      groupColor: 'border-red-500/25 hover:border-red-400/50' },
  { id: 'caliente-4', group: 'CALIENTE', emoji: '🔥', name: 'Campo Real Extremo',      diff: 10, tag: 'ÉLITE',      desc: 'Todo en simultáneo: precio, dudas, objeciones y una decisión que no puede esperar.',                                      tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',      groupColor: 'border-red-500/25 hover:border-red-400/50' },
];

const DIFF_COLORS = ['','bg-emerald-500','bg-sky-400','bg-sky-500','bg-amber-400','bg-amber-500','bg-orange-400','bg-orange-500','bg-red-400','bg-red-500','bg-purple-500'];
const GROUPS = ['FRÍA','TIBIA','CALIENTE'] as const;
const GROUP_META = {
  FRÍA:     { emoji:'🧊', color:'text-sky-400',   border:'border-sky-500/20',   label:'Prospección Fría' },
  TIBIA:    { emoji:'🌡️', color:'text-amber-400', border:'border-amber-500/20', label:'Prospección Tibia' },
  CALIENTE: { emoji:'🔥', color:'text-red-400',   border:'border-red-500/20',   label:'Prospección Caliente' },
};

function randomId() { return Math.random().toString(36).slice(2); }

function fmtDuration(start: string, end: string | null) {
  if (!end) return '—';
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function groupColor(g: string) {
  if (g === 'FRÍA') return 'text-sky-400';
  if (g === 'TIBIA') return 'text-amber-400';
  return 'text-red-400';
}

// ── Panel detalle de sesión ────────────────────────────────────────
function SessionDetailPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trainer/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-[#090909] border-l border-[rgba(212,175,55,0.15)] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.1)] px-5 py-4">
          <MessageSquare className="h-4 w-4 text-brand-gold" />
          <p className="flex-1 font-semibold text-brand-text">{data?.scenario_name ?? 'Cargando...'}</p>
          <button onClick={onClose} className="rounded-md p-1.5 text-brand-muted hover:text-brand-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {/* Meta */}
            <div className="flex flex-wrap gap-2 text-xs text-brand-muted mb-4">
              <span className={`font-bold ${groupColor(data.scenario_group)}`}>{data.scenario_group}</span>
              <span>·</span>
              <span>{data.scenario_tag}</span>
              <span>·</span>
              <span>Dif. {data.difficulty}/10</span>
              <span>·</span>
              <span>{new Date(data.started_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
              <span>·</span>
              <span>{fmtDuration(data.started_at, data.ended_at)}</span>
              <span>·</span>
              <span>{data.message_count} mensajes</span>
              {data.evaluations_count > 0 && <><span>·</span><span className="text-brand-gold">{data.evaluations_count} evaluación{data.evaluations_count > 1 ? 'es' : ''}</span></>}
            </div>

            {/* Mensajes */}
            {(data.trainer_messages ?? []).map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'rounded-br-sm bg-brand-gold text-black'
                    : msg.is_evaluation
                      ? 'rounded-bl-sm border border-emerald-500/30 bg-emerald-900/20 text-emerald-300'
                      : 'rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] text-brand-text'
                  }`}>
                  {msg.is_evaluation && <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Evaluación</p>}
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-brand-muted">No se pudo cargar la sesión.</p>
        )}
      </div>
    </div>
  );
}

// ── Historial tab ──────────────────────────────────────────────────
function HistorialView() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trainer/sessions')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSessions(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
    </div>
  );

  if (!sessions.length) return (
    <div className="py-16 text-center">
      <History className="h-10 w-10 text-brand-muted/40 mx-auto mb-3" />
      <p className="text-sm text-brand-muted">Todavía no hiciste ningún entrenamiento.</p>
      <p className="text-xs text-brand-muted/60 mt-1">Elegí un escenario para empezar.</p>
    </div>
  );

  const totalMensajes = sessions.reduce((s, r) => s + r.message_count, 0);
  const totalEvals = sessions.reduce((s, r) => s + r.evaluations_count, 0);

  return (
    <>
      {detailId && <SessionDetailPanel sessionId={detailId} onClose={() => setDetailId(null)} />}

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Sesiones', value: sessions.length },
          { label: 'Mensajes', value: totalMensajes },
          { label: 'Evaluaciones', value: totalEvals },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] p-4 text-center">
            <p className="text-2xl font-bold text-brand-gold">{s.value}</p>
            <p className="text-[11px] text-brand-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {sessions.map(s => (
          <button key={s.id} onClick={() => setDetailId(s.id)}
            className="w-full flex items-center gap-4 rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 text-left hover:bg-[#111] transition">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold ${groupColor(s.scenario_group)}`}>{s.scenario_group}</span>
                <span className="text-[10px] text-brand-muted/60 border border-[rgba(212,175,55,0.15)] rounded px-1.5">{s.scenario_tag}</span>
              </div>
              <p className="text-sm font-medium text-brand-text truncate">{s.scenario_name}</p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-brand-muted">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(s.started_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {s.message_count} mensajes
                </span>
                {s.evaluations_count > 0 && (
                  <span className="flex items-center gap-1 text-brand-gold">
                    <Star className="h-3 w-3" />
                    {s.evaluations_count} eval
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-brand-muted shrink-0" />
          </button>
        ))}
      </div>
    </>
  );
}

// ── Página principal ───────────────────────────────────────────────
export default function TrainerPage() {
  const [view, setView] = useState<'selector' | 'historial' | 'chat'>('selector');
  const [scenario, setScenario] = useState<typeof SCENARIOS[0] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => randomId());
  const [sessionDbId, setSessionDbId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const endCurrentSession = useCallback(async () => {
    if (!sessionDbId) return;
    try {
      await fetch(`/api/trainer/sessions/${sessionDbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
    } catch { /* best-effort */ }
    setSessionDbId(null);
  }, [sessionDbId]);

  async function startScenario(s: typeof SCENARIOS[0]) {
    await endCurrentSession();
    setScenario(s); setMessages([]); setView('chat'); setLoading(true);

    // Crear sesión en DB
    let dbId: string | null = null;
    try {
      const mode = s.group === 'FRÍA' ? 'fria' : s.group === 'TIBIA' ? 'tibia' : 'caliente';
      const r = await fetch('/api/trainer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: s.id, scenario_name: s.name,
          scenario_group: s.group, scenario_tag: s.tag,
          difficulty: s.diff, mode,
        }),
      });
      const d = await r.json();
      if (d.id) { dbId = d.id; setSessionDbId(d.id); }
    } catch { /* best-effort */ }

    const mode = s.group === 'FRÍA' ? 'fria' : s.group === 'TIBIA' ? 'tibia' : 'caliente';
    await fetch('/api/trainer/chat', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });

    const res = await fetch('/api/trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, sessionDbId: dbId, message: `INICIO SIMULACIÓN — Escenario: ${s.name}. ${s.desc}`, mode }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.response) setMessages([{ role: 'assistant', content: data.response }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !scenario) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    const mode = scenario.group === 'FRÍA' ? 'fria' : scenario.group === 'TIBIA' ? 'tibia' : 'caliente';
    const res = await fetch('/api/trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, sessionDbId, message: text, mode }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.response) setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function goBack() {
    await endCurrentSession();
    setView('selector');
  }

  // ── Selector ──────────────────────────────────────────────────────
  if (view === 'selector' || view === 'historial') {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-2 py-8">
        {/* Header con tabs */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-brand-gold">CAC TRAINER</h1>
            <p className="text-sm text-brand-muted mt-1">Practicá como en campo real. Todo queda registrado.</p>
          </div>
          <div className="flex rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-1">
            <button onClick={() => setView('selector')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${view === 'selector' ? 'bg-brand-gold text-black' : 'text-brand-muted hover:text-brand-text'}`}>
              Escenarios
            </button>
            <button onClick={() => setView('historial')}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${view === 'historial' ? 'bg-brand-gold text-black' : 'text-brand-muted hover:text-brand-text'}`}>
              <History className="h-3.5 w-3.5" /> Mi historial
            </button>
          </div>
        </div>

        {view === 'historial' ? <HistorialView /> : (
          <>
            {GROUPS.map(g => {
              const meta = GROUP_META[g];
              return (
                <div key={g} className="space-y-3">
                  <div className={`flex items-center gap-2 border-b pb-2 ${meta.border}`}>
                    <span className="text-xl">{meta.emoji}</span>
                    <span className={`text-xs font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SCENARIOS.filter(s => s.group === g).map(s => (
                      <button key={s.id} onClick={() => startScenario(s)}
                        className={`group flex flex-col gap-3 rounded-xl border bg-[#0d0d0d] p-4 text-left transition-all hover:bg-[#131313] ${s.groupColor}`}>
                        <div className="flex gap-[3px]">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <span key={i} className={`h-1 flex-1 rounded-full ${i < s.diff ? DIFF_COLORS[s.diff] : 'bg-[#2a2a2a]'}`} />
                          ))}
                        </div>
                        <div className="space-y-1">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${s.tagColor}`}>{s.tag}</span>
                          <p className="text-sm font-semibold leading-tight text-brand-text">{s.name}</p>
                          <p className="text-[11px] leading-relaxed text-brand-muted">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 text-xs text-brand-muted flex gap-6 justify-center">
              <span><span className="text-brand-gold font-semibold">evaluame</span> → feedback instantáneo</span>
              <span><span className="text-brand-gold font-semibold">EVOLUCIÓN</span> → subir dificultad</span>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Chat ──────────────────────────────────────────────────────────
  const gColor = scenario?.group === 'FRÍA' ? 'text-sky-400' : scenario?.group === 'TIBIA' ? 'text-amber-400' : 'text-red-400';

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-4 py-3">
          <button onClick={goBack} className="rounded-md p-1.5 text-brand-muted hover:bg-[#1a1a1a] hover:text-brand-text">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xl">{scenario?.emoji}</span>
          <div>
            <p className={`text-xs font-bold tracking-wider ${gColor}`}>{scenario?.group} · {scenario?.tag}</p>
            <p className="text-sm font-semibold text-brand-text">{scenario?.name}</p>
          </div>
          <div className="ml-auto">
            <button onClick={() => scenario && startScenario(scenario)}
              className="flex items-center gap-1.5 rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs text-brand-muted hover:border-brand-gold/40 hover:text-brand-text">
              <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4" style={{ background: '#080808' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'rounded-br-sm bg-brand-gold text-black'
                  : 'rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] text-brand-text'
                }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-brand-muted" style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
              placeholder="Escribí tu mensaje..." disabled={loading}
              className="flex-1 resize-none rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#111] px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none disabled:opacity-50"
              style={{ maxHeight: '120px' }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }} />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </>
  );
}
