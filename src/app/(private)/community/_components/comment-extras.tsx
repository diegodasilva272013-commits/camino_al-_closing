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
