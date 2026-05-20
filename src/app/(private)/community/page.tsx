import { PageHeader } from '@/components/layout/page-header';
import { COMMUNITY_CATEGORIES } from '@/constants/categories';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { PostComposer } from './_components/post-composer';
import { PostCard, type FeedPost } from './_components/post-card';

export const dynamic = 'force-dynamic';

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };

  const activeCat = searchParams.cat ?? null;

  let query = supabase
    .from('community_posts')
    .select(
      'id, user_id, category, title, content, media_url, media_type, youtube_url, is_pinned, created_at, profiles(full_name, avatar_url), post_likes(user_id), community_comments(id, content, created_at, profiles(full_name, avatar_url))'
    )
    .eq('is_deleted', false)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (activeCat && COMMUNITY_CATEGORIES.includes(activeCat as never)) {
    query = query.eq('category', activeCat);
  }

  const { data: rawPosts } = await query;

  const posts: FeedPost[] = (rawPosts ?? []).map((p: any) => {
    const likes: { user_id: string }[] = p.post_likes ?? [];
    const comments = (p.community_comments ?? [])
      .map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: {
          full_name: c.profiles?.full_name ?? null,
          avatar_url: c.profiles?.avatar_url ?? null,
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
      media_type: p.media_type,
      youtube_url: p.youtube_url,
      is_pinned: p.is_pinned,
      created_at: p.created_at,
      author: {
        full_name: p.profiles?.full_name ?? null,
        avatar_url: p.profiles?.avatar_url ?? null,
      },
      likes: likes.length,
      liked_by_me: user ? likes.some((l) => l.user_id === user.id) : false,
      comments,
    };
  });

  const userName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Tú';

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Comunidad privada"
        title="Feed de la sala"
        description="Comparte llamadas, dudas y resultados. La autoridad se construye en público."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="card-premium h-fit lg:sticky lg:top-6">
          <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Categorías
          </p>
          <ul className="space-y-1 text-sm">
            <li>
              <a
                href="/community"
                className={`block rounded-md px-2 py-1.5 transition ${
                  !activeCat
                    ? 'bg-[#181208] text-brand-gold'
                    : 'text-brand-muted hover:bg-[#181818] hover:text-brand-text'
                }`}
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
                    className={`block rounded-md px-2 py-1.5 transition ${
                      active
                        ? 'bg-[#181208] text-brand-gold'
                        : 'text-brand-muted hover:bg-[#181818] hover:text-brand-text'
                    }`}
                  >
                    {c}
                  </a>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="space-y-5">
          {user ? (
            <PostComposer userName={userName} />
          ) : (
            <div className="card-premium text-sm text-brand-muted">
              Inicia sesión para publicar en la comunidad.
            </div>
          )}

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
              <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

