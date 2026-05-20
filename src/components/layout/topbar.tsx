import { Bell, Search } from 'lucide-react';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function getInitials(name: string | null | undefined, email: string): string {
  const base = (name && name.trim().length > 0 ? name : email).trim();
  const parts = base.split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return initials || 'CC';
}

export async function Topbar() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? '';
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? null;
  const initials = user ? getInitials(fullName, email) : 'CC';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a]/80 px-4 backdrop-blur lg:px-8">
      <MobileNav />

      <div className="hidden flex-1 md:flex">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            placeholder="Buscar clases, recursos, publicaciones..."
            className="w-full rounded-md border border-[rgba(212,175,55,0.15)] bg-[#111111] py-2 pl-9 pr-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.45)] focus:outline-none"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-[rgba(212,175,55,0.18)] p-2 text-brand-muted transition hover:text-brand-gold"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
        </button>
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
