'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';

type Props = {
  initials: string;
  email: string;
  fullName: string | null;
};

export function UserMenu({ initials, email, fullName }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.35)] bg-[#181818] py-1 pl-1 pr-2 text-sm text-brand-gold transition hover:border-[rgba(212,175,55,0.6)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0d0d0d] text-xs font-medium">
          {initials}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] shadow-xl"
        >
          <div className="border-b border-[rgba(212,175,55,0.12)] px-3 py-3">
            <p className="truncate text-sm font-medium text-brand-text">
              {fullName ?? 'Sin nombre'}
            </p>
            <p className="truncate text-xs text-brand-muted">{email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-text transition hover:bg-[rgba(212,175,55,0.08)] hover:text-brand-gold"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
