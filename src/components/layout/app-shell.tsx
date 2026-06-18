import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { getCurrentUserContext } from '@/lib/current-user';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { PushAutoPrompt } from '@/components/push-auto-prompt';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  const isAdmin = ctx?.isAdmin ?? false;
  const role = ctx?.role ?? 'student';

  let newSignupsToday = 0;
  if (isAdmin) {
    try {
      const admin = createSupabaseAdminClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      newSignupsToday = count ?? 0;
    } catch { /* silently ignore */ }
  }

  return (
    <div className="flex min-h-screen bg-brand-black">
      <Sidebar isAdmin={isAdmin} role={role} newSignupsToday={newSignupsToday} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar isAdmin={isAdmin} role={role} newSignupsToday={newSignupsToday} />
        <main className="flex-1 px-4 py-6 lg:px-10 lg:py-8">{children}</main>
      </div>
      <PushAutoPrompt />
    </div>
  );
}
