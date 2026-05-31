import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  LevelProgressCard,
} from '@/components/community/level-badge';
import { Globe, Instagram, MapPin, Phone, Mail } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PublicProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, avatar_url, bio, role, points, phone, city, country, website, instagram, is_public, created_at'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!profile) notFound();
  const p = profile as any;
  const isOwner = viewer?.id === p.id;

  if (!p.is_public && !isOwner) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Perfil"
          title="Este perfil es privado"
          description="El usuario decidió ocultar su perfil de la comunidad."
        />
        <Link
          href="/community"
          className="inline-block text-sm text-brand-gold underline-offset-4 hover:underline"
        >
          ← Volver al feed
        </Link>
      </div>
    );
  }

  const displayName = p.full_name?.trim() || 'Miembro de la comunidad';
  const initial = (p.full_name?.trim()?.charAt(0) ?? '?').toUpperCase();

  // últimos posts del usuario
  const { data: posts } = await supabase
    .from('community_posts')
    .select('id, category, title, content, media_url, media_type, created_at')
    .eq('user_id', p.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10);

  const [{ count: postsCount }, { count: commentsCount }] = await Promise.all([
    supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.id)
      .eq('is_deleted', false),
    supabase
      .from('community_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.id),
  ]);

  const { data: likeRows } = await supabase
    .from('post_likes')
    .select('post_id, community_posts!inner(user_id)')
    .eq('community_posts.user_id', p.id);
  const likesReceived = likeRows?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/community"
        className="mb-4 inline-block text-xs text-brand-muted hover:text-brand-gold"
      >
        ← Volver al feed
      </Link>

      {/* Hero */}
      <div className="card-premium relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 via-transparent to-transparent" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-brand-gold/60 bg-[#181818] shadow-[0_0_30px_-8px_rgba(212,175,55,0.6)]">
            {p.avatar_url ? (
              <Image src={p.avatar_url} alt={displayName} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-brand-gold">
                {initial}
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-brand-text">{displayName}</h1>
            {p.role && (
              <span className="mt-1 inline-block rounded-full border border-brand-gold/30 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-brand-gold">
                {p.role}
              </span>
            )}
            {p.bio && (
              <p className="mt-3 max-w-xl whitespace-pre-wrap text-sm text-brand-text/90">
                {p.bio}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-brand-muted sm:justify-start">
              {(p.city || p.country) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[p.city, p.country].filter(Boolean).join(', ')}
                </span>
              )}
              {p.website && (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-brand-gold"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Sitio web
                </a>
              )}
              {p.instagram && (
                <a
                  href={`https://instagram.com/${p.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-brand-gold"
                >
                  <Instagram className="h-3.5 w-3.5" />@{p.instagram}
                </a>
              )}
              {isOwner && p.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {p.phone}
                </span>
              )}
              {isOwner && p.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {p.email}
                </span>
              )}
            </div>
          </div>
          {isOwner && (
            <Link
              href="/profile"
              className="btn-gold whitespace-nowrap text-xs"
            >
              Editar perfil
            </Link>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <LevelProgressCard points={p.points ?? 0} className="md:col-span-2" />
        <div className="grid grid-cols-3 gap-1 sm:gap-2 md:col-span-1 md:grid-cols-1">
          <Stat label="Posts" value={postsCount ?? 0} />
          <Stat label="Comentarios" value={commentsCount ?? 0} />
          <Stat label="Likes" value={likesReceived} />
        </div>
      </div>

      {/* Últimos posts */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-muted">
          Últimas publicaciones
        </h2>
        {!posts || posts.length === 0 ? (
          <div className="card-premium text-center text-sm text-brand-muted">
            Aún no hay publicaciones.
          </div>
        ) : (
          <ul className="space-y-3">
            {posts.map((post: any) => (
              <li
                key={post.id}
                className="rounded-xl border border-[rgba(212,175,55,0.15)] bg-[#0c0c0c] p-4"
              >
                <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                  <span className="text-brand-gold/80">{post.category}</span>
                  <span>·</span>
                  <span>
                    {new Date(post.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {post.title && (
                  <h3 className="mt-1 text-sm font-semibold text-brand-text">
                    {post.title}
                  </h3>
                )}
                {post.content && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-brand-text/85">
                    {post.content}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] p-3 text-center">
      <p className="text-lg font-bold text-brand-gold">
        {value.toLocaleString('es-ES')}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-brand-muted">{label}</p>
    </div>
  );
}
