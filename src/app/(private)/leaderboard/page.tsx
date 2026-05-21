import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  Trophy,
  Medal,
  Crown,
  Flame,
  TrendingUp,
  Calendar as CalIcon,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
  rank: number;
};

const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200, 2000, 3500, 5500, 8000];
function levelOf(points: number) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return Math.min(lvl, 10);
}

export default async function LeaderboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/leaderboard');

  const [w7, w30, wAll] = await Promise.all([
    (supabase as any).rpc('leaderboard_window', { p_days: 7 }),
    (supabase as any).rpc('leaderboard_window', { p_days: 30 }),
    (supabase as any).rpc('leaderboard_window', { p_days: 0 }),
  ]);

  const data7 = ((w7.data ?? []) as Row[]) ?? [];
  const data30 = ((w30.data ?? []) as Row[]) ?? [];
  const dataAll = ((wAll.data ?? []) as Row[]) ?? [];

  const myRow7 = data7.find((r) => r.user_id === user.id) ?? null;
  const myRow30 = data30.find((r) => r.user_id === user.id) ?? null;
  const myRowAll = dataAll.find((r) => r.user_id === user.id) ?? null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.25)] bg-gradient-to-br from-[#1a1305] via-[#0d0905] to-[#0a0a0a] p-6 md:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-gold">
              <Trophy className="h-3.5 w-3.5" />
              Rankings de la Comunidad
            </div>
            <h1 className="font-display text-3xl font-bold text-brand-text md:text-4xl">
              Tabla de Honor
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-muted">
              Sumás puntos posteando, comentando y recibiendo likes en la comunidad.
              Subí en el ranking semanal, mensual y de todos los tiempos.
            </p>
          </div>
          <Crown className="hidden h-16 w-16 text-brand-gold drop-shadow-[0_0_25px_rgba(212,175,55,0.4)] md:block" />
        </div>

        {/* Mi posición en cada ranking */}
        <div className="relative mt-6 grid gap-3 md:grid-cols-3">
          <MyRankCard
            label="Esta semana"
            sublabel="Últimos 7 días"
            row={myRow7}
            accent="from-amber-400/30 to-amber-600/10"
            icon={<Flame className="h-4 w-4" />}
          />
          <MyRankCard
            label="Este mes"
            sublabel="Últimos 30 días"
            row={myRow30}
            accent="from-orange-400/30 to-orange-600/10"
            icon={<CalIcon className="h-4 w-4" />}
          />
          <MyRankCard
            label="Histórico"
            sublabel="Todos los tiempos"
            row={myRowAll}
            accent="from-yellow-400/30 to-yellow-700/10"
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Boards */}
      <Board
        title="Top 10 — Últimos 7 días"
        subtitle="El podio de la semana"
        icon={<Flame className="h-5 w-5" />}
        rows={data7.slice(0, 10)}
        currentUserId={user.id}
      />

      <Board
        title="Top 10 — Últimos 30 días"
        subtitle="Los referentes del mes"
        icon={<TrendingUp className="h-5 w-5" />}
        rows={data30.slice(0, 10)}
        currentUserId={user.id}
      />

      <Board
        title="Top 10 — Todos los tiempos"
        subtitle="Leyendas de la plataforma"
        icon={<Crown className="h-5 w-5" />}
        rows={dataAll.slice(0, 10)}
        currentUserId={user.id}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card "Tu posición"
// ---------------------------------------------------------------------------
function MyRankCard({
  label,
  sublabel,
  row,
  accent,
  icon,
}: {
  label: string;
  sublabel: string;
  row: Row | null;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-[rgba(212,175,55,0.2)] bg-gradient-to-br ${accent} p-4 transition hover:-translate-y-0.5 hover:border-brand-gold/50 hover:shadow-lg hover:shadow-brand-gold/10`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-gold">
            {icon}
            {label}
          </div>
          <p className="text-[10px] text-brand-muted">{sublabel}</p>
        </div>
        <div className="text-right">
          {row ? (
            <>
              <p className="font-display text-2xl font-bold text-brand-text">
                #{row.rank}
              </p>
              <p className="text-[11px] text-brand-muted">{row.points} pts</p>
            </>
          ) : (
            <>
              <p className="font-display text-xl font-bold text-brand-muted">—</p>
              <p className="text-[11px] text-brand-muted">Sin actividad</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tablero (top 10)
// ---------------------------------------------------------------------------
function Board({
  title,
  subtitle,
  icon,
  rows,
  currentUserId,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: Row[];
  currentUserId: string;
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-6">
        <header className="mb-4 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gold/10 text-brand-gold">
            {icon}
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-text">{title}</h2>
            <p className="text-xs text-brand-muted">{subtitle}</p>
          </div>
        </header>
        <p className="py-8 text-center text-sm text-brand-muted">
          Aún no hay actividad en este periodo.
        </p>
      </section>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 10);

  return (
    <section className="rounded-2xl border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-5 md:p-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gold/10 text-brand-gold">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-text">{title}</h2>
          <p className="text-xs text-brand-muted">{subtitle}</p>
        </div>
      </header>

      {/* Podio */}
      {podium.length > 0 && (
        <div className="mb-5 grid grid-cols-3 items-end gap-2 md:gap-4">
          {/* Plata (2) */}
          {podium[1] ? (
            <PodiumColumn row={podium[1]} medal="silver" isMe={podium[1].user_id === currentUserId} />
          ) : (
            <div />
          )}
          {/* Oro (1) */}
          {podium[0] ? (
            <PodiumColumn row={podium[0]} medal="gold" isMe={podium[0].user_id === currentUserId} />
          ) : (
            <div />
          )}
          {/* Bronce (3) */}
          {podium[2] ? (
            <PodiumColumn row={podium[2]} medal="bronze" isMe={podium[2].user_id === currentUserId} />
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Resto: 4..10 */}
      {rest.length > 0 && (
        <ul className="divide-y divide-[rgba(212,175,55,0.08)]">
          {rest.map((r) => (
            <RankRow key={r.user_id} row={r} isMe={r.user_id === currentUserId} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Podio (top 3)
// ---------------------------------------------------------------------------
function PodiumColumn({
  row,
  medal,
  isMe,
}: {
  row: Row;
  medal: 'gold' | 'silver' | 'bronze';
  isMe: boolean;
}) {
  const cfg = {
    gold: {
      ring: 'ring-2 ring-brand-gold',
      glow: 'shadow-[0_0_30px_rgba(212,175,55,0.45)]',
      grad: 'from-yellow-400 via-amber-500 to-amber-700',
      txt: 'text-black',
      label: 'ORO',
      labelBg: 'bg-gradient-to-r from-yellow-300 to-amber-500 text-black',
      height: 'h-32 md:h-40',
      size: 'h-20 w-20 md:h-24 md:w-24',
      icon: <Crown className="h-5 w-5 text-brand-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]" />,
    },
    silver: {
      ring: 'ring-2 ring-slate-300/80',
      glow: 'shadow-[0_0_22px_rgba(203,213,225,0.30)]',
      grad: 'from-slate-200 via-slate-400 to-slate-600',
      txt: 'text-black',
      label: 'PLATA',
      labelBg: 'bg-gradient-to-r from-slate-200 to-slate-400 text-black',
      height: 'h-24 md:h-32',
      size: 'h-16 w-16 md:h-20 md:w-20',
      icon: <Medal className="h-4 w-4 text-slate-300" />,
    },
    bronze: {
      ring: 'ring-2 ring-orange-700/80',
      glow: 'shadow-[0_0_20px_rgba(194,99,40,0.30)]',
      grad: 'from-orange-300 via-orange-600 to-orange-900',
      txt: 'text-black',
      label: 'BRONCE',
      labelBg: 'bg-gradient-to-r from-orange-300 to-orange-700 text-black',
      height: 'h-20 md:h-24',
      size: 'h-14 w-14 md:h-16 md:w-16',
      icon: <Medal className="h-4 w-4 text-orange-500" />,
    },
  }[medal];

  const initial = (row.full_name?.trim()?.charAt(0) ?? '?').toUpperCase();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-center">
        {cfg.icon}
        <div
          className={`relative mt-1 overflow-hidden rounded-full ${cfg.size} ${cfg.ring} ${cfg.glow} transition hover:scale-105`}
        >
          {row.avatar_url ? (
            <Image
              src={row.avatar_url}
              alt={row.full_name ?? ''}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-700 to-amber-900 text-lg font-bold text-brand-text">
              {initial}
            </div>
          )}
        </div>
        <p
          className={`mt-2 max-w-[110px] truncate text-center text-xs font-medium md:max-w-[140px] md:text-sm ${
            isMe ? 'text-brand-gold' : 'text-brand-text'
          }`}
          title={row.full_name ?? ''}
        >
          {row.full_name ?? 'Anónimo'}
          {isMe && <span className="ml-1 text-[10px]">(vos)</span>}
        </p>
        <p className="text-[11px] text-brand-muted">Nivel {levelOf(row.points)}</p>
      </div>

      {/* Pedestal */}
      <div
        className={`relative w-full overflow-hidden rounded-t-lg bg-gradient-to-b ${cfg.grad} ${cfg.height}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider ${cfg.labelBg}`}
          >
            {cfg.label}
          </span>
          <p className={`mt-1 font-display text-xl font-extrabold md:text-2xl ${cfg.txt}`}>
            {row.points}
          </p>
          <p className={`text-[10px] font-medium ${cfg.txt} opacity-70`}>puntos</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fila estándar (puestos 4..10)
// ---------------------------------------------------------------------------
function RankRow({ row, isMe }: { row: Row; isMe: boolean }) {
  const initial = (row.full_name?.trim()?.charAt(0) ?? '?').toUpperCase();
  return (
    <li
      className={`group flex items-center gap-3 py-2.5 transition ${
        isMe ? 'rounded-lg bg-brand-gold/10 px-3 ring-1 ring-brand-gold/40' : 'hover:bg-white/[0.02]'
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-sm font-bold ${
          isMe
            ? 'bg-brand-gold text-black'
            : 'bg-[#161616] text-brand-muted ring-1 ring-[rgba(212,175,55,0.1)]'
        }`}
      >
        {row.rank}
      </span>
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(212,175,55,0.25)]">
        {row.avatar_url ? (
          <Image src={row.avatar_url} alt={row.full_name ?? ''} fill sizes="40px" className="object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-700 to-amber-900 text-sm font-bold text-brand-text">
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isMe ? 'text-brand-gold' : 'text-brand-text'
          }`}
        >
          {row.full_name ?? 'Anónimo'}
          {isMe && <span className="ml-1 text-[10px]">(vos)</span>}
        </p>
        <p className="text-[11px] text-brand-muted">Nivel {levelOf(row.points)}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-base font-bold text-brand-text">{row.points}</p>
        <p className="text-[10px] text-brand-muted">pts</p>
      </div>
    </li>
  );
}
