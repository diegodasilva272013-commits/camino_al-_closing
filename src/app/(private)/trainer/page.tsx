'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, ChevronLeft } from 'lucide-react';

type Mode = 'fria' | 'tibia' | 'caliente';
type Msg = { role: 'user' | 'assistant'; content: string };

const MODES = [
  {
    id: 'fria' as Mode,
    emoji: '🧊',
    label: 'PROSPECCIÓN FRÍA',
    desc: 'El prospecto no te conoce. Nunca tuvo contacto con CAC. Actitud escéptica o indiferente desde el primer mensaje.',
    color: 'sky',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/5',
    activeBg: 'bg-sky-500/10',
    badge: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
    btn: 'bg-sky-500 hover:bg-sky-400',
  },
  {
    id: 'tibia' as Mode,
    emoji: '🌡️',
    label: 'PROSPECCIÓN TIBIA',
    desc: 'Vio algo de CAC en redes o lo referenciaron. Tiene curiosidad pero también dudas. No está convencido todavía.',
    color: 'amber',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    activeBg: 'bg-amber-500/10',
    badge: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    btn: 'bg-amber-500 hover:bg-amber-400',
  },
  {
    id: 'caliente' as Mode,
    emoji: '🔥',
    label: 'PROSPECCIÓN CALIENTE',
    desc: 'Ya mostró interés activo. Está cerca de cerrar pero tiene objeciones finales o necesita el último empujón.',
    color: 'red',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    activeBg: 'bg-red-500/10',
    badge: 'text-red-400 bg-red-400/10 border-red-400/30',
    btn: 'bg-red-500 hover:bg-red-400',
  },
];

function randomId() {
  return Math.random().toString(36).slice(2);
}

export default function TrainerPage() {
  const [view, setView] = useState<'modes' | 'chat'>('modes');
  const [mode, setMode] = useState<Mode | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => randomId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const modeData = MODES.find(m => m.id === mode);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function startMode(m: Mode) {
    setMode(m);
    setMessages([]);
    setView('chat');
    setLoading(true);

    await fetch('/api/trainer/chat', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    const res = await fetch('/api/trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: 'INICIO SIMULACIÓN', mode: m }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.response) {
      setMessages([{ role: 'assistant', content: data.response }]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !mode) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    const res = await fetch('/api/trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: text, mode }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.response) {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Selector de modos ──────────────────────────────────────────────
  if (view === 'modes') {
    return (
      <div className="mx-auto max-w-3xl px-2 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-brand-gold">CAC TRAINER</h1>
          <p className="text-brand-muted">Elegí el tipo de prospección para practicar</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => startMode(m.id)}
              className={`group flex flex-col items-center gap-4 rounded-2xl border p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.99] ${m.border} ${m.bg} hover:${m.activeBg}`}
            >
              <span className="text-5xl">{m.emoji}</span>
              <div className="space-y-1 text-center">
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wider ${m.badge}`}>
                  {m.label}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-brand-muted">{m.desc}</p>
              </div>
              <span className={`mt-auto w-full rounded-lg py-2 text-center text-sm font-semibold text-white transition ${m.btn}`}>
                Practicar
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-4 text-xs text-brand-muted space-y-1">
          <p><span className="text-brand-gold font-semibold">evaluame</span> → pedile feedback al prospecto sobre cómo venís</p>
          <p><span className="text-brand-gold font-semibold">EVOLUCIÓN</span> → pedile un escenario más desafiante</p>
        </div>
      </div>
    );
  }

  // ── Chat ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className={`flex items-center gap-3 border-b border-[rgba(212,175,55,0.12)] px-4 py-3 ${modeData?.bg ?? ''}`}>
        <button
          onClick={() => setView('modes')}
          className="rounded-md p-1.5 text-brand-muted hover:bg-[#1a1a1a] hover:text-brand-text"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xl">{modeData?.emoji}</span>
        <div>
          <span className={`text-xs font-bold tracking-wider ${modeData?.badge?.split(' ')[0] ?? 'text-brand-gold'}`}>
            {modeData?.label}
          </span>
          <p className="text-[11px] text-brand-muted">CAC TRAINER · Simulación activa</p>
        </div>
        <button
          onClick={() => mode && startMode(mode)}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs text-brand-muted hover:border-brand-gold/40 hover:text-brand-text"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reiniciar
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#080808' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'rounded-br-sm bg-brand-gold text-black'
                  : 'rounded-bl-sm bg-[#1a1a1a] text-brand-text border border-[rgba(212,175,55,0.08)]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-[#1a1a1a] border border-[rgba(212,175,55,0.08)] px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-brand-muted"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Escribí tu mensaje..."
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#111] px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold text-black transition hover:bg-brand-gold/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-brand-muted">
          <span className="text-brand-gold">evaluame</span> · feedback instantáneo &nbsp;|&nbsp; <span className="text-brand-gold">EVOLUCIÓN</span> · subir dificultad
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
