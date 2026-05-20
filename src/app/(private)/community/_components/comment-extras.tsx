'use client';

import { useEffect, useRef, useState } from 'react';

const EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🤔',
  '😏','😴','😭','😤','😡','🥺','🤯','😱','🤗','🤝',
  '👍','👎','👏','🙌','🙏','💪','🤞','✌️','👌','👀',
  '🔥','💯','⚡','✨','🎉','🎯','🚀','📈','💰','💼',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💖',
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 z-30 w-64 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#0c0c0c] p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
    >
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              onPick(e);
              onClose();
            }}
            className="rounded-md p-1 text-lg leading-none transition hover:bg-[#1a1408]"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

type RecState = 'idle' | 'recording' | 'ready';

export function VoiceRecorder({
  onChange,
}: {
  onChange: (file: File | null) => void;
}) {
  const [state, setState] = useState<RecState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (recRef.current && recRef.current.state !== 'inactive') {
        recRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const file = new File(
          [blob],
          `voice-${Date.now()}.${type.includes('mp4') ? 'm4a' : 'webm'}`,
          { type }
        );
        const url = URL.createObjectURL(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(url);
        setState('ready');
        onChange(file);
      };
      rec.start();
      recRef.current = rec;
      setState('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert('No se pudo acceder al micrófono.');
    }
  }

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop();
    }
  }

  function discard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setState('idle');
    setSeconds(0);
    onChange(null);
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={start}
        title="Grabar nota de voz"
        className="rounded-full border border-[rgba(212,175,55,0.18)] p-2 text-brand-muted transition hover:border-brand-gold hover:text-brand-gold"
      >
        <MicIcon />
      </button>
    );
  }

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        {fmt(seconds)} · detener
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.25)] bg-[#0a0a0a] px-2 py-1">
      {audioUrl && (
        <audio src={audioUrl} controls className="h-8 max-w-[180px]" />
      )}
      <button
        type="button"
        onClick={discard}
        className="rounded-full p-1 text-brand-muted hover:text-red-300"
        title="Descartar"
      >
        <XIcon />
      </button>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

type GifItem = { id: string; preview: string; full: string; alt: string };

const GIF_CATEGORIES: { label: string; query: string }[] = [
  { label: 'Trending', query: '' },
  { label: '😂 LOL', query: 'lol' },
  { label: '🔥 Fuego', query: 'fire' },
  { label: '👏 Aplausos', query: 'applause' },
  { label: '💪 Vamos', query: 'lets go' },
  { label: '❤️ Amor', query: 'love' },
  { label: '🤯 Wow', query: 'mind blown' },
  { label: '🎉 Festejo', query: 'celebrate' },
  { label: '👍 Ok', query: 'thumbs up' },
  { label: '😎 Cool', query: 'cool' },
];

export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: { url: string; alt: string }) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<string>('');
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    inputRef.current?.focus();
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const term = q || activeCat;
    const url = `/api/gifs?q=${encodeURIComponent(term)}&limit=30`;
    const t = setTimeout(
      () => {
        fetch(url, { signal: ctrl.signal })
          .then(async (r) => {
            const j = await r.json();
            if (!r.ok) throw new Error(j.error ?? 'Error');
            setItems(j.items ?? []);
          })
          .catch((e) => {
            if (e.name !== 'AbortError') setError(String(e.message ?? e));
          })
          .finally(() => setLoading(false));
      },
      q ? 280 : 0
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, activeCat]);

  function clearSearch() {
    setQ('');
    inputRef.current?.focus();
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 z-30 w-[380px] overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[#0c0c0c]/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl"
    >
      {/* Search header */}
      <div className="border-b border-[rgba(212,175,55,0.12)] bg-gradient-to-b from-[#141008] to-[#0c0c0c] p-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted/70" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value) setActiveCat('');
            }}
            placeholder="Buscar GIFs…"
            className="w-full rounded-full border border-[rgba(212,175,55,0.25)] bg-[#0a0a0a] py-2 pl-9 pr-9 text-xs text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
          />
          {q && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-brand-muted hover:text-brand-gold"
              title="Limpiar"
            >
              <XIcon />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GIF_CATEGORIES.map((c) => {
            const active = !q && activeCat === c.query;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  setQ('');
                  setActiveCat(c.query);
                }}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                    : 'border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] text-brand-muted hover:border-brand-gold/50 hover:text-brand-text'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="max-h-80 overflow-y-auto p-2">
        {error && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-red-300">
              {error.includes('GIPHY_API_KEY')
                ? 'Configura GIPHY_API_KEY en .env.local para activar GIFs.'
                : error}
            </p>
          </div>
        )}

        {!error && loading && items.length === 0 && (
          <div className="columns-2 gap-1.5 [&>*]:mb-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-md bg-[#1a1408]"
                style={{ height: 70 + ((i * 37) % 90) }}
              />
            ))}
          </div>
        )}

        {!error && !loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="text-3xl opacity-60">🔍</span>
            <p className="text-xs text-brand-muted">
              Nada por acá. Probá otra búsqueda.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="columns-2 gap-1.5 [&>*]:mb-1.5">
            {items.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onPick({ url: g.full, alt: g.alt });
                  onClose();
                }}
                className="group relative block w-full overflow-hidden rounded-md border border-transparent transition hover:border-brand-gold hover:shadow-[0_6px_20px_-6px_rgba(212,175,55,0.6)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.preview}
                  alt={g.alt}
                  className="block w-full transition duration-200 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer attribution (Giphy TOS) */}
      <div className="flex items-center justify-between border-t border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-brand-muted/70">
          Powered by
        </span>
        <span className="bg-gradient-to-r from-[#00E5A0] via-[#FF6FB7] to-[#9D4DFF] bg-clip-text text-[11px] font-bold tracking-wide text-transparent">
          GIPHY
        </span>
      </div>
    </div>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
