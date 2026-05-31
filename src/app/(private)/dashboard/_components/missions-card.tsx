import Link from 'next/link';
import { Target } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';

type Mission = {
  id: string;
  code: string;
  kind: 'daily' | 'weekly';
  title: string;
  description: string | null;
  icon: string | null;
  target: number;
  reward_points: number;
  progress: number;
  completed: boolean;
  period_key: string;
};

export async function MissionsCard() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase as any).rpc('get_user_missions', {
    p_user: user.id,
  });

  if (error || !data) {
    return null;
  }
  const missions = data as Mission[];
  const daily = missions.filter((m) => m.kind === 'daily');
  const weekly = missions.filter((m) => m.kind === 'weekly');

  if (missions.length === 0) return null;

  return (
    <section className="card-premium md:col-span-2 xl:col-span-3">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-gold" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Misiones
          </p>
        </div>
        <p className="text-[11px] text-brand-muted">
          Completalas para sumar XP extra
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MissionGroup label="Hoy" items={daily} emptyText="Sin misiones diarias." />
        <MissionGroup
          label="Esta semana"
          items={weekly}
          emptyText="Sin misiones semanales."
        />
      </div>
    </section>
  );
}

function MissionGroup({
  label,
  items,
  emptyText,
}: {
  label: string;
  items: Mission[];
  emptyText: string;
}) {
  const done = items.filter((m) => m.completed).length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
          {label}
        </p>
        <p className="text-[11px] text-brand-muted">
          {done}/{items.length} completas
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-brand-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MissionRow({ mission }: { mission: Mission }) {
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
  const href = linkForCode(mission.code);

  const inner = (
    <div
      className={
        'rounded-xl border p-3 transition ' +
        (mission.completed
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-[rgba(212,175,55,0.18)] hover:border-brand-gold/50')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="text-lg leading-none">{mission.icon ?? '🎯'}</span>
          <div className="min-w-0">
            <p
              className={
                'truncate text-sm font-semibold ' +
                (mission.completed ? 'text-emerald-300' : 'text-brand-text')
              }
            >
              {mission.title}
            </p>
            {mission.description && (
              <p className="mt-0.5 truncate text-[11px] text-brand-muted">
                {mission.description}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-brand-gold/30 px-2 py-0.5 text-[10px] font-semibold text-brand-gold">
          +{mission.reward_points} XP
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1c1c1c]">
          <div
            className={
              'h-full transition-all ' +
              (mission.completed ? 'bg-emerald-500' : 'bg-gold-gradient')
            }
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-brand-muted">
          {mission.progress}/{mission.target}
        </span>
      </div>
    </div>
  );

  if (mission.completed || !href) return <li>{inner}</li>;
  return (
    <li>
      <Link href={href} className="block">
        {inner}
      </Link>
    </li>
  );
}

function linkForCode(code: string): string | null {
  if (code.includes('comment') || code.includes('post') || code.includes('like')) {
    return '/community';
  }
  if (code.includes('lesson')) return '/classes';
  return null;
}
