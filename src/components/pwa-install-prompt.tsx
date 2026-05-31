'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'cac:pwa-install-dismissed';
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function dismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number(v);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PWAInstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS no dispara beforeinstallprompt, mostramos instrucciones después de un delay
    if (isIos()) {
      const t = setTimeout(() => setShowIos(true), 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
    setShowIos(false);
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') {
      setShow(false);
    } else {
      dismiss();
    }
  }

  if (!show && !showIos) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:pb-5">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-brand-gold/40 bg-[#0e0e0e]/95 p-4 shadow-[0_20px_60px_-20px_rgba(212,175,55,0.45)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt="Camino al Closing"
            className="h-12 w-12 shrink-0 rounded-xl border border-brand-gold/30"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-text">
              Instalá Camino al Closing
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-brand-muted">
              Acceso 1 toque · notificaciones push · funciona offline.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-brand-muted hover:bg-white/5 hover:text-brand-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {show && evt && (
          <button
            type="button"
            onClick={install}
            className="btn-gold mt-3 w-full justify-center"
          >
            <Download className="h-4 w-4" />
            Instalar app
          </button>
        )}

        {showIos && !evt && (
          <div className="mt-3 rounded-xl border border-brand-gold/20 bg-black/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gold">
              En iPhone / iPad
            </p>
            <ol className="mt-2 space-y-1.5 text-[12px] text-brand-text">
              <li className="flex items-center gap-2">
                <span className="rounded-full border border-brand-gold/40 px-1.5 text-[10px] font-bold text-brand-gold">
                  1
                </span>
                Tocá <Share className="inline h-3.5 w-3.5 text-brand-gold" />{' '}
                <span className="text-brand-muted">(Compartir)</span> abajo
              </li>
              <li className="flex items-center gap-2">
                <span className="rounded-full border border-brand-gold/40 px-1.5 text-[10px] font-bold text-brand-gold">
                  2
                </span>
                Elegí <Plus className="inline h-3.5 w-3.5 text-brand-gold" />{' '}
                <span className="text-brand-text">Agregar a pantalla de inicio</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="rounded-full border border-brand-gold/40 px-1.5 text-[10px] font-bold text-brand-gold">
                  3
                </span>
                <span className="text-brand-muted">Listo, abrila desde el ícono</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
