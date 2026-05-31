import { COMMUNITY_CATEGORIES } from '@/constants/categories';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ComposerTrigger } from './_components/composer-trigger';
import { EventBanner } from './_components/event-banner';
import { FeedPostCard } from './_components/feed-post';
import {
  GroupSidebar,
  type SidebarLeader,
  type SidebarMember,
  type SidebarLink,
} from './_components/group-sidebar';
import type { FeedPost, MediaKind } from './_components/post-card';

export const dynamic = 'force-dynamic';

const QUICK_LINKS: SidebarLink[] = [
  { label: 'Empieza aquí (Onboarding)', href: '/dashboard', emoji: '🚀' },
  { label: 'Clases', href: '/classes', emoji: '🎓' },
  { label: 'Calendario de eventos', href: '/calendar', emoji: '📅' },
  { label: 'Recursos', href: '/resources', emoji: '📂' },
];

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeCat = searchParams.cat ?? null;

  let query = supabase
    .from('community_posts')
    .select(
      'id, user_id, category, title, content, media_url, media_type, youtube_url, is_pinned, created_at, profiles(id, full_name, avatar_url, points), post_likes(user_id), community_comments(id, content, media_url, media_type, created_at, profiles(id, full_name, avatar_url, points))'
    )
    .eq('is_deleted', false)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (activeCat && COMMUNITY_CATEGORIES.includes(activeCat as never)) {
    query = query.eq('category', activeCat);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const [
    rawPostsRes,
    profileRes,
    membersCountRes,
    adminsCountRes,
    onlineTodayRes,
    recentMembersRes,
    upcomingEventRes,
    topRes,
  ] = await Promise.all([
    query,
    user
      ? supabase
          .from('profiles')
          .select('full_name, avatar_url, role')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin'),
    (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('last_active_date', todayIso),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('events')
      .select('id, title, start_time')
      .eq('status', 'active')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    (supabase as any).rpc('leaderboard_window', { p_days: 30 }),
  ]);

  const rawPosts = rawPostsRes.data;
  const profile = (profileRes as any)?.data ?? null;
  const isAdmin = profile?.role === 'admin';

  const posts: FeedPost[] = (rawPosts ?? []).map((p: any) => {
    const likes: { user_id: string }[] = p.post_likes ?? [];
    const comments = (p.community_comments ?? [])
      .map((c: any) => ({
        id: c.id,
        content: c.content,
        media_url: c.media_url,
        media_type: c.media_type as MediaKind | null,
        created_at: c.created_at,
        author: {
          id: c.profiles?.id ?? null,
          full_name: c.profiles?.full_name ?? null,
          avatar_url: c.profiles?.avatar_url ?? null,
          points: c.profiles?.points ?? 0,
        },
      }))
      .sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    return {
      id: p.id,
      user_id: p.user_id,
      category: p.category,
      title: p.title,
      content: p.content,
      media_url: p.media_url,
      media_type: p.media_type as MediaKind | null,
      youtube_url: p.youtube_url,
      is_pinned: p.is_pinned,
      created_at: p.created_at,
      author: {
        id: p.profiles?.id ?? p.user_id,
        full_name: p.profiles?.full_name ?? null,
        avatar_url: p.profiles?.avatar_url ?? null,
        points: p.profiles?.points ?? 0,
      },
      likes: likes.length,
      liked_by_me: user ? likes.some((l) => l.user_id === user.id) : false,
      comments,
    };
  });

  const userName =
    profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Tú';
  const userAvatar = profile?.avatar_url ?? null;

  const recentMembers: SidebarMember[] = ((recentMembersRes.data as any) ?? []).map(
    (m: any) => ({ id: m.id, full_name: m.full_name, avatar_url: m.avatar_url })
  );

  const topMembers: SidebarLeader[] = (((topRes as any)?.data as any[]) ?? [])
    .slice(0, 5)
    .map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      avatar_url: r.avatar_url,
      points: r.points,
      rank: r.rank,
    }));

  const upcomingEvent = (upcomingEventRes as any)?.data as
    | { id: string; title: string; start_time: string }
    | null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Columna principal */}
        <div className="space-y-4">
          {user ? (
            <ComposerTrigger userName={userName} avatarUrl={userAvatar} />
          ) : (
            <div className="card-premium text-sm text-brand-muted">
              Inicia sesión para publicar en la comunidad.
            </div>
          )}

          {upcomingEvent && (
            <EventBanner
              title={upcomingEvent.title}
              startTimeIso={upcomingEvent.start_time}
            />
          )}

          {/* Pills categorías */}
          <nav className="-mx-1 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-2 px-1">
              <li>
                <a
                  href="/community"
                  className={
                    'inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition ' +
                    (!activeCat
                      ? 'border-brand-gold bg-[#1a1408] text-brand-gold'
                      : 'border-[rgba(212,175,55,0.18)] text-brand-muted hover:border-[rgba(212,175,55,0.4)] hover:text-brand-text')
                  }
                >
                  Todas
                </a>
              </li>
              {COMMUNITY_CATEGORIES.map((c) => {
                const active = activeCat === c;
                return (
                  <li key={c}>
                    <a
                      href={`/community?cat=${encodeURIComponent(c)}`}
                      className={
                        'inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition ' +
                        (active
                          ? 'border-brand-gold bg-[#1a1408] text-brand-gold'
                          : 'border-[rgba(212,175,55,0.18)] text-brand-muted hover:border-[rgba(212,175,55,0.4)] hover:text-brand-text')
                      }
                    >
                      {c}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Feed */}
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className="card-premium text-center">
                <p className="text-sm text-brand-text">
                  Aún no hay publicaciones en esta categoría.
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  Sé el primero en arrancar la conversación.
                </p>
              </div>
            ) : (
              posts.map((p) => (
                <FeedPostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <GroupSidebar
          stats={{
            members: membersCountRes.count ?? 0,
            online: (onlineTodayRes as any).count ?? 0,
            admins: adminsCountRes.count ?? 0,
          }}
          recentMembers={recentMembers}
          topMembers={topMembers}
          links={QUICK_LINKS}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
