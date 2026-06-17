'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PRIVATE_NAV, ADMIN_NAV, isNavGroup, type NavItem } from './nav-items';

function NavLink({
  item,
  pathname,
  onClose,
  badge,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
  badge?: number;
}) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== '/' && pathname?.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition',
        active
          ? 'bg-[#1a1a1a] text-brand-gold border border-[rgba(212,175,55,0.25)]'
          : 'text-brand-muted hover:bg-[#141414] hover:text-brand-text border border-transparent'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function MobileNav({ isAdmin = false, role = 'student', newSignupsToday = 0 }: { isAdmin?: boolean; role?: string; newSignupsToday?: number }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const base = isAdmin ? [...PRIVATE_NAV, ...ADMIN_NAV] : PRIVATE_NAV;
  // El admin ve todo el menú sin restricciones, sin importar el rol de los grupos.
  const entries = isAdmin
    ? base
    : base.filter((entry) =>
        isNavGroup(entry) && entry.roles ? entry.roles.includes(role) : true
      );

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
              {entries.map((entry) => {
                if (isNavGroup(entry)) {
                  return (
                    <div key={entry.groupLabel} className="mt-3 pt-3 border-t border-[rgba(212,175,55,0.08)]">
                      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold/60">
                        {entry.groupLabel}
                      </p>
                      {entry.items.map((item) => (
                        <NavLink
                          key={item.href}
                          item={item}
                          pathname={pathname}
                          onClose={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <NavLink
                    key={entry.href}
                    item={entry}
                    pathname={pathname}
                    onClose={() => setOpen(false)}
                    badge={entry.href === '/admin' ? newSignupsToday : undefined}
                  />
                );
              })}
            </nav>

            <p className="mt-2 border-t border-[rgba(212,175,55,0.08)] pt-2 text-[10px] text-red-400">
              DEBUG role={role} isAdmin={String(isAdmin)}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
