'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Upload,
  Wand2,
} from 'lucide-react';
import { generateAiAvatarAction } from '../actions';

type Style = 'pixar' | 'cartoon' | 'marvel';

const STYLES: Array<{
  id: Style;
  label: string;
  emoji: string;
  description: string;
}> = [
  {
    id: 'pixar',
    label: 'Pixar 3D',
    emoji: '🎬',
    description: 'Estilo película animada, expresivo y cinematográfico.',
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    emoji: '🎨',
    description: 'Dibujo Disney clásico, colores vibrantes y limpios.',
  },
  {
    id: 'marvel',
    label: 'Marvel Comic',
    emoji: '💥',
    description: 'Cómic de héroe, tinta intensa y luces dramáticas.',
  },
];

export function AiAvatarStudio({
  credits,
  currentLevel,
  currentStyle,
  currentAiAvatar,
}: {
  credits: number;
  currentLevel: number;
  currentStyle: Style | null;
  currentAiAvatar: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>(currentStyle ?? 'pixar');
  const [result, setResult] = useState<string | null>(currentAiAvatar);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function pickPhoto() {
    inputRef.current?.click();
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      setPhoto(f);
      setPhotoPreview(url);
      setMsg(null);
    } catch (err: any) {
      setMsg({ ok: false, text: 'No se pudo leer la imagen: ' + (err?.message ?? 'error') });
    }
  }

  function onGenerate() {
    if (!photo) {
      setMsg({ ok: false, text: 'Subí una foto primero.' });
      return;
    }
    if (credits <= 0) {
      setMsg({
        ok: false,
        text: 'Sin créditos. Subí de nivel para ganar uno gratis.',
      });
      return;
    }
    const fd = new FormData();
    fd.set('style', style);
    fd.set('photo', photo);
    setMsg(null);
    startTransition(async () => {
      const res = await generateAiAvatarAction({}, fd);
      if (res.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({ ok: true, text: res.message ?? '¡Listo!' });
        if (res.avatarUrl) setResult(res.avatarUrl);
      }
    });
  }

  const noCredits = credits <= 0;

  return (
    <section className="card-premium border-2 border-brand-gold">
      <div className="mb-3 rounded-lg bg-brand-gold/20 px-3 py-2 text-center text-sm font-bold text-brand-gold">
        ✨ NUEVO · Studio de Avatar IA ✨
      </div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-brand-text">
            <Sparkles className="h-4 w-4 text-brand-gold" />
            Avatar IA
          </h3>
          <p className="mt-1 text-xs text-brand-muted">
            Convertí tu foto en un avatar estilizado que evoluciona con tu nivel.
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-brand-gold/40 bg-[#1a1408] px-3 py-1 text-[11px] font-semibold text-brand-gold">
          {credits} crédito{credits === 1 ? '' : 's'}
        </div>
      </div>

      {/* Selector de estilo */}
      <div className="grid gap-2 sm:grid-cols-3">
        {STYLES.map((s) => {
          const active = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={
                'rounded-xl border p-3 text-left transition ' +
                (active
                  ? 'border-brand-gold bg-gradient-to-br from-brand-gold/15 to-transparent shadow-[0_8px_24px_-16px_rgba(212,175,55,0.5)]'
                  : 'border-[rgba(212,175,55,0.18)] hover:border-brand-gold/50')
              }
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-text">
                <span className="text-lg leading-none">{s.emoji}</span>
                {s.label}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-brand-muted">
                {s.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Foto + Resultado */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Tu foto */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
            1. Tu foto
          </p>
          <button
            type="button"
            onClick={pickPhoto}
            disabled={isPending}
            className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-[rgba(212,175,55,0.35)] bg-[#0a0a0a] transition hover:border-brand-gold disabled:opacity-50"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Tu foto"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-brand-muted">
                <Upload className="h-6 w-6" />
                <span className="text-xs">Tocá para subir</span>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onPhotoChange}
          />
        </div>

        {/* Resultado */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
            2. Tu avatar
          </p>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-brand-gold/30 bg-[#0a0a0a]">
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result}
                alt="Avatar IA"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-center text-xs text-brand-muted">
                Vacío — generá tu primero
              </div>
            )}
            {isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-xs text-brand-gold">
                <Loader2 className="h-6 w-6 animate-spin" />
                Generando… (10–20s)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Botón generar */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={isPending || !photo || noCredits}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-gradient px-4 py-3 text-sm font-semibold text-[#0a0a0a] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Wand2 className="h-4 w-4" />
        {isPending
          ? 'Generando…'
          : noCredits
            ? 'Sin créditos — subí de nivel'
            : `Generar avatar (consume 1 crédito)`}
      </button>

      {msg && (
        <p
          className={`mt-3 inline-flex items-center gap-1.5 text-xs ${
            msg.ok ? 'text-emerald-300' : 'text-red-300'
          }`}
        >
          {msg.ok ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {msg.text}
        </p>
      )}

      <p className="mt-3 text-[11px] text-brand-muted">
        Nivel actual: <span className="text-brand-gold">{currentLevel}</span> · Cada
        vez que subas de nivel recibís 1 crédito gratis para que tu avatar
        evolucione (más detalles, ropa premium, fondos épicos).
      </p>
    </section>
  );
}
