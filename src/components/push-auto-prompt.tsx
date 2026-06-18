'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const DISMISSED_KEY = 'push_prompt_dismissed_v1';

export function PushAutoPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // No mostrar si el browser no soporta push
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    // No mostrar si ya dio permiso (cualquier dirección)
    if (Notification.permission !== 'default') return;
    // No mostrar si ya lo cerró antes
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Mostrar el banner después de 3 segundos (usuario ya está usando la app)
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  async function activate() {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setShow(false);
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const keyRes = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error('Sin VAPID');

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      setDone(true);
      setTimeout(() => setShow(false), 2500);
    } catch {
      setShow(false);
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300 sm:bottom-6">
      <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-[#1a1200] px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yellow-500/15 ring-1 ring-yellow-500/30">
          <Bell className="h-4 w-4 text-yellow-400" />
        </div>
        {done ? (
          <p className="flex-1 text-sm font-medium text-green-300">✓ Notificaciones activadas</p>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Activar notificaciones</p>
              <p className="text-[11px] text-zinc-400">Recibí mensajes y alertas aunque la app esté cerrada</p>
            </div>
            <button
              onClick={activate}
              disabled={loading}
              className="shrink-0 rounded-xl bg-yellow-500 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
            >
              {loading ? '...' : 'Activar'}
            </button>
            <button onClick={dismiss} className="shrink-0 text-zinc-500 hover:text-zinc-300">
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
