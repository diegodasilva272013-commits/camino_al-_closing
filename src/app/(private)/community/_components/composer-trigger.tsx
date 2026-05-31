'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PostComposer } from './post-composer';

export function ComposerTrigger({
  userName,
  avatarUrl,
}: {
  userName: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="card-premium">
        <PostComposer userName={userName} />
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-brand-muted hover:text-brand-text"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const initial = (userName || '?').trim().slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-3 rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-3 text-left transition hover:border-brand-gold sm:px-4"
    >
      {avatarUrl ? (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[rgba(212,175,55,0.35)]">
          <Image src={avatarUrl} alt={userName} fill className="object-cover" />
        </div>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.35)] bg-[#111] text-sm font-semibold text-brand-gold">
          {initial}
        </div>
      )}
      <span className="truncate text-sm text-brand-muted">Escribe algo…</span>
    </button>
  );
}
