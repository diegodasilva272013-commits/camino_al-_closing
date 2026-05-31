'use client';

import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/Cinematic_logo_reveal_animation_202605311327.mp4';
const SESSION_KEY = 'cac:splashShown';
const MAX_MS = 5000;

export function SplashVideo() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore
    }
    setShow(true);

    const timeout = window.setTimeout(() => dismiss(), MAX_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setFading(true);
    window.setTimeout(() => setShow(false), 400);
  }

  if (!show) return null;

  return (
    <div
      className={
        'fixed inset-0 z-[3000] flex items-center justify-center bg-black transition-opacity duration-500 ' +
        (fading ? 'opacity-0' : 'opacity-100')
      }
      aria-hidden="true"
    >
      {/* Contenedor con overflow hidden para cropear marca de agua */}
      <div className="relative h-full w-full overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={dismiss}
          onError={dismiss}
          className="absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 object-cover"
        />
      </div>
    </div>
  );
}
