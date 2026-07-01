import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import {
  Trophy, Medal, Crown, Flame, TrendingUp, Sparkles,
  MessageSquare, Dumbbell, ClipboardList, Users, Target,
  CalendarCheck, FileText, Handshake,
} from 'lucide-react';

export const dynamic  = 'force-dynamic';
export const revalidate = 0;

type SetterRow = {
  user_id:       string;
  full_name:     string | null;
  avatar_url:    string | null;
  score:         number;
  leads_pts:     number;
  meetings:      number;
  contacts:      number;
  notes_added:   number;
  conversations: number;
  sessions:      number;
  forms:         number;
  community_pts: number;
  rank:          number;
};

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

export default async function SetterRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/setter-ranking');

  const admin = createSupabaseAdminClient();

  const [r7, r30, rAll, t7, t30, tAll] = await Promise.all([
    (admin as any).rpc('setter_leaderboard', { p_days:  7 }),
    (admin as any).rpc('setter_leaderboard', { p_days: 30 }),
    (admin as any).rpc('setter_leaderboard', { p_days:  0 }),
    (admin as any).rpc('team_leaderboard',   { p_days:  7 }),
    (admin as any).rpc('team_leaderboard',   { p_days: 30 }),
    (admin as any).rpc('team_leaderboard',   { p_days:  0 }),
  ]);

  const data7    = (r7.data    ?? []) as SetterRow[];
  const data30   = (r30.data   ?? []) as SetterRow[];
  const dataAll  = (rAll.data  ?? []) as SetterRow[];
  const tData7   = (t7.data    ?? []) as TeamRow[];
  const tData30  = (t30.data   ?? []) as TeamRow[];
  const tDataAll = (tAll.data  ?? []) as TeamRow[];

  const me7   = data7.find(r => r.user_id === user.id)   ?? null;
  const me30  = data30.find(r => r.user_id === user.id)  ?? null;
  const meAll = dataAll.find(r => r.user_id === user.id) ?? null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-[#071a10] via-[#050e08] to-[#0a0a0a] p-6 md:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <Trophy className="h-3.5 w-3.5" />
              Ranking Setters · Trabajo Real
            </div>
            <h1 className="font-display text-3xl font-bold text-brand-text md:text-4xl">
              Performance de Setters
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-muted">
              Los puntos reflejan tu trabajo real en el pipeline. Más reuniones agendadas = más puntos. Nada de datos falsos.
            </p>

            {/* Puntos de leads (principal) */}
            <div className="mt-4 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Trabajo en leads (principal)</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
                <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3 text-emerald-400" /> Reunión agendada = <span className="text-emerald-300 font-bold ml-0.5">+60 pts</span></span>
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-teal-400" /> Diagnóstico profundo = <span className="text-teal-300 font-bold ml-0.5">+30 pts</span></span>
                <span className="flex items-center gap-1"><Target className="h-3 w-3 text-blue-400" /> Respondió = <span className="text-blue-300 font-bold ml-0.5">+10 pts</span></span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3 text-sky-400" /> Contactado = <span className="text-sky-300 font-bold ml-0.5">+5 pts</span></span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-zinc-400" /> Nota agregada = <span className="text-zinc-300 font-bold ml-0.5">+3 pts</span></span>
              </div>
            </div>

            {/* Puntos de formación (complementario) */}
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Formación (complementario)</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Conversación analizada = <span className="font-semibold ml-0.5">+10 pts</span></span>
                <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Formulario completado = <span className="font-semibold ml-0.5">+15 pts</span></span>
                <span className="flex items-center gap-1"><Dumbbell className="h-3 w-3" /> Sesión entrenamiento = <span className="font-semibold ml-0.5">+8 pts</span></span>
              </div>
            </div>
          </div>
          <Crown className="hidden h-16 w-16 text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.4)] md:block" />
        </div>

        {/* Mi posición */}
        <div className="relative mt-6 grid gap-3 md:grid-cols-3">
          <MyCard label="Esta semana" sublabel="Últimos 7 días"    row={me7}   icon={<Flame className="h-4 w-4" />} />
          <MyCard label="Este mes"    sublabel="Últimos 30 días"   row={me30}  icon={<TrendingUp className="h-4 w-4" />} />
          <MyCard label="Histórico"   sublabel="Todos los tiempos" row={meAll} icon={<Sparkles className="h-4 w-4" />} />
        </div>
      </section>

      {/* Ranking individual */}
      <Board title="Top 10 — Últimos 7 días"    subtitle="El podio de la semana"     icon={<Flame className="h-5 w-5" />}      rows={data7.slice(0, 10)}   currentUserId={user.id} />
      <Board title="Top 10 — Últimos 30 días"   subtitle="Los referentes del mes"    icon={<TrendingUp className="h-5 w-5" />} rows={data30.slice(0, 10)}  currentUserId={user.id} />
      <Board title="Top 10 — Todos los tiempos" subtitle="Leyendas del equipo"       icon={<Crown className="h-5 w-5" />}      rows={dataAll.slice(0, 10)} currentUserId={user.id} />

      {/* Divisor ranking de duplas */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-zinc-800" />
        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-bold text-zinc-400">
          <Handshake className="h-3.5 w-3.5" /> Ranking de Duplas
        </div>
        <div className="flex-1 border-t border-zinc-800" />
      </div>

      {/* Ranking equipos */}
      <TeamBoard title="Duplas — Últimos 7 días"    subtitle="Mejor equipo de la semana"  icon={<Flame className="h-5 w-5" />}      rows={tData7}   />
      <TeamBoard title="Duplas — Últimos 30 días"   subtitle="Mejor equipo del mes"       icon={<TrendingUp className="h-5 w-5" />} rows={tData30}  />
      <TeamBoard title="Duplas — Todos los tiempos" subtitle="El equipo más constante"    icon={<Crown className="h-5 w-5" />}      rows={tDataAll} />
    </div>
  );
}

// ── Mi posición card ──────────────────────────────────────────────────────────

function MyCard({ label, sublabel, row, icon }: { label: string; sublabel: string; row: SetterRow | null; icon: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-700/20 bg-gradient-to-br from-emerald-500/10 to-teal-700/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">{icon}{label}</div>
          <p className="text-[10px] text-brand-muted">{sublabel}</p>
          {row && row.meetings > 0 && (
            <p className="text-[10px] text-emerald-400/70 mt-0.5">🗓 {row.meetings} reunión{row.meetings !== 1 ? 'es' : ''} agendada{row.meetings !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="text-right">
          {row ? (
            <>
              <p className="font-display text-2xl font-bold text-brand-text">#{row.rank}</p>
              <p className="text-[11px] text-brand-muted">{row.score} pts</p>
              {row.leads_pts > 0 && <p className="text-[10px] text-emerald-400/70">{row.leads_pts} de leads</p>}
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

// ── Board individual ──────────────────────────────────────────────────────────

function Board({ title, subtitle, icon, rows, currentUserId }: {
  title: string; subtitle: string; icon: ReactNode; rows: SetterRow[]; currentUserId: string;
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-800/20 bg-[#0d0d0d] p-6">
        <BoardHeader title={title} subtitle={subtitle} icon={icon} />
        <p className="py-8 text-center text-sm text-brand-muted">Sin actividad en este período.</p>
      </section>
    );
  }

  const podium = rows.slice(0, 3);
  const rest   = rows.slice(3);

  return (
    <section className="rounded-2xl border border-emerald-800/20 bg-[#0d0d0d] p-5 md:p-6">
      <BoardHeader title={title} subtitle={subtitle} icon={icon} />

      {podium.length > 0 && (
        <div className="mb-5 grid grid-cols-3 items-end gap-1 sm:gap-2 md:gap-4">
          {podium[1] ? <PodiumCol row={podium[1]} medal="silver" isMe={podium[1].user_id === currentUserId} /> : <div />}
          {podium[0] ? <PodiumCol row={podium[0]} medal="gold"   isMe={podium[0].user_id === currentUserId} /> : <div />}
          {podium[2] ? <PodiumCol row={podium[2]} medal="bronze" isMe={podium[2].user_id === currentUserId} /> : <div />}
        </div>
      )}

      {rest.length > 0 && (
        <ul className="divide-y divide-emerald-900/20">
          {rest.map(r => <RankRow key={r.user_id} row={r} isMe={r.user_id === currentUserId} />)}
        </ul>
      )}
    </section>
  );
}

// ── Team Board ────────────────────────────────────────────────────────────────

function TeamBoard({ title, subtitle, icon, rows }: {
  title: string; subtitle: string; icon: ReactNode; rows: TeamRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-800/40 bg-[#0d0d0d] p-6">
        <BoardHeader title={title} subtitle={subtitle} icon={icon} color="zinc" />
        <p className="py-8 text-center text-sm text-brand-muted">Sin equipos configurados aún.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800/40 bg-[#0d0d0d] p-5 md:p-6">
      <BoardHeader title={title} subtitle={subtitle} icon={icon} color="zinc" />
      <ul className="divide-y divide-zinc-800/40 mt-2">
        {rows.map((t, i) => <TeamRow key={t.team_id} row={t} pos={i + 1} />)}
      </ul>
    </section>
  );
}

function TeamRow({ row, pos }: { row: TeamRow; pos: number }) {
  const posColor = pos === 1 ? 'bg-emerald-500 text-black' : pos === 2 ? 'bg-slate-400 text-black' : pos === 3 ? 'bg-orange-600 text-white' : 'bg-[#161616] text-brand-muted ring-1 ring-zinc-800';
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-sm font-bold ${posColor}`}>
        {pos}
      </span>
      <div className="flex items-center gap-1">
        <MiniAvatar name={row.setter1_name} avatar={row.setter1_avatar} />
        <MiniAvatar name={row.setter2_name} avatar={row.setter2_avatar} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-text truncate">{row.team_name ?? 'Dupla sin nombre'}</p>
        <p className="text-[11px] text-zinc-500 truncate">
          {[row.setter1_name, row.setter2_name].filter(Boolean).join(' · ')}
        </p>
        <div className="flex gap-3 text-[10px] text-zinc-600 mt-0.5">
          {row.meetings > 0   && <span className="text-emerald-400/80">🗓 {row.meetings} reuniones</span>}
          {row.leads_pts > 0  && <span className="text-teal-400/80">🎯 {row.leads_pts} pts leads</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-base font-bold text-brand-text">{row.score}</p>
        <p className="text-[10px] text-brand-muted">pts</p>
      </div>
    </li>
  );
}

function MiniAvatar({ name, avatar }: { name: string | null; avatar: string | null }) {
  const letter = (name?.charAt(0) ?? '?').toUpperCase();
  return (
    <div className="relative h-8 w-8 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 shrink-0">
      {avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatar} alt="" className="h-full w-full object-cover" />
        : <div className="grid h-full w-full place-items-center text-xs font-bold text-zinc-400">{letter}</div>
      }
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function BoardHeader({ title, subtitle, icon, color = 'emerald' }: {
  title: string; subtitle: string; icon: ReactNode; color?: 'emerald' | 'zinc';
}) {
  const bg  = color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400';
  return (
    <header className="mb-5 flex items-center gap-3">
      <span className={`grid h-9 w-9 place-items-center rounded-full ${bg}`}>{icon}</span>
      <div>
        <h2 className="font-display text-lg font-semibold text-brand-text">{title}</h2>
        <p className="text-xs text-brand-muted">{subtitle}</p>
      </div>
    </header>
  );
}

const MEDAL_CFG = {
  gold: {
    ring: 'ring-2 ring-emerald-400', glow: 'shadow-[0_0_30px_rgba(52,211,153,0.4)]',
    grad: 'from-emerald-300 via-emerald-500 to-emerald-800', txt: 'text-black',
    label: 'ORO', labelBg: 'bg-gradient-to-r from-emerald-300 to-emerald-500 text-black',
    height: 'h-32 md:h-40', size: 'h-20 w-20 md:h-24 md:w-24',
    icon: <Crown className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />,
  },
  silver: {
    ring: 'ring-2 ring-slate-300/80', glow: 'shadow-[0_0_22px_rgba(203,213,225,0.30)]',
    grad: 'from-slate-200 via-slate-400 to-slate-600', txt: 'text-black',
    label: 'PLATA', labelBg: 'bg-gradient-to-r from-slate-200 to-slate-400 text-black',
    height: 'h-24 md:h-32', size: 'h-16 w-16 md:h-20 md:w-20',
    icon: <Medal className="h-4 w-4 text-slate-300" />,
  },
  bronze: {
    ring: 'ring-2 ring-orange-700/80', glow: 'shadow-[0_0_20px_rgba(194,99,40,0.30)]',
    grad: 'from-orange-300 via-orange-600 to-orange-900', txt: 'text-black',
    label: 'BRONCE', labelBg: 'bg-gradient-to-r from-orange-300 to-orange-700 text-black',
    height: 'h-20 md:h-24', size: 'h-14 w-14 md:h-16 md:w-16',
    icon: <Medal className="h-4 w-4 text-orange-500" />,
  },
} as const;

function PodiumCol({ row, medal, isMe }: { row: SetterRow; medal: 'gold' | 'silver' | 'bronze'; isMe: boolean }) {
  const cfg     = MEDAL_CFG[medal];
  const initial = (row.full_name?.trim()?.charAt(0) ?? '?').toUpperCase();
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-center">
        {cfg.icon}
        <div className={`relative mt-1 overflow-hidden rounded-full ${cfg.size} ${cfg.ring} ${cfg.glow} transition hover:scale-105`}>
          {row.avatar_url
            ? <Image src={row.avatar_url} alt={row.full_name ?? ''} fill sizes="96px" className="object-cover" />
            : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-emerald-700 to-teal-900 text-lg font-bold text-white">{initial}</div>
          }
        </div>
        <p className={`mt-2 max-w-[110px] truncate text-center text-xs font-medium md:max-w-[140px] md:text-sm ${isMe ? 'text-emerald-400' : 'text-brand-text'}`} title={row.full_name ?? ''}>
          {row.full_name ?? 'Anónimo'}{isMe && <span className="ml-1 text-[10px]">(vos)</span>}
        </p>
        {/* Métricas clave — leads primero */}
        <div className="mt-1 flex flex-col items-center gap-0.5 text-[9px]">
          {row.meetings > 0   && <span className="text-emerald-400">🗓 {row.meetings} reuniones</span>}
          {row.contacts > 0   && <span className="text-sky-400/80">📲 {row.contacts} contactos</span>}
          {row.conversations > 0 && <span className="text-blue-400/70">💬 {row.conversations} conv.</span>}
        </div>
      </div>
      <div className={`relative w-full overflow-hidden rounded-t-lg bg-gradient-to-b ${cfg.grad} ${cfg.height}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider ${cfg.labelBg}`}>{cfg.label}</span>
          <p className={`mt-1 font-display text-xl font-extrabold md:text-2xl ${cfg.txt}`}>{row.score}</p>
          <p className={`text-[10px] font-medium ${cfg.txt} opacity-70`}>puntos</p>
        </div>
      </div>
    </div>
  );
}

function RankRow({ row, isMe }: { row: SetterRow; isMe: boolean }) {
  const initial = (row.full_name?.trim()?.charAt(0) ?? '?').toUpperCase();
  return (
    <li className={`group flex items-center gap-3 py-2.5 transition ${isMe ? 'rounded-lg bg-emerald-500/10 px-3 ring-1 ring-emerald-500/30' : 'hover:bg-white/[0.02]'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-sm font-bold ${isMe ? 'bg-emerald-500 text-black' : 'bg-[#161616] text-brand-muted ring-1 ring-emerald-900/30'}`}>
        {row.rank}
      </span>
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-emerald-800/30">
        {row.avatar_url
          ? <Image src={row.avatar_url} alt={row.full_name ?? ''} fill sizes="40px" className="object-cover" />
          : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-emerald-700 to-teal-900 text-sm font-bold text-white">{initial}</div>
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isMe ? 'text-emerald-400' : 'text-brand-text'}`}>
          {row.full_name ?? 'Anónimo'}{isMe && <span className="ml-1 text-[10px]">(vos)</span>}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500 mt-0.5">
          {row.meetings > 0    && <span className="text-emerald-400/80">🗓 {row.meetings} reuniones</span>}
          {row.contacts > 0    && <span className="text-sky-400/70">📲 {row.contacts} contactos</span>}
          {row.notes_added > 0 && <span className="text-zinc-400/70">📝 {row.notes_added} notas</span>}
          {row.conversations > 0 && <span className="text-blue-400/70">💬 {row.conversations} conv.</span>}
          {row.forms > 0       && <span className="text-yellow-400/70">📋 {row.forms} form.</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-base font-bold text-brand-text">{row.score}</p>
        {row.leads_pts > 0 && <p className="text-[10px] text-emerald-400/70">{row.leads_pts} leads</p>}
        {row.leads_pts === 0 && <p className="text-[10px] text-brand-muted">pts</p>}
      </div>
    </li>
  );
}
