import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ChatShell } from './_components/chat-shell';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/chat');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="-mx-4 -mt-4 h-[calc(100vh-64px)] sm:-mx-6 lg:-mx-8">
      <ChatShell
        currentUser={{
          id: user.id,
          full_name: (profile as any)?.full_name ?? null,
          avatar_url: (profile as any)?.avatar_url ?? null,
        }}
        initialConvId={searchParams.c ?? null}
      />
    </div>
  );
}
