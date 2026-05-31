'use client';

import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/Cinematic_logo_reveal_animation_202605311327.mp4';
const FALLBACK_IMG = '/Logo2.png';
const HARD_TIMEOUT_MS = 8000;

export function SplashVideo() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const dismissedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const hard = window.setTimeout(() => dismiss(), HARD_TIMEOUT_MS);
    return () => window.clearTimeout(hard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    window.setTimeout(() => setShow(false), 450);
  }

  if (!show) return null;

  return (
    <div
      className={
        'fixed inset-0 z-[3000] flex items-center justify-center bg-black transition-opacity duration-500 ' +
        (fading ? 'opacity-0' : 'opacity-100')
      }
      aria-hidden="true"
      onClick={dismiss}
    >
      {/* Logo de fondo (visible mientras el video bufferea) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FALLBACK_IMG}
        alt=""
        className="pointer-events-none absolute h-40 w-40 object-contain opacity-90"
      />

      {!videoFailed && (
        <div className="relative h-full w-full overflow-hidden">
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            controls={false}
            onEnded={dismiss}
            onError={() => setVideoFailed(true)}
            onCanPlay={() => {
              videoRef.current?.play().catch(() => setVideoFailed(true));
            }}
            className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 object-cover"
          />
        </div>
      )}
    </div>
  );
}
