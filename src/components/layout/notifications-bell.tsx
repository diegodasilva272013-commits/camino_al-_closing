'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/(private)/notifications/actions';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'hace instantes';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export function NotificationsBell({
  initialUnread,
  initialItems,
}: {
  initialUnread: number;
  initialItems: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notif-root]')) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setUnread(0);
      setItems((prev) =>
        prev.map((it) => ({ ...it, read_at: it.read_at ?? new Date().toISOString() }))
      );
    });
  }

  function handleItemClick(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, read_at: it.read_at ?? new Date().toISOString() } : it
        )
      );
      setUnread((u) => Math.max(0, u - 1));
    });
  }

  return (
    <div className="relative" data-notif-root>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(212,175,55,0.18)] text-brand-muted transition hover:text-brand-gold"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-semibold text-black">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] shadow-xl">
          <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.12)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-gold">
              Notificaciones
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 text-[11px] text-brand-muted hover:text-brand-gold"
              >
                <Check className="h-3 w-3" /> Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-brand-muted">
                No tienes notificaciones todavía.
              </p>
            ) : (
              <ul className="divide-y divide-[rgba(212,175,55,0.08)]">
                {items.map((n) => {
                  const unreadItem = !n.read_at;
                  const Wrapper: any = n.link ? Link : 'div';
                  return (
                    <li key={n.id}>
                      <Wrapper
                        href={n.link ?? '#'}
                        onClick={() => handleItemClick(n.id)}
                        className={
                          'block px-3 py-3 text-xs transition hover:bg-[#161616] ' +
                          (unreadItem ? 'bg-[#10100a]' : '')
                        }
                      >
                        <div className="flex items-start gap-2">
                          {unreadItem && (
                            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-brand-text">{n.title}</p>
                            {n.body && (
                              <p className="mt-0.5 truncate text-brand-muted">{n.body}</p>
                            )}
                            <p className="mt-1 text-[10px] text-brand-muted/70">
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                        </div>
                      </Wrapper>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            className="block border-t border-[rgba(212,175,55,0.12)] px-3 py-2 text-center text-[11px] text-brand-gold hover:underline"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
