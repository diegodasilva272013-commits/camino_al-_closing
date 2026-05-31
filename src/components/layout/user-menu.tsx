'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { LogOut, ChevronDown, User } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';

type Props = {
  initials: string;
  email: string;
  fullName: string | null;
};

export function UserMenu({ initials, email, fullName }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        btnRef.current?.contains(t) ||
        menuRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    // Defer registration to avoid catching the opening click
    const id = window.setTimeout(() => {
      document.addEventListener('click', onDocClick);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', onDocClick);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex h-11 items-center gap-2 rounded-full border border-[rgba(212,175,55,0.35)] bg-[#181818] py-1 pl-1 pr-2.5 text-sm text-brand-gold transition hover:border-[rgba(212,175,55,0.6)] active:bg-[#1a1a1a]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d0d0d] text-xs font-medium">
          {initials}
        </span>
        <ChevronDown className="h-4 w-4 text-brand-muted" />
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[1500] w-[min(15rem,calc(100vw-1.5rem))] overflow-hidden rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] shadow-xl"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="border-b border-[rgba(212,175,55,0.12)] px-3 py-3">
            <p className="truncate text-sm font-medium text-brand-text">
              {fullName ?? 'Sin nombre'}
            </p>
            <p className="truncate text-xs text-brand-muted">{email}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 border-b border-[rgba(212,175,55,0.12)] px-3 py-3 text-left text-sm text-brand-text transition hover:bg-[rgba(212,175,55,0.08)] hover:text-brand-gold"
          >
            <User className="h-4 w-4" />
            Mi perfil
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-brand-text transition hover:bg-[rgba(212,175,55,0.08)] hover:text-brand-gold"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
