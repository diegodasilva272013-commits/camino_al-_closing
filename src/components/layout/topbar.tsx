import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { SearchInput } from './search-input';
import { NotificationsBell, type NotificationItem } from './notifications-bell';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function getInitials(name: string | null | undefined, email: string): string {
  const base = (name && name.trim().length > 0 ? name : email).trim();
  const parts = base.split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return initials || 'CC';
}

export async function Topbar({ isAdmin = false }: { isAdmin?: boolean }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? '';
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? null;
  const initials = user ? getInitials(fullName, email) : 'CC';

  let unread = 0;
  let items: NotificationItem[] = [];
  if (user) {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    items = (notifs ?? []) as NotificationItem[];
    unread = items.filter((n) => !n.read_at).length;
    if (items.length === 10) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      unread = count ?? unread;
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a]/80 px-4 backdrop-blur lg:px-8">
      <MobileNav isAdmin={isAdmin} />

      <div className="hidden flex-1 md:flex">
        <SearchInput />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {user && <NotificationsBell initialUnread={unread} initialItems={items} />}
        {user ? (
          <UserMenu initials={initials} email={email} fullName={fullName} />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(212,175,55,0.35)] bg-[#181818] text-sm font-medium text-brand-gold">
            CC
          </div>
        )}
      </div>
    </header>
  );
}
