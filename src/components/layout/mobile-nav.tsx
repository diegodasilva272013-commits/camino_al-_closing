'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PRIVATE_NAV, ADMIN_NAV } from './nav-items';

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const items = isAdmin ? [...PRIVATE_NAV, ...ADMIN_NAV] : PRIVATE_NAV;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Cerrar al cambiar de ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[rgba(212,175,55,0.25)] text-brand-text active:bg-[#1a1a1a]"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[2000] flex"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <div
            className="relative flex h-full w-[82vw] max-w-[320px] flex-col border-r border-[rgba(212,175,55,0.2)] p-4 shadow-2xl"
            style={{ backgroundColor: '#0a0a0a' }}
          >
            <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.12)] pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <BrandLogo size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{brand.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-brand-gold">
                    {brand.tagline}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-brand-muted hover:text-brand-text"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition',
                      active
                        ? 'bg-[#1a1a1a] text-brand-gold border border-[rgba(212,175,55,0.25)]'
                        : 'text-brand-muted hover:bg-[#141414] hover:text-brand-text border border-transparent'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
