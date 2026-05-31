'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Pin,
  Play,
  FileText,
  Volume2,
} from 'lucide-react';
import { PostCard, type FeedPost, type MediaKind } from './post-card';
import { LevelBadge } from '@/components/community/level-badge';
import { Markdown } from '@/components/ui/markdown';
import { toggleLikeAction } from '../actions';

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'v'].includes(parts[0])) {
        return parts[1];
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'hace instantes';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
}

function ThumbAvatar({
  url,
  name,
  className = 'h-6 w-6 text-[10px]',
}: {
  url: string | null;
  name: string | null;
  className?: string;
}) {
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase();
  if (url) {
    return (
      <div
        className={`relative overflow-hidden rounded-full border border-black/30 ${className}`}
      >
        <Image src={url} alt={name ?? ''} fill className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full border border-black/30 bg-[#181818] font-semibold text-brand-gold ${className}`}
    >
      {initial}
    </div>
  );
}

function MediaThumbnail({
  url,
  type,
  ytId,
}: {
  url: string | null;
  type: MediaKind | null;
  ytId: string | null;
}) {
  // Tamaño fijo 132x132 al estilo Skool
  const wrap = 'relative h-[132px] w-[132px] shrink-0 overflow-hidden rounded-lg bg-[#0a0a0a]';
  if (!type) return null;
  if (type === 'youtube' && ytId) {
    return (
      <div className={wrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
          alt="YouTube"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70">
            <Play className="h-4 w-4 fill-white text-white" />
          </div>
        </div>
      </div>
    );
  }
  if (type === 'image' && url) {
    return (
      <div className={wrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  if (type === 'video' && url) {
    return (
      <div className={wrap}>
        <video src={url} className="h-full w-full object-cover" preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70">
            <Play className="h-4 w-4 fill-white text-white" />
          </div>
        </div>
      </div>
    );
  }
  if (type === 'document' && url) {
    return (
      <div className={`${wrap} flex items-center justify-center border border-[rgba(212,175,55,0.18)]`}>
        <FileText className="h-10 w-10 text-brand-gold" />
      </div>
    );
  }
  if (type === 'audio' && url) {
    return (
      <div className={`${wrap} flex items-center justify-center border border-[rgba(212,175,55,0.18)]`}>
        <Volume2 className="h-10 w-10 text-brand-gold" />
      </div>
    );
  }
  return null;
}

const CATEGORY_DOT: Record<string, string> = {
  Anuncios: 'bg-blue-500',
  Introducciones: 'bg-yellow-500',
  Preguntas: 'bg-pink-500',
  Wins: 'bg-orange-500',
  Recursos: 'bg-purple-500',
};

function categoryDotColor(cat: string): string {
  return CATEGORY_DOT[cat] ?? 'bg-brand-gold';
}

export function FeedPostCard({
  post,
  currentUserId,
}: {
  post: FeedPost;
  currentUserId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes);
  const [, startLike] = useTransition();

  const ytId = extractYoutubeId(post.youtube_url);
  const recentCommenters = Array.from(
    new Map(post.comments.map((c) => [c.author.id, c.author])).values()
  ).slice(-5);
  const lastComment = post.comments[post.comments.length - 1] ?? null;
  const dot = categoryDotColor(post.category);

  if (expanded) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-brand-muted hover:text-brand-text"
          >
            ← Volver al feed
          </button>
        </div>
        <PostCard post={{ ...post, likes, liked_by_me: liked }} currentUserId={currentUserId} />
      </div>
    );
  }

  function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId) return;
    setLiked((p) => !p);
    setLikes((n) => (liked ? n - 1 : n + 1));
    startLike(() => toggleLikeAction(post.id));
  }

  return (
    <article
      onClick={() => setExpanded(true)}
      className="card-premium cursor-pointer p-0 transition hover:border-[rgba(212,175,55,0.45)]"
    >
      <div className="flex gap-4 p-4">
        {/* Avatar */}
        <Link
          href={post.author.id ? `/u/${post.author.id}` : '#'}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <ThumbAvatar
            url={post.author.avatar_url}
            name={post.author.full_name}
            className="h-10 w-10 text-sm"
          />
        </Link>

        {/* Cuerpo */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Link
              href={post.author.id ? `/u/${post.author.id}` : '#'}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-brand-text hover:underline"
            >
              {post.author.full_name ?? 'Usuario'}
            </Link>
            <LevelBadge points={post.author.points ?? 0} size="xs" />
            <span className="text-brand-muted">·</span>
            <span className="text-brand-muted">{timeAgo(post.created_at)}</span>
            <span className="text-brand-muted">·</span>
            <span className="text-brand-muted">{post.category}</span>
            {post.is_pinned && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[rgba(212,175,55,0.4)] bg-[#1a1408] px-2 py-0.5 text-[10px] font-semibold text-brand-gold">
                <Pin className="h-2.5 w-2.5" /> Fijado
              </span>
            )}
          </div>

          {/* Layout título/contenido + thumbnail derecho */}
          <div className="mt-2 flex gap-3">
            <div className="min-w-0 flex-1">
              {post.title && (
                <h3 className="flex items-start gap-2 text-base font-semibold text-brand-text">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <span className="line-clamp-2">{post.title}</span>
                </h3>
              )}
              {post.content && (
                <div className="mt-1 line-clamp-3 text-sm text-brand-text/85">
                  <Markdown source={post.content} />
                </div>
              )}
            </div>

            {(post.media_type || ytId) && (
              <MediaThumbnail
                url={post.media_url}
                type={post.media_type}
                ytId={ytId}
              />
            )}
          </div>

          {/* Footer: like, comments, avatars, "Nuevo comentario hace…" */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={handleLike}
              className={
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ' +
                (liked
                  ? 'border-brand-gold bg-[#1a1408] text-brand-gold'
                  : 'border-white/10 text-brand-muted hover:border-brand-gold hover:text-brand-gold')
              }
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
              <span>{compactCount(likes)}</span>
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-brand-muted">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{compactCount(post.comments.length)}</span>
            </span>

            {recentCommenters.length > 0 && (
              <div className="flex -space-x-2">
                {recentCommenters.map((a, i) => (
                  <div key={`${a.id ?? 'a'}-${i}`} className="relative">
                    <ThumbAvatar
                      url={a.avatar_url}
                      name={a.full_name}
                      className="h-6 w-6 text-[9px]"
                    />
                  </div>
                ))}
              </div>
            )}

            {lastComment && (
              <span className="text-xs text-brand-gold hover:underline">
                Nuevo comentario {timeAgo(lastComment.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
