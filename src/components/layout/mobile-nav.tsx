'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PLATFORM_NAV, SETTER_NAV, ADMIN_NAV, CLOSER_NAV, type NavItem } from './nav-items';

function NavLink({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== '/' && pathname?.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition border',
        active
          ? 'bg-[#1a1a1a] text-brand-gold border-[rgba(212,175,55,0.25)]'
          : 'text-brand-muted hover:bg-[#141414] hover:text-brand-text border-transparent'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function Section({ label, items, pathname, onClose }: { label?: string; items: NavItem[]; pathname: string; onClose: () => void }) {
  return (
    <div className="mt-3 pt-3 border-t border-[rgba(212,175,55,0.08)] first:mt-0 first:pt-0 first:border-t-0">
      {label && (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold/60">{label}</p>
      )}
      {items.map(item => <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />)}
    </div>
  );
}

export function MobileNav({
  isAdmin = false,
  role = 'student',
}: {
  isAdmin?: boolean;
  role?: string;
  newSignupsToday?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isSetter = role === 'setter' || isAdmin;
  const isCloser = role === 'closer';

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

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
        <div className="fixed inset-0 z-[2000] flex" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <div
            className="relative flex h-full w-[82vw] max-w-[300px] flex-col border-r border-[rgba(212,175,55,0.2)] p-4 shadow-2xl"
            style={{ backgroundColor: '#0a0a0a' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.12)] pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <BrandLogo size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-text">{brand.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-brand-gold">{brand.tagline}</p>
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

            {/* Nav */}
            <nav className="mt-4 flex-1 space-y-0 overflow-y-auto pr-1">
              {isAdmin ? (
                <>
                  <Section items={PLATFORM_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                  <Section label="Setter CAC" items={SETTER_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                  <Section label="Admin" items={ADMIN_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                </>
              ) : isSetter ? (
                <>
                  <Section items={PLATFORM_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                  <Section label="Setter CAC" items={SETTER_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                </>
              ) : isCloser ? (
                <>
                  <Section items={PLATFORM_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                  <Section label="Closer CAC" items={CLOSER_NAV} pathname={pathname} onClose={() => setOpen(false)} />
                </>
              ) : (
                <Section items={PLATFORM_NAV} pathname={pathname} onClose={() => setOpen(false)} />
              )}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
