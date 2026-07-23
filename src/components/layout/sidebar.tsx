'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PLATFORM_NAV, SETTER_NAV, ADMIN_NAV, CLOSER_NAV, type NavItem } from './nav-items';

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== '/' && item.href !== '/admin' && pathname?.startsWith(item.href + '/'));
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
        active
          ? 'bg-[#1a1a1a] text-brand-gold border border-[rgba(212,175,55,0.25)]'
          : 'text-brand-muted hover:bg-[#141414] hover:text-brand-text border border-transparent'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function Section({ label, items, pathname }: { label?: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="mt-3 pt-3 border-t border-[rgba(212,175,55,0.08)] first:mt-0 first:pt-0 first:border-t-0">
      {label && (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold/60">
          {label}
        </p>
      )}
      {items.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
    </div>
  );
}

export function Sidebar({
  isAdmin = false,
  role = 'student',
}: {
  isAdmin?: boolean;
  role?: string;
  newSignupsToday?: number;
}) {
  const pathname = usePathname();
  const isSetter = role === 'setter' || isAdmin;
  const isCloser = role === 'closer';

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-[rgba(212,175,55,0.12)] lg:bg-[#0a0a0a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-[rgba(212,175,55,0.12)] px-5">
        <BrandLogo size="md" />
        <div className="flex flex-col leading-tight min-w-0">
          <span className="truncate text-sm font-semibold text-brand-text">{brand.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-brand-gold">{brand.tagline}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0 overflow-y-auto px-3 py-4">
        {isAdmin ? (
          /* ── ADMIN: plataforma + setter + closer + herramientas de admin ─ */
          <>
            <Section items={PLATFORM_NAV} pathname={pathname} />
            <Section label="Setter CAC" items={SETTER_NAV} pathname={pathname} />
            <Section label="Closer CAC" items={CLOSER_NAV} pathname={pathname} />
            <Section label="Admin" items={ADMIN_NAV} pathname={pathname} />
          </>
        ) : isSetter ? (
          /* ── SETTER: plataforma + herramientas setter (sin admin) ──────── */
          <>
            <Section items={PLATFORM_NAV} pathname={pathname} />
            <Section label="Setter CAC" items={SETTER_NAV} pathname={pathname} />
          </>
        ) : isCloser ? (
          /* ── CLOSER: plataforma + agenda ────────────────────────────────── */
          <>
            <Section items={PLATFORM_NAV} pathname={pathname} />
            <Section label="Closer CAC" items={CLOSER_NAV} pathname={pathname} />
          </>
        ) : (
          /* ── ESTUDIANTE: solo plataforma ────────────────────────────────── */
          <Section items={PLATFORM_NAV} pathname={pathname} />
        )}
      </nav>

      <div className="border-t border-[rgba(212,175,55,0.12)] px-5 py-4">
        <p className="text-[10px] uppercase tracking-widest text-brand-muted">Sala de entrenamiento</p>
        <p className="mt-0.5 text-xs text-brand-muted/60">Foco. Disciplina. Cierre.</p>
      </div>
    </aside>
  );
}
