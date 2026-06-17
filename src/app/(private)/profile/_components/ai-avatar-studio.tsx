'use client';

import { useRef, useState, useTransition, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Upload,
  Wand2,
  Lock,
  Zap,
  X,
} from 'lucide-react';
import { generateAiAvatarAction } from '../actions';

type LayerStatus = 'applied' | 'available' | 'locked_level' | 'no_credits';

type AvatarLayer = {
  id: number;
  name: string;
  description: string;
  required_level: number;
  credit_cost: number;
  sort_order: number;
  status: LayerStatus;
  can_apply: boolean;
  unlocked_at?: string;
  points_to_unlock?: number;
};

function LayerCard({
  layer,
  onApply,
  applying,
}: {
  layer: AvatarLayer;
  onApply: (layer: AvatarLayer) => void;
  applying: boolean;
}) {
  const isApplied  = layer.status === 'applied';
  const isLocked   = layer.status === 'locked_level';
  const noCredits  = layer.status === 'no_credits';

  return (
    <div className={
      'rounded-xl border p-4 transition ' +
      (isApplied
        ? 'border-emerald-700/50 bg-emerald-950/20'
        : isLocked
          ? 'border-zinc-800 bg-[#0a0a0a] opacity-70'
          : 'border-[rgba(212,175,55,0.18)] bg-[#0d0d0d]')
    }>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isApplied  && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
          {isLocked   && <Lock  className="h-4 w-4 shrink-0 text-zinc-500" />}
          {!isApplied && !isLocked && <Zap className="h-4 w-4 shrink-0 text-brand-gold" />}
          <span className="text-sm font-semibold text-brand-text">{layer.name}</span>
        </div>
        <span className="shrink-0 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-0.5 text-[10px] font-medium text-brand-gold">
          {layer.credit_cost} crédito{layer.credit_cost > 1 ? 's' : ''}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-brand-muted">{layer.description}</p>

      {isLocked && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Requiere Nivel {layer.required_level}
          {layer.points_to_unlock != null && ` · te faltan ${layer.points_to_unlock} pts`}
        </p>
      )}

      <button
        type="button"
        disabled={!layer.can_apply || applying}
        onClick={() => onApply(layer)}
        className={
          'mt-3 w-full rounded-lg py-1.5 text-xs font-semibold transition ' +
          (isApplied
            ? 'cursor-default border border-emerald-700/40 text-emerald-400'
            : isLocked
              ? 'cursor-not-allowed border border-zinc-800 text-zinc-600'
              : noCredits
                ? 'cursor-not-allowed border border-zinc-800 text-zinc-600'
                : 'border border-brand-gold/40 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20')
        }
      >
        {isApplied  ? '✓ Ya aplicado'
         : isLocked  ? `Requiere Nivel ${layer.required_level}`
         : noCredits ? 'Sin créditos'
         : applying  ? 'Aplicando…'
         : `Aplicar · ${layer.credit_cost} crédito${layer.credit_cost > 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

function ConfirmModal({
  layer,
  currentCredits,
  onConfirm,
  onCancel,
  applying,
}: {
  layer: AvatarLayer;
  currentCredits: number;
  onConfirm: () => void;
  onCancel: () => void;
  applying: boolean;
}) {
  const after = currentCredits - layer.credit_cost;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#0d0d0d] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-brand-text">Aplicar evolución</h3>
          <button onClick={onCancel} className="text-brand-muted hover:text-brand-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="text-brand-text font-medium">{layer.name}</p>
          <p className="text-xs text-brand-muted">{layer.description}</p>
          <div className="mt-3 space-y-1 border-t border-[rgba(212,175,55,0.08)] pt-3 text-xs">
            <div className="flex justify-between">
              <span className="text-brand-muted">Costo:</span>
              <span className="text-brand-gold">{layer.credit_cost} crédito{layer.credit_cost > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Créditos actuales:</span>
              <span className="text-brand-text">{currentCredits}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-brand-muted">Créditos restantes:</span>
              <span className={after < 0 ? 'text-red-400' : 'text-brand-text'}>{after}</span>
            </div>
          </div>
        </div>
        {after < 0 && (
          <p className="mt-3 rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            No tenés créditos suficientes.
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={after < 0 || applying}
            className="flex-1 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-40"
          >
            {applying ? 'Aplicando…' : 'Confirmar'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-brand-muted hover:text-brand-text transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // Layer evolution state
  const [creditBalance, setCreditBalance] = useState<number>(credits);
  const [layers, setLayers] = useState<AvatarLayer[]>([]);
  const [layersLoading, setLayersLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AvatarLayer | null>(null);
  const [applyPending, setApplyPending] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchLayers = useCallback(async () => {
    setLayersLoading(true);
    try {
      const res = await fetch('/api/avatar/layers');
      const data = await res.json();
      if (data.layers) {
        setLayers(data.layers);
        setCreditBalance(data.credits);
      }
    } finally {
      setLayersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  async function handleApplyLayer() {
    if (!confirmTarget) return;
    setApplyPending(true);
    setApplyMsg(null);
    try {
      const res = await fetch('/api/avatar/layers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer_id: confirmTarget.id, style }),
      });
      const data = await res.json();
      if (data.success) {
        setCreditBalance(data.new_balance);
        setApplyMsg({ ok: true, text: `✓ "${confirmTarget.name}" aplicado exitosamente.` });
        await fetchLayers();
      } else {
        const errMap: Record<string, string> = {
          INSUFFICIENT_CREDITS: 'No tenés créditos suficientes.',
          LEVEL_TOO_LOW: `Necesitás Nivel ${confirmTarget.required_level}.`,
          LAYER_ALREADY_APPLIED: 'Esta capa ya estaba aplicada.',
          LAYER_NOT_FOUND: 'Capa no encontrada.',
          CREDIT_ERROR: 'Error al consumir crédito. Intentá de nuevo.',
        };
        setApplyMsg({ ok: false, text: errMap[data.error] ?? data.error ?? 'Error desconocido.' });
      }
    } catch {
      setApplyMsg({ ok: false, text: 'Error de red. Revisá tu conexión.' });
    } finally {
      setApplyPending(false);
      setConfirmTarget(null);
    }
  }

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

  const noCredits = creditBalance <= 0;

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
          {creditBalance} crédito{creditBalance === 1 ? '' : 's'}
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

      {/* ── Evolucionar mi Avatar ── */}
      {result && (
        <div className="mt-6 border-t border-[rgba(212,175,55,0.12)] pt-6">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-brand-text">
                <Zap className="h-4 w-4 text-brand-gold" />
                Evolucionar mi Avatar
              </h4>
              <p className="mt-0.5 text-[11px] text-brand-muted">
                Aplicá créditos para mejorar tu avatar permanentemente
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-brand-gold/40 bg-[#1a1408] px-3 py-1 text-[11px] font-semibold text-brand-gold">
              {creditBalance} crédito{creditBalance === 1 ? '' : 's'}
            </span>
          </div>

          {layersLoading ? (
            <div className="mt-4 flex items-center justify-center gap-2 py-6 text-xs text-brand-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando capas…
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {layers.map((layer) => (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  onApply={setConfirmTarget}
                  applying={applyPending && confirmTarget?.id === layer.id}
                />
              ))}
            </div>
          )}

          {applyMsg && (
            <p className={`mt-3 flex items-center gap-1.5 text-xs ${applyMsg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
              {applyMsg.ok
                ? <Check className="h-3.5 w-3.5" />
                : <AlertCircle className="h-3.5 w-3.5" />}
              {applyMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirmTarget && (
        <ConfirmModal
          layer={confirmTarget}
          currentCredits={creditBalance}
          onConfirm={handleApplyLayer}
          onCancel={() => setConfirmTarget(null)}
          applying={applyPending}
        />
      )}
    </section>
  );
}
