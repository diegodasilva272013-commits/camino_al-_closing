'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, AlertCircle, Loader2 } from 'lucide-react';

type Status = 'unknown' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushOptIn() {
  const [status, setStatus] = useState<Status>('unknown');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'on' : 'off'))
      .catch(() => setStatus('off'));
  }, []);

  async function activate() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'off');
        setMsg('Necesitamos permiso para enviarte notificaciones.');
        return;
      }

      // Asegurar service worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // VAPID key
      const keyRes = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error('Servidor sin VAPID configurado.');

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Error al guardar la suscripción');
      }
      setStatus('on');
      setMsg('¡Listo! Vas a recibir notificaciones.');
    } catch (err: any) {
      setMsg(err?.message ?? 'Error activando notificaciones');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
      setMsg('Notificaciones desactivadas.');
    } catch (err: any) {
      setMsg(err?.message ?? 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-premium">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-brand-gold/30 bg-[#1a1408] p-2">
            <Bell className="h-4 w-4 text-brand-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-brand-text">
              Notificaciones push
            </h3>
            <p className="mt-1 text-xs text-brand-muted">
              Recibí avisos de likes, comentarios, mensajes nuevos y misiones aunque
              tengas la app cerrada.
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === 'unsupported' && (
        <p className="mt-3 text-xs text-brand-muted">
          Tu navegador no soporta notificaciones push. Probá desde Chrome/Edge en
          desktop, o desde Android. En iPhone, agregá la app a la pantalla de inicio
          primero.
        </p>
      )}

      {status === 'denied' && (
        <p className="mt-3 text-xs text-red-300">
          Bloqueaste las notificaciones. Habilitalas desde la barra del navegador
          (🔒 → Notificaciones → Permitir) y recargá.
        </p>
      )}

      {(status === 'off' || status === 'on') && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'off' ? (
            <button
              type="button"
              onClick={activate}
              disabled={busy}
              className="btn-gold disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              Activar notificaciones
            </button>
          ) : (
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="btn-ghost-gold disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              Desactivar
            </button>
          )}
        </div>
      )}

      {msg && (
        <p
          className={`mt-3 inline-flex items-center gap-1.5 text-xs ${
            status === 'on' ? 'text-emerald-300' : 'text-brand-muted'
          }`}
        >
          {status === 'on' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {msg}
        </p>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'on') {
    return (
      <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
        Activas
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-300">
        Bloqueadas
      </span>
    );
  }
  if (status === 'unsupported') {
    return (
      <span className="shrink-0 rounded-full border border-zinc-600 bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400">
        No disponible
      </span>
    );
  }
  return null;
}
