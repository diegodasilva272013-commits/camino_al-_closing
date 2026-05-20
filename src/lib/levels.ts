/**
 * Sistema de niveles de la comunidad.
 * Espejo del helper SQL public.community_level().
 * Mantener sincronizado con supabase/migrations/0004_profiles_gamification.sql
 */

export type LevelInfo = {
  level: number; // 1..10
  name: string;
  /** umbral mínimo de puntos para este nivel */
  min: number;
  /** umbral del siguiente nivel (null si ya es nivel 10) */
  next: number | null;
  /** progreso 0..1 dentro del nivel actual */
  progress: number;
  /** color principal del badge (tailwind classes) */
  badgeClass: string;
  ringClass: string;
  /** emoji decorativo del nivel */
  emoji: string;
};

const LEVELS: Array<{
  level: number;
  name: string;
  min: number;
  emoji: string;
  badgeClass: string;
  ringClass: string;
}> = [
  { level: 1, name: 'Aprendiz',       min: 0,    emoji: '🌱', badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',                                ringClass: 'ring-zinc-600/40' },
  { level: 2, name: 'Iniciado',       min: 50,   emoji: '🪙', badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800/60',                       ringClass: 'ring-amber-700/40' },
  { level: 3, name: 'Closer Junior',  min: 150,  emoji: '⚡', badgeClass: 'bg-sky-950/60 text-sky-300 border-sky-800/60',                             ringClass: 'ring-sky-700/40' },
  { level: 4, name: 'Closer',         min: 350,  emoji: '🎯', badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',                 ringClass: 'ring-emerald-700/40' },
  { level: 5, name: 'Closer Senior',  min: 700,  emoji: '🔥', badgeClass: 'bg-orange-950/60 text-orange-300 border-orange-800/60',                    ringClass: 'ring-orange-700/40' },
  { level: 6, name: 'Top Performer',  min: 1200, emoji: '💎', badgeClass: 'bg-cyan-950/60 text-cyan-200 border-cyan-700/60',                          ringClass: 'ring-cyan-600/40' },
  { level: 7, name: 'Elite',          min: 2000, emoji: '👑', badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-800/60',                    ringClass: 'ring-purple-700/40' },
  { level: 8, name: 'Maestro',        min: 3500, emoji: '🏆', badgeClass: 'bg-yellow-950/60 text-yellow-300 border-yellow-700/60',                    ringClass: 'ring-yellow-600/40' },
  { level: 9, name: 'Leyenda',        min: 5500, emoji: '🌟', badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800/60',                          ringClass: 'ring-rose-700/40' },
  { level: 10,name: 'Hall of Fame',   min: 8000, emoji: '⚜️', badgeClass: 'bg-gradient-to-r from-[#5b3a05] to-[#a87420] text-[#fff7d6] border-brand-gold', ringClass: 'ring-brand-gold/60' },
];

export function getLevel(points: number | null | undefined): LevelInfo {
  const p = Math.max(0, Math.floor(points ?? 0));
  let current = LEVELS[0];
  for (const lv of LEVELS) {
    if (p >= lv.min) current = lv;
  }
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;
  const progress = next
    ? Math.min(1, (p - current.min) / (next.min - current.min))
    : 1;
  return {
    level: current.level,
    name: current.name,
    min: current.min,
    next: next ? next.min : null,
    progress,
    badgeClass: current.badgeClass,
    ringClass: current.ringClass,
    emoji: current.emoji,
  };
}

export const MAX_LEVEL = 10;
