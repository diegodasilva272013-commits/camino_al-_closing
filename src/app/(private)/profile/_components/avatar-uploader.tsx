'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Camera, Loader2, Check, AlertCircle } from 'lucide-react';
import { uploadAvatarAction } from '../actions';

export function AvatarUploader({
  currentUrl,
  fallbackInitial,
}: {
  currentUrl: string | null;
  fallbackInitial: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // preview optimista
    const localUrl = URL.createObjectURL(f);
    setPreview(localUrl);
    setMsg(null);

    const fd = new FormData();
    fd.set('avatar', f);
    startTransition(async () => {
      const res = await uploadAvatarAction({}, fd);
      if (res.error) {
        setMsg({ ok: false, text: res.error });
        setPreview(currentUrl);
      } else {
        setMsg({ ok: true, text: res.message ?? '¡Foto actualizada!' });
      }
      URL.revokeObjectURL(localUrl);
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-brand-gold/60 bg-[#181818] shadow-[0_0_30px_-10px_rgba(212,175,55,0.6)]">
          {preview ? (
            <Image
              src={preview}
              alt="Avatar"
              fill
              className="object-cover"
              unoptimized={preview.startsWith('blob:')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-brand-gold">
              {fallbackInitial}
            </div>
          )}
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={pick}
          disabled={isPending}
          className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-gradient text-[#0a0a0a] shadow-lg transition hover:brightness-110 disabled:opacity-50"
          title="Cambiar foto"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onChange}
        />
      </div>

      {msg && (
        <p
          className={`inline-flex items-center gap-1 text-xs ${
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
      <p className="text-center text-[11px] text-brand-muted">
        JPG, PNG, WEBP o GIF · máx 5 MB
      </p>
    </div>
  );
}
