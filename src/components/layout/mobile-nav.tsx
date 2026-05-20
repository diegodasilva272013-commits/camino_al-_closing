'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PRIVATE_NAV, ADMIN_NAV } from './nav-items';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = [...PRIVATE_NAV, ...ADMIN_NAV];

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[rgba(212,175,55,0.18)] p-2 text-brand-text"
        aria-label="Abrir menú"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-72 flex-col border-r border-[rgba(212,175,55,0.15)] bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.12)] pb-3">
              <div className="flex items-center gap-2">
                <BrandLogo size="sm" />
                <div>
                  <p className="text-sm font-semibold">{brand.name}</p>
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

            <nav className="mt-4 space-y-1">
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
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
                      active
                        ? 'bg-[#1a1a1a] text-brand-gold border border-[rgba(212,175,55,0.25)]'
                        : 'text-brand-muted hover:bg-[#141414] hover:text-brand-text border border-transparent'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
