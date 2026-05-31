import Link from 'next/link';
import { ExternalLink, Calendar as CalIcon, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { EVENT_TYPES, type EventType } from '@/constants/categories';

export const dynamic = 'force-dynamic';

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeFor(type: EventType): string {
  const map: Record<EventType, string> = {
    live_class: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    practice: 'bg-sky-950/60 text-sky-300 border-sky-800/60',
    mentoring: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    review: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    launch: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    roleplay: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
  };
  return map[type] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700';
}

export default async function CalendarPage() {
  const supabase = createSupabaseServerClient();

  const now = new Date().toISOString();
  const { data: upcoming } = await supabase
    .from('events')
    .select('id, title, description, event_type, start_time, end_time, meeting_url, status')
    .gte('start_time', now)
    .eq('status', 'active')
    .order('start_time', { ascending: true })
    .limit(50);

  const { data: past } = await supabase
    .from('events')
    .select('id, title, description, event_type, start_time, end_time, meeting_url, status')
    .lt('start_time', now)
    .order('start_time', { ascending: false })
    .limit(15);

  const upcomingList = (upcoming ?? []) as any[];
  const pastList = (past ?? []) as any[];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Calendario"
        title="Eventos y mentorías"
        description="Clases en vivo, prácticas, roleplays y revisiones. Todo en un solo lugar."
      />

      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-gold">
          <CalIcon className="h-4 w-4" /> Próximos
        </h2>
        {upcomingList.length === 0 ? (
          <div className="card-premium text-center text-sm text-brand-muted">
            No hay eventos próximos. El admin puede agregar uno desde el panel.
          </div>
        ) : (
          <ul className="space-y-3">
            {upcomingList.map((e) => (
              <li key={e.id} className="card-premium flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ' +
                        badgeFor(e.event_type)
                      }
                    >
                      {EVENT_TYPES[e.event_type as EventType] ?? e.event_type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
                      <Clock className="h-3 w-3" />
                      {formatLongDate(e.start_time)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-brand-text">{e.title}</h3>
                  {e.description && (
                    <p className="mt-1 text-sm text-brand-muted">{e.description}</p>
                  )}
                </div>
                {e.meeting_url && (
                  <Link
                    href={e.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-gold shrink-0"
                  >
                    Unirse <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pastList.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand-muted">
            Pasados recientes
          </h2>
          <ul className="space-y-2">
            {pastList.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-md border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-text">{e.title}</p>
                  <p className="text-xs text-brand-muted">{formatLongDate(e.start_time)}</p>
                </div>
                <span
                  className={
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ' +
                    badgeFor(e.event_type)
                  }
                >
                  {EVENT_TYPES[e.event_type as EventType] ?? e.event_type}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
