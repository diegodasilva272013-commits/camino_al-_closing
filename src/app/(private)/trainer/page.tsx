'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, ChevronLeft, Zap, Target, Shield, Crown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Datos de niveles
// ---------------------------------------------------------------------------
const LEVELS = [
  { n: 1,  name: 'Campo Abierto',        diff: 1,  tag: 'INTRODUCTORIO', desc: 'Prospecto curioso, sin experiencias negativas. Apertura, rapport y propuesta sin obstáculos reales.' },
  { n: 2,  name: 'Ocupado pero Abierto', diff: 2,  tag: 'BÁSICO',        desc: 'Poco tiempo, no hostil. Generá valor rápido sin presionar.' },
  { n: 3,  name: 'Escéptico Racional',   diff: 3,  tag: 'BÁSICO',        desc: 'Exige razones reales. Preguntas directas, no acepta vaguedades.' },
  { n: 4,  name: 'Quemado por Cursos',   diff: 4,  tag: 'INTERMEDIO',    desc: 'Invirtió antes y le fue mal. Desconfía del rubro. Validar sin atacar.' },
  { n: 5,  name: 'Indiferente Real',     diff: 5,  tag: 'INTERMEDIO',    desc: 'No tiene problema que resolver. Cualificar y decidir cuándo continuar.' },
  { n: 6,  name: 'Desconfiado Activo',   diff: 6,  tag: 'AVANZADO',      desc: 'Reconoce y nombra técnicas cuando las detecta. Autenticidad sobre técnica.' },
  { n: 7,  name: 'Hostil Controlado',    diff: 7,  tag: 'AVANZADO',      desc: 'Empieza molesto. Desactivar la hostilidad antes de poder avanzar.' },
  { n: 8,  name: 'Trampa Activa',        diff: 8,  tag: 'EXPERTO',       desc: 'Parece interesado pero busca que el setter prometa. Integridad bajo presión.' },
  { n: 9,  name: 'Prospecto Complejo',   diff: 9,  tag: 'EXPERTO',       desc: 'Múltiples objeciones superpuestas. Criterio puro: leer, adaptar, priorizar.' },
  { n: 10, name: 'Campo Real Extremo',   diff: 10, tag: 'ÉLITE',         desc: 'Lo peor posible. Todo al máximo. No solo ganar — es ver hasta dónde llegás.' },
];

const TAG_COLORS: Record<string, string> = {
  INTRODUCTORIO: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  BÁSICO:        'text-sky-400 bg-sky-400/10 border-sky-400/30',
  INTERMEDIO:    'text-amber-400 bg-amber-400/10 border-amber-400/30',
  AVANZADO:      'text-orange-400 bg-orange-400/10 border-orange-400/30',
  EXPERTO:       'text-red-400 bg-red-400/10 border-red-400/30',
  ÉLITE:         'text-purple-400 bg-purple-400/10 border-purple-400/30',
};

const TAG_ICON: Record<string, React.ReactNode> = {
  INTRODUCTORIO: <Target className="h-3 w-3" />,
  BÁSICO:        <Target className="h-3 w-3" />,
  INTERMEDIO:    <Zap className="h-3 w-3" />,
  AVANZADO:      <Shield className="h-3 w-3" />,
  EXPERTO:       <Shield className="h-3 w-3" />,
  ÉLITE:         <Crown className="h-3 w-3" />,
};

type Level = typeof LEVELS[number];

// ---------------------------------------------------------------------------
// Tipos de mensaje
// ---------------------------------------------------------------------------
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function randomId() {
  return Math.random().toString(36).slice(2);
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function TrainerPage() {
  const [view, setView] = useState<'levels' | 'chat'>('levels');
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => randomId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  async function startSimulation(level: Level) {
    // Reset thread en el server
    await fetch('/api/trainer/chat', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    setActiveLevel(level);
    setMessages([]);
    setView('chat');

    // Mensaje inicial automático: le pedimos al assistant que arranque como el prospecto
    setLoading(true);
    try {
      const res = await fetch('/api/trainer/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: `nivel ${level.n}`,
          level,
        }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages([{ role: 'assistant', content: data.response, ts: Date.now() }]);
      }
    } catch {
      setMessages([{ role: 'assistant', content: '⚠️ Error al conectar con el servidor. Verificá OPENAI_API_KEY y CAC_ASSISTANT_ID en .env.local', ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !activeLevel) return;

    const userMsg: Msg = { role: 'user', content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/trainer/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, level: activeLevel }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response, ts: Date.now() }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${data.error ?? 'Error'}`, ts: Date.now() }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Error de red', ts: Date.now() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Vista: selector de niveles
  // ---------------------------------------------------------------------------
  if (view === 'levels') {
    return (
      <div className="min-h-screen bg-[#030303]">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.32em] text-[#f5d27a]">
              CAC TRAINER
            </p>
            <h1 className="font-serif text-3xl font-bold text-[#f5f1e8] md:text-4xl">
              Simulador de Campo
            </h1>
            <p className="mt-3 text-sm text-[#b6ad9e]">
              Elegí un nivel y practicá con un prospecto real de base fría de WhatsApp.
            </p>
          </div>

          {/* Grid de niveles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LEVELS.map((level) => (
              <button
                key={level.n}
                onClick={() => startSimulation(level)}
                className="group relative overflow-hidden rounded-[18px] border border-[rgba(214,164,58,0.22)] bg-gradient-to-b from-[rgba(255,255,255,0.05)] to-[rgba(255,255,255,0.018)] p-5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.45)] transition-all duration-200 hover:border-[rgba(214,164,58,0.5)] hover:shadow-[0_0_30px_rgba(214,164,58,0.15)]"
              >
                {/* Número grande de fondo */}
                <span className="absolute right-4 top-2 font-serif text-6xl font-bold text-white/[0.04] select-none">
                  {level.n}
                </span>

                {/* Tag */}
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TAG_COLORS[level.tag]}`}>
                  {TAG_ICON[level.tag]}
                  {level.tag}
                </span>

                {/* Nombre */}
                <h3 className="mt-3 font-serif text-base font-bold text-[#f5f1e8] transition group-hover:text-[#f5d27a]">
                  Nivel {level.n} — {level.name}
                </h3>

                {/* Dificultad */}
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition ${
                        i < level.diff
                          ? level.diff <= 3
                            ? 'bg-emerald-400'
                            : level.diff <= 5
                            ? 'bg-amber-400'
                            : level.diff <= 7
                            ? 'bg-orange-400'
                            : 'bg-red-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>

                {/* Descripción */}
                <p className="mt-3 text-xs leading-relaxed text-[#b6ad9e]">{level.desc}</p>

                {/* CTA */}
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#d6a43a] opacity-0 transition group-hover:opacity-100">
                  Iniciar simulación <Send className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Vista: chat
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#030303]">
      {/* Header del chat */}
      <header className="flex items-center gap-3 border-b border-[rgba(214,164,58,0.15)] bg-gradient-to-b from-[#0d0c08] to-[#09090b] px-4 py-3">
        <button
          onClick={() => setView('levels')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#b6ad9e] hover:bg-[rgba(214,164,58,0.1)] hover:text-[#d6a43a]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Avatar prospecto */}
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1a1410] to-[#2a1f0a] ring-1 ring-[rgba(214,164,58,0.3)] text-sm font-bold text-[#d6a43a]">
          ?
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-sm font-bold text-[#f5f1e8]">
              Nivel {activeLevel?.n} — {activeLevel?.name}
            </h2>
            <span className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex items-center gap-1 ${TAG_COLORS[activeLevel?.tag ?? 'BÁSICO']}`}>
              {activeLevel?.tag}
            </span>
          </div>
          <p className="truncate text-[11px] text-[#b6ad9e]">Prospecto de base fría — WhatsApp</p>
        </div>

        <button
          onClick={() => activeLevel && startSimulation(activeLevel)}
          className="flex items-center gap-1.5 rounded-full border border-[rgba(214,164,58,0.2)] px-3 py-1.5 text-xs text-[#b6ad9e] hover:border-[rgba(214,164,58,0.5)] hover:text-[#d6a43a]"
          title="Reiniciar simulación"
        >
          <RotateCcw className="h-3 w-3" />
          <span className="hidden sm:inline">Reiniciar</span>
        </button>
      </header>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(214,164,58,0.04) 0%, transparent 60%), #030303',
        }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {/* Hint inicial */}
          {messages.length === 0 && !loading && (
            <div className="py-8 text-center text-xs text-[#b6ad9e]/50">
              Iniciando simulación…
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar prospecto */}
              {msg.role === 'assistant' && (
                <div className="mb-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1a1410] to-[#2a1f0a] ring-1 ring-[rgba(214,164,58,0.25)] text-[10px] font-bold text-[#d6a43a]">
                  ?
                </div>
              )}

              <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`rounded-2xl px-3 py-2 shadow ${
                    msg.role === 'user'
                      ? 'rounded-br-md bg-gradient-to-br from-[#d6a43a] to-[#b8891e] text-black'
                      : 'rounded-bl-md bg-[#16161a] text-[#f5f1e8]'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {msg.content}
                  </p>
                </div>
                <span className={`mt-0.5 text-[10px] text-[#b6ad9e]/50 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {fmtTime(msg.ts)}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="mb-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1a1410] to-[#2a1f0a] ring-1 ring-[rgba(214,164,58,0.25)] text-[10px] font-bold text-[#d6a43a]">
                ?
              </div>
              <div className="rounded-2xl rounded-bl-md bg-[#16161a] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b6ad9e]/60 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b6ad9e]/60 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b6ad9e]/60 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="border-t border-[rgba(214,164,58,0.08)] bg-[#030303] px-4 py-1.5 text-center text-[10px] text-[#b6ad9e]/40">
        <span className="text-[#f5d27a]/60">evaluame</span> → feedback ·{' '}
        <span className="text-[#f5d27a]/60">EVOLUCIÓN</span> → drill avanzado
      </div>

      {/* Input */}
      <div className="border-t border-[rgba(214,164,58,0.12)] bg-[#09090b] px-3 py-2.5">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Escribí tu mensaje al prospecto…"
            rows={1}
            disabled={loading}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-[rgba(214,164,58,0.18)] bg-[#0a0a0a] px-4 py-2.5 text-sm text-[#f5f1e8] placeholder:text-[#b6ad9e]/50 focus:border-[#d6a43a] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d6a43a] to-[#b8891e] text-black shadow-md shadow-[#d6a43a]/20 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
