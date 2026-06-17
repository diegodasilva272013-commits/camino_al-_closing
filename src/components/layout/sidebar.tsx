'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PRIVATE_NAV, ADMIN_NAV, isNavGroup, type NavItem } from './nav-items';

function NavLink({ item, pathname, badge }: { item: NavItem; pathname: string; badge?: number }) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== '/' && pathname?.startsWith(item.href));
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
      <Icon className="h-4 w-4" />
      <span className="flex-1">{item.label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ isAdmin = false, role = 'student', newSignupsToday = 0 }: { isAdmin?: boolean; role?: string; newSignupsToday?: number }) {
  const pathname = usePathname();
  const base = isAdmin ? [...PRIVATE_NAV, ...ADMIN_NAV] : PRIVATE_NAV;
  // El admin ve todo el menú sin restricciones, sin importar el rol de los grupos.
  const entries = isAdmin
    ? base
    : base.filter((entry) =>
        isNavGroup(entry) && entry.roles ? entry.roles.includes(role) : true
      );

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-[rgba(212,175,55,0.12)] lg:bg-[#0a0a0a]">
      <div className="flex h-16 items-center gap-3 border-b border-[rgba(212,175,55,0.12)] px-6">
        <BrandLogo size="md" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-brand-text">
            {brand.name}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-brand-gold">
            {brand.tagline}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {entries.map((entry) => {
          if (isNavGroup(entry)) {
            return (
              <div key={entry.groupLabel} className="mt-3 pt-3 border-t border-[rgba(212,175,55,0.08)]">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold/60">
                  {entry.groupLabel}
                </p>
                {entry.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            );
          }
          return <NavLink key={entry.href} item={entry} pathname={pathname} badge={entry.href === '/admin' ? newSignupsToday : undefined} />;
        })}
      </nav>

      <div className="border-t border-[rgba(212,175,55,0.12)] px-6 py-4">
        <p className="text-[11px] uppercase tracking-widest text-brand-muted">
          Sala de entrenamiento
        </p>
        <p className="mt-1 text-xs text-brand-muted/80">
          Foco. Disciplina. Cierre.
        </p>
        <p className="mt-2 text-[10px] text-red-400">
          DEBUG role={role} isAdmin={String(isAdmin)}
        </p>
      </div>
    </aside>
  );
}
