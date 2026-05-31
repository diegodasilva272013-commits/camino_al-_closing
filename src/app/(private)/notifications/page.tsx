import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { markAllNotificationsReadAction, deleteNotificationAction } from './actions';
import { Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace instantes';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default async function NotificationsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const items = (data ?? []) as Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }>;

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Centro de actividad"
        title="Notificaciones"
        description="Todo lo que pasa contigo en la sala."
        actions={
          hasUnread ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="btn-ghost-gold">
                Marcar todas como leídas
              </button>
            </form>
          ) : null
        }
      />

      {items.length === 0 ? (
        <div className="card-premium text-center text-sm text-brand-muted">
          Aún no tienes notificaciones.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={
                'flex items-start gap-3 rounded-md border px-4 py-3 ' +
                (n.read_at
                  ? 'border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]'
                  : 'border-[rgba(212,175,55,0.35)] bg-[#13110a]')
              }
            >
              {!n.read_at && (
                <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
              )}
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link href={n.link} className="text-sm font-medium text-brand-text hover:text-brand-gold">
                    {n.title}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-brand-text">{n.title}</p>
                )}
                {n.body && <p className="mt-1 text-xs text-brand-muted">{n.body}</p>}
                <p className="mt-1 text-[10px] text-brand-muted/70">{timeAgo(n.created_at)}</p>
              </div>
              <form action={deleteNotificationAction.bind(null, n.id)}>
                <button
                  type="submit"
                  className="rounded p-1 text-brand-muted transition hover:text-rose-400"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
