import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { getCurrentUserContext } from '@/lib/current-user';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext();
  const isAdmin = ctx?.isAdmin ?? false;

  return (
    <div className="flex min-h-screen bg-brand-black">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar isAdmin={isAdmin} />
        <main className="flex-1 px-4 py-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
