import { getLevel } from '@/lib/levels';

type Size = 'xs' | 'sm' | 'md';

/**
 * Badge compacto para mostrar al lado de un avatar.
 * Pasale los puntos del usuario.
 */
export function LevelBadge({
  points,
  size = 'sm',
  withName = false,
}: {
  points: number | null | undefined;
  size?: Size;
  withName?: boolean;
}) {
  const info = getLevel(points);
  const sizing =
    size === 'xs'
      ? 'h-4 min-w-[18px] px-1 text-[9px]'
      : size === 'sm'
        ? 'h-5 min-w-[22px] px-1.5 text-[10px]'
        : 'h-6 min-w-[26px] px-2 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${info.badgeClass} ${sizing}`}
      title={`Nivel ${info.level} · ${info.name}`}
    >
      <span aria-hidden>{info.emoji}</span>
      <span>Lv {info.level}</span>
      {withName && <span className="font-medium normal-case">· {info.name}</span>}
    </span>
  );
}

/**
 * Card grande con avatar/nombre + barra de progreso al siguiente nivel.
 */
export function LevelProgressCard({
  points,
  className = '',
}: {
  points: number | null | undefined;
  className?: string;
}) {
  const p = Math.max(0, Math.floor(points ?? 0));
  const info = getLevel(p);
  const pct = Math.round(info.progress * 100);
  const remaining = info.next != null ? info.next - p : 0;

  return (
    <div className={`rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0c0c0c] p-5 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted">
            Nivel actual
          </p>
          <h3 className="mt-1 text-2xl font-bold text-brand-text">
            <span className="mr-2">{info.emoji}</span>
            Lv {info.level} · {info.name}
          </h3>
          <p className="mt-1 text-xs text-brand-muted">
            {p.toLocaleString('es-ES')} puntos acumulados
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand-gold/60 bg-gradient-to-br from-[#1a1408] to-[#0a0a0a] text-2xl font-bold text-brand-gold shadow-[0_0_24px_-6px_rgba(212,175,55,0.6)]">
          {info.level}
        </div>
      </div>

      <div className="mt-4">
        {info.next != null ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-brand-muted">
              <span>Progreso al nivel {info.level + 1}</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1a1408]">
              <div
                className="h-full rounded-full bg-gold-gradient transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-brand-muted">
              Faltan <span className="text-brand-gold font-medium">{remaining.toLocaleString('es-ES')}</span> pts
            </p>
          </>
        ) : (
          <p className="text-xs text-brand-gold">
            🏅 Estás en el nivel máximo. Sos parte del Hall of Fame.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Tabla de cómo se ganan puntos.
 */
export function PointsLegend() {
  return (
    <div className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted">
        Cómo subir de nivel
      </p>
      <ul className="mt-3 space-y-2 text-sm text-brand-text/90">
        <li className="flex items-center justify-between">
          <span>📝 Crear un post</span>
          <span className="font-mono text-brand-gold">+5 pts</span>
        </li>
        <li className="flex items-center justify-between">
          <span>💬 Comentar en un post</span>
          <span className="font-mono text-brand-gold">+2 pts</span>
        </li>
        <li className="flex items-center justify-between">
          <span>❤️ Like que recibís en tu post</span>
          <span className="font-mono text-brand-gold">+1 pt</span>
        </li>
      </ul>
    </div>
  );
}
