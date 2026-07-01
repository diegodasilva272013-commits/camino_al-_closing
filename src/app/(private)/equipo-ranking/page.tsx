import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { Handshake, Crown, Flame, TrendingUp, CalendarCheck, Target, Medal } from 'lucide-react';

export const dynamic  = 'force-dynamic';
export const revalidate = 0;

type TeamRow = {
  team_id:        string;
  team_name:      string | null;
  setter1_id:     string | null;
  setter1_name:   string | null;
  setter1_avatar: string | null;
  setter2_id:     string | null;
  setter2_name:   string | null;
  setter2_avatar: string | null;
  score:          number;
  leads_pts:      number;
  meetings:       number;
  rank:           number;
};

export default async function EquipoRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/equipo-ranking');

  const admin = createSupabaseAdminClient();

  const [r7, r30, rAll] = await Promise.all([
    (admin as any).rpc('team_leaderboard', { p_days:  7 }),
    (admin as any).rpc('team_leaderboard', { p_days: 30 }),
    (admin as any).rpc('team_leaderboard', { p_days:  0 }),
  ]);

  const data7   = (r7.data   ?? []) as TeamRow[];
  const data30  = (r30.data  ?? []) as TeamRow[];
  const dataAll = (rAll.data ?? []) as TeamRow[];

  return (
    <div className="space-y-8">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-700/40 bg-gradient-to-br from-[#0d0d14] via-[#080810] to-[#0a0a0a] p-6 md:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/8 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/8 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-600/50 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300">
              <Handshake className="h-3.5 w-3.5" />
              Ranking de Duplas
            </div>
            <h1 className="font-display text-3xl font-bold text-brand-text md:text-4xl">
              Equipos de Setters
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-muted">
              Score combinado de los dos setters de cada dupla — leads personales y leads de equipo. El equipo sube si cualquiera de los dos trabaja.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
              <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3 text-emerald-400" /> Reunión agendada = <span className="font-bold text-emerald-300 ml-0.5">+60 pts</span></span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-teal-400" /> Diagnóstico profundo = <span className="font-bold text-teal-300 ml-0.5">+30 pts</span></span>
              <span className="flex items-center gap-1"><Target className="h-3 w-3 text-sky-400" /> Contactado / Respondió = <span className="font-bold text-sky-300 ml-0.5">+5 / +10 pts</span></span>
            </div>
          </div>
          <Handshake className="hidden h-16 w-16 text-zinc-600 md:block" />
        </div>
      </section>

      <Board title="Duplas — Últimos 7 días"    subtitle="El mejor equipo de la semana"   icon={<Flame className="h-5 w-5" />}      rows={data7}   />
      <Board title="Duplas — Últimos 30 días"   subtitle="El mejor equipo del mes"        icon={<TrendingUp className="h-5 w-5" />} rows={data30}  />
      <Board title="Duplas — Todos los tiempos" subtitle="El equipo más constante del CAC" icon={<Crown className="h-5 w-5" />}     rows={dataAll} />
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

function Board({ title, subtitle, icon, rows }: {
  title: string; subtitle: string; icon: ReactNode; rows: TeamRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-800/50 bg-[#0d0d0d] p-6">
        <BoardHeader title={title} subtitle={subtitle} icon={icon} />
        <div className="py-12 text-center space-y-2">
          <Handshake className="h-8 w-8 text-zinc-700 mx-auto" />
          <p className="text-sm text-brand-muted">Sin equipos configurados todavía.</p>
          <p className="text-xs text-zinc-700">Creá equipos en <span className="text-zinc-500 font-mono">/admin/equipos</span></p>
        </div>
      </section>
    );
  }

  const podium = rows.slice(0, 3);
  const rest   = rows.slice(3);

  return (
    <section className="rounded-2xl border border-zinc-800/50 bg-[#0d0d0d] p-5 md:p-6">
      <BoardHeader title={title} subtitle={subtitle} icon={icon} />

      {/* Podio */}
      {podium.length > 0 && (
        <div className="mb-6 grid grid-cols-3 items-end gap-2 md:gap-4">
          {podium[1] ? <PodiumCard row={podium[1]} medal="silver" /> : <div />}
          {podium[0] ? <PodiumCard row={podium[0]} medal="gold"   /> : <div />}
          {podium[2] ? <PodiumCard row={podium[2]} medal="bronze" /> : <div />}
        </div>
      )}

      {/* Resto */}
      {rest.length > 0 && (
        <ul className="divide-y divide-zinc-800/40">
          {rest.map(r => <RestRow key={r.team_id} row={r} />)}
        </ul>
      )}
    </section>
  );
}

// ── Podio ─────────────────────────────────────────────────────────────────────

const MEDAL = {
  gold: {
    ring: 'ring-2 ring-yellow-400/70', glow: 'shadow-[0_0_28px_rgba(234,179,8,0.3)]',
    grad: 'from-yellow-300 via-yellow-500 to-yellow-800', txt: 'text-black',
    label: 'ORO', labelBg: 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-black',
    height: 'h-32 md:h-40',
    icon: <Crown className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />,
  },
  silver: {
    ring: 'ring-2 ring-slate-300/70', glow: 'shadow-[0_0_22px_rgba(203,213,225,0.25)]',
    grad: 'from-slate-200 via-slate-400 to-slate-600', txt: 'text-black',
    label: 'PLATA', labelBg: 'bg-gradient-to-r from-slate-200 to-slate-400 text-black',
    height: 'h-24 md:h-32',
    icon: <Medal className="h-4 w-4 text-slate-300" />,
  },
  bronze: {
    ring: 'ring-2 ring-orange-700/70', glow: 'shadow-[0_0_18px_rgba(194,99,40,0.25)]',
    grad: 'from-orange-300 via-orange-600 to-orange-900', txt: 'text-black',
    label: 'BRONCE', labelBg: 'bg-gradient-to-r from-orange-300 to-orange-600 text-black',
    height: 'h-20 md:h-24',
    icon: <Medal className="h-4 w-4 text-orange-500" />,
  },
} as const;

function PodiumCard({ row, medal }: { row: TeamRow; medal: 'gold' | 'silver' | 'bronze' }) {
  const cfg = MEDAL[medal];
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatares dupla */}
      <div className="flex flex-col items-center gap-1">
        {cfg.icon}
        <div className="flex -space-x-3 mt-1">
          <AvatarCircle name={row.setter1_name} avatar={row.setter1_avatar} size="lg" ring={cfg.ring} glow={cfg.glow} />
          <AvatarCircle name={row.setter2_name} avatar={row.setter2_avatar} size="lg" ring={cfg.ring} glow={cfg.glow} />
        </div>
        <p className="mt-2 max-w-[120px] truncate text-center text-xs font-semibold text-brand-text" title={row.team_name ?? ''}>
          {row.team_name ?? 'Dupla sin nombre'}
        </p>
        <p className="text-[10px] text-zinc-500 truncate max-w-[120px] text-center">
          {[row.setter1_name, row.setter2_name].filter(Boolean).join(' + ')}
        </p>
        {row.meetings > 0 && (
          <span className="text-[10px] text-emerald-400">🗓 {row.meetings} reuniones</span>
        )}
      </div>
      {/* Pedestal */}
      <div className={`relative w-full overflow-hidden rounded-t-lg bg-gradient-to-b ${cfg.grad} ${cfg.height}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.2),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider ${cfg.labelBg}`}>{cfg.label}</span>
          <p className={`mt-1 font-display text-xl font-extrabold md:text-2xl ${cfg.txt}`}>{row.score}</p>
          <p className={`text-[10px] font-medium ${cfg.txt} opacity-70`}>puntos</p>
        </div>
      </div>
    </div>
  );
}

// ── Fila resto ────────────────────────────────────────────────────────────────

function RestRow({ row }: { row: TeamRow }) {
  return (
    <li className="flex items-center gap-3 py-3 hover:bg-white/[0.02] transition">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#161616] font-display text-sm font-bold text-brand-muted ring-1 ring-zinc-800">
        {row.rank}
      </span>
      <div className="flex -space-x-2 shrink-0">
        <AvatarCircle name={row.setter1_name} avatar={row.setter1_avatar} size="md" />
        <AvatarCircle name={row.setter2_name} avatar={row.setter2_avatar} size="md" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-text truncate">{row.team_name ?? 'Dupla sin nombre'}</p>
        <p className="text-[11px] text-zinc-500 truncate">
          {[row.setter1_name, row.setter2_name].filter(Boolean).join(' · ')}
        </p>
        <div className="flex gap-3 text-[10px] mt-0.5">
          {row.meetings > 0  && <span className="text-emerald-400/80">🗓 {row.meetings} reuniones</span>}
          {row.leads_pts > 0 && <span className="text-teal-400/70">🎯 {row.leads_pts} pts leads</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-base font-bold text-brand-text">{row.score}</p>
        <p className="text-[10px] text-brand-muted">pts</p>
      </div>
    </li>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function AvatarCircle({ name, avatar, size, ring = 'ring-1 ring-zinc-700', glow = '' }: {
  name: string | null; avatar: string | null;
  size: 'sm' | 'md' | 'lg';
  ring?: string; glow?: string;
}) {
  const cls = size === 'lg' ? 'h-14 w-14 md:h-16 md:w-16 text-base' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  const letter = (name?.charAt(0) ?? '?').toUpperCase();
  return (
    <div className={`relative overflow-hidden rounded-full bg-zinc-800 border-2 border-[#0d0d0d] ${cls} ${ring} ${glow} shrink-0`}>
      {avatar
        ? <Image src={avatar} alt={name ?? ''} fill sizes="64px" className="object-cover" />
        : <div className="grid h-full w-full place-items-center font-bold text-zinc-400">{letter}</div>
      }
    </div>
  );
}

function BoardHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: ReactNode }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-zinc-400">{icon}</span>
      <div>
        <h2 className="font-display text-lg font-semibold text-brand-text">{title}</h2>
        <p className="text-xs text-brand-muted">{subtitle}</p>
      </div>
    </header>
  );
}
