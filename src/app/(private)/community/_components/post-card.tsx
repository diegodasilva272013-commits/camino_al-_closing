'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react';
import {
  toggleLikeAction,
  createCommentAction,
  deletePostAction,
} from '../actions';

export type FeedComment = {
  id: string;
  content: string;
  created_at: string;
  author: { full_name: string | null; avatar_url: string | null };
};

export type FeedPost = {
  id: string;
  user_id: string;
  category: string;
  title: string | null;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'youtube' | null;
  youtube_url: string | null;
  created_at: string;
  is_pinned: boolean;
  author: { full_name: string | null; avatar_url: string | null };
  likes: number;
  liked_by_me: boolean;
  comments: FeedComment[];
};

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

function Avatar({
  url,
  name,
  size = 'md',
}: {
  url: string | null;
  name: string | null;
  size?: 'sm' | 'md';
}) {
  const cls =
    size === 'sm'
      ? 'h-8 w-8 text-[11px]'
      : 'h-10 w-10 text-sm';
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase();
  if (url) {
    return (
      <div className={`relative ${cls} overflow-hidden rounded-full border border-[rgba(212,175,55,0.35)]`}>
        <Image src={url} alt={name ?? ''} fill className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${cls} flex items-center justify-center rounded-full border border-[rgba(212,175,55,0.35)] bg-[#111] font-semibold text-brand-gold`}
    >
      {initial}
    </div>
  );
}

export function PostCard({
  post,
  currentUserId,
}: {
  post: FeedPost;
  currentUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLiking, startLike] = useTransition();
  const [isCommenting, startComment] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const ytId = extractYoutubeId(post.youtube_url);
  const authorName = post.author.full_name ?? 'Anónimo';
  const isOwner = currentUserId === post.user_id;

  function onLike() {
    startLike(() => toggleLikeAction(post.id));
  }

  function onComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!comment.trim()) return;
    const fd = new FormData();
    fd.set('post_id', post.id);
    fd.set('content', comment);
    startComment(async () => {
      const res = await createCommentAction({}, fd);
      if (!res.error) setComment('');
    });
  }

  function onDelete() {
    if (!confirm('¿Eliminar esta publicación?')) return;
    startDelete(() => deletePostAction(post.id));
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] shadow-[0_20px_60px_-30px_rgba(212,175,55,0.25)]">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-3">
          <Avatar url={post.author.avatar_url} name={authorName} />
          <div>
            <p className="text-sm font-medium text-brand-text">{authorName}</p>
            <p className="text-[11px] text-brand-muted">
              {timeAgo(post.created_at)} ·{' '}
              <span className="text-brand-gold/80">{post.category}</span>
              {post.is_pinned && (
                <span className="ml-2 rounded-full border border-brand-gold/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-gold">
                  Destacado
                </span>
              )}
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md p-1 text-brand-muted hover:text-brand-text"
              aria-label="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  disabled={isDeleting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 px-5 pb-4">
        {post.title && (
          <h3 className="text-lg font-semibold text-brand-text">
            {post.title}
          </h3>
        )}
        {post.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text/90">
            {post.content}
          </p>
        )}
      </div>

      {post.media_type === 'image' && post.media_url && (
        <div className="relative bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.media_url}
            alt={post.title ?? 'Publicación'}
            className="max-h-[600px] w-full object-contain"
          />
        </div>
      )}

      {post.media_type === 'video' && post.media_url && (
        <video
          src={post.media_url}
          controls
          className="max-h-[600px] w-full bg-black"
        />
      )}

      {post.media_type === 'youtube' && ytId && (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-[rgba(212,175,55,0.1)] px-5 py-3 text-xs text-brand-muted">
        <button
          type="button"
          onClick={onLike}
          disabled={isLiking}
          className={`inline-flex items-center gap-1.5 transition ${
            post.liked_by_me ? 'text-brand-gold' : 'hover:text-brand-text'
          }`}
        >
          <Heart
            className={`h-4 w-4 ${post.liked_by_me ? 'fill-brand-gold' : ''}`}
          />
          {post.likes}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 hover:text-brand-text"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comments.length}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-[rgba(212,175,55,0.1)] bg-[#0a0a0a] px-5 py-4">
          {post.comments.length === 0 && (
            <p className="text-xs text-brand-muted">Sé el primero en comentar.</p>
          )}
          <ul className="space-y-3">
            {post.comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar
                  url={c.author.avatar_url}
                  name={c.author.full_name}
                  size="sm"
                />
                <div className="flex-1 rounded-lg border border-[rgba(212,175,55,0.12)] bg-[#0c0c0c] px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-medium text-brand-text">
                      {c.author.full_name ?? 'Anónimo'}
                    </span>
                    <span className="text-brand-muted">
                      · {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-brand-text/90">
                    {c.content}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={onComment} className="flex items-center gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe un comentario…"
              className="flex-1 rounded-full border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] px-4 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={isCommenting || !comment.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-gradient text-[#0a0a0a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Enviar"
            >
              {isCommenting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
