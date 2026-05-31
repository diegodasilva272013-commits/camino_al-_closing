import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/constants/branding';
import { LevelBadge } from '@/components/community/level-badge';
import { Link2, Flame } from 'lucide-react';

export type SidebarMember = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type SidebarLeader = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
  rank: number;
};

export type SidebarStats = {
  members: number;
  online: number;
  admins: number;
};

export type SidebarLink = { label: string; href: string; emoji?: string };

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

function Avatar({
  url,
  name,
  size = 'sm',
}: {
  url: string | null;
  name: string | null;
  size?: 'xs' | 'sm' | 'md';
}) {
  const cls =
    size === 'xs'
      ? 'h-6 w-6 text-[10px]'
      : size === 'sm'
        ? 'h-8 w-8 text-xs'
        : 'h-10 w-10 text-sm';
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase();
  if (url) {
    return (
      <div
        className={`relative overflow-hidden rounded-full border border-[rgba(212,175,55,0.3)] ${cls}`}
      >
        <Image src={url} alt={name ?? ''} fill className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full border border-[rgba(212,175,55,0.3)] bg-[#111] font-semibold text-brand-gold ${cls}`}
    >
      {initial}
    </div>
  );
}

export function GroupSidebar({
  stats,
  recentMembers,
  topMembers,
  links,
  isAdmin,
}: {
  stats: SidebarStats;
  recentMembers: SidebarMember[];
  topMembers: SidebarLeader[];
  links: SidebarLink[];
  isAdmin: boolean;
}) {
  return (
    <aside className="space-y-4">
      {/* Tarjeta principal del grupo */}
      <section className="overflow-hidden rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a]">
        <div className="relative h-28 w-full bg-[#0a0a0a] sm:h-36">
          <Image
            src="/Logo2.png"
            alt={brand.name}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-contain p-2"
          />
        </div>
        <div className="space-y-3 p-4">
          <div>
            <h2 className="text-base font-semibold text-brand-text">
              {brand.name}
            </h2>
            <p className="text-[11px] text-brand-muted">caminoalclosing.com</p>
          </div>
          <p className="text-xs leading-relaxed text-brand-text/85">
            {brand.description}
          </p>

          {links.length > 0 && (
            <ul className="space-y-1.5">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex items-center gap-2 text-xs text-brand-text/90 hover:text-brand-gold"
                  >
                    <Link2 className="h-3 w-3 text-brand-muted" />
                    {l.emoji && <span>{l.emoji}</span>}
                    <span>{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-3 gap-1 border-y border-white/5 py-3 sm:gap-2">
            <div>
              <p className="text-base font-semibold text-brand-text">
                {stats.members.toLocaleString('es-AR')}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-brand-muted">
                Miembros
              </p>
            </div>
            <div>
              <p className="text-base font-semibold text-brand-text">
                {stats.online.toLocaleString('es-AR')}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-brand-muted">
                Hoy
              </p>
            </div>
            <div>
              <p className="text-base font-semibold text-brand-text">
                {stats.admins.toLocaleString('es-AR')}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-brand-muted">
                Admins
              </p>
            </div>
          </div>

          {recentMembers.length > 0 && (
            <div className="flex -space-x-2">
              {recentMembers.slice(0, 6).map((m) => (
                <Link key={m.id} href={`/u/${m.id}`} className="relative">
                  <Avatar url={m.avatar_url} name={m.full_name} size="xs" />
                </Link>
              ))}
            </div>
          )}

          {isAdmin ? (
            <Link
              href="/admin"
              className="btn-ghost-gold block w-full text-center text-xs uppercase tracking-widest"
            >
              Configuración
            </Link>
          ) : (
            <Link
              href="/profile"
              className="btn-ghost-gold block w-full text-center text-xs uppercase tracking-widest"
            >
              Mi perfil
            </Link>
          )}
        </div>
      </section>

      {/* Leaderboard 30 días */}
      <section className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-text">
            Ranking (30 días)
          </h3>
          <Link
            href="/leaderboard"
            className="text-[11px] text-brand-gold hover:underline"
          >
            Ver todo
          </Link>
        </div>
        <ul className="space-y-2">
          {topMembers.slice(0, 5).map((m) => (
            <li key={m.user_id} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-center text-base">
                {RANK_MEDAL[m.rank - 1] ?? (
                  <span className="text-brand-muted">{m.rank}</span>
                )}
              </span>
              <Link
                href={`/u/${m.user_id}`}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <Avatar url={m.avatar_url} name={m.full_name} size="xs" />
                <span className="truncate text-brand-text hover:underline">
                  {m.full_name ?? 'Usuario'}
                </span>
              </Link>
              <LevelBadge points={m.points} size="xs" />
              <span className="inline-flex items-center gap-0.5 text-brand-gold">
                <Flame className="h-3 w-3" />
                <span>+{m.points}</span>
              </span>
            </li>
          ))}
          {topMembers.length === 0 && (
            <li className="text-xs text-brand-muted">
              Sin actividad reciente.
            </li>
          )}
        </ul>
      </section>
    </aside>
  );
}
