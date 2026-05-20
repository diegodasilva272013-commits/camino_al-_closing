'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Send,
  Loader2,
  Smile,
  ImagePlus,
  FileText,
  Download,
} from 'lucide-react';
import {
  toggleLikeAction,
  createCommentAction,
  deletePostAction,
} from '../actions';
import { EmojiPicker, VoiceRecorder, GifPicker } from './comment-extras';

export type MediaKind = 'image' | 'video' | 'youtube' | 'document' | 'audio';

export type FeedComment = {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: MediaKind | null;
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
  media_type: MediaKind | null;
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

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split('/').pop() ?? 'archivo');
  } catch {
    return 'archivo';
  }
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
  const cls = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm';
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase();
  if (url) {
    return (
      <div
        className={`relative ${cls} overflow-hidden rounded-full border border-[rgba(212,175,55,0.35)]`}
      >
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

function MediaBlock({
  url,
  type,
  ytId,
}: {
  url: string | null;
  type: MediaKind | null;
  ytId?: string | null;
}) {
  if (!type) return null;
  if (type === 'image' && url) {
    return (
      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Imagen"
          className="max-h-[600px] w-full object-contain"
        />
      </div>
    );
  }
  if (type === 'video' && url) {
    return (
      <video src={url} controls className="max-h-[600px] w-full bg-black" />
    );
  }
  if (type === 'audio' && url) {
    return (
      <div className="bg-[#0a0a0a] px-5 py-3">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  if (type === 'document' && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mx-5 mb-1 flex items-center gap-3 rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] px-4 py-3 text-sm text-brand-text transition hover:border-brand-gold"
      >
        <FileText className="h-5 w-5 text-brand-gold" />
        <span className="truncate">{fileNameFromUrl(url)}</span>
        <Download className="ml-auto h-4 w-4 text-brand-muted" />
      </a>
    );
  }
  if (type === 'youtube' && ytId) {
    return (
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title="YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  return null;
}

function CommentComposer({ postId }: { postId: string }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [gif, setGif] = useState<{ url: string; alt: string } | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(accept: string) {
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.accept = accept;
      setTimeout(() => fileRef.current?.click(), 0);
    }
  }

  function handleFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f) setGif(null);
  }

  function handleGif(g: { url: string; alt: string }) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setGif(g);
  }

  function reset() {
    setText('');
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setGif(null);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim() && !file && !gif) return;
    const fd = new FormData();
    fd.set('post_id', postId);
    fd.set('content', text);
    if (file) fd.set('media', file);
    if (gif) fd.set('gif_url', gif.url);
    startTransition(async () => {
      const res = await createCommentAction({}, fd);
      if (!res.error) reset();
    });
  }

  const isImage = file?.type.startsWith('image/');
  const isAudio = file?.type.startsWith('audio/');

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {gif && (
        <div className="relative inline-block rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] p-2">
          <button
            type="button"
            onClick={() => setGif(null)}
            className="absolute -right-2 -top-2 rounded-full bg-black/80 p-0.5 text-brand-text hover:text-red-300"
            aria-label="Quitar GIF"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gif.url}
            alt={gif.alt}
            className="max-h-40 rounded object-contain"
          />
        </div>
      )}

      {file && (
        <div className="relative inline-block rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] p-2">
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="absolute -right-2 -top-2 rounded-full bg-black/80 p-0.5 text-brand-text hover:text-red-300"
            aria-label="Quitar"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {isImage && preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Preview"
              className="max-h-40 rounded object-contain"
            />
          )}
          {isAudio && preview && (
            <audio src={preview} controls className="h-8" />
          )}
          {!isImage && !isAudio && (
            <div className="flex items-center gap-2 px-1 text-xs text-brand-text">
              <FileText className="h-4 w-4 text-brand-gold" />
              <span className="truncate max-w-[200px]">{file.name}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setShowEmoji((v) => !v);
              setShowGif(false);
            }}
            title="Emojis"
            className="rounded-full border border-[rgba(212,175,55,0.18)] p-2 text-brand-muted transition hover:border-brand-gold hover:text-brand-gold"
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onPick={(e) => {
                setText((t) => t + e);
                inputRef.current?.focus();
              }}
              onClose={() => setShowEmoji(false)}
            />
          )}
          <button
            type="button"
            onClick={() => {
              setShowGif((v) => !v);
              setShowEmoji(false);
            }}
            title="GIF (Tenor)"
            className="rounded-full border border-[rgba(212,175,55,0.18)] px-2 py-1 text-[10px] font-bold tracking-wider text-brand-muted transition hover:border-brand-gold hover:text-brand-gold"
          >
            GIF
          </button>
          {showGif && (
            <GifPicker onPick={handleGif} onClose={() => setShowGif(false)} />
          )}
          <button
            type="button"
            onClick={() => pickFile('image/*')}
            title="Foto"
            className="rounded-full border border-[rgba(212,175,55,0.18)] p-2 text-brand-muted transition hover:border-brand-gold hover:text-brand-gold"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <VoiceRecorder onChange={(f) => handleFile(f)} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un comentario…"
          className="flex-1 rounded-full border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] px-4 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || (!text.trim() && !file && !gif)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-gradient text-[#0a0a0a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Enviar"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </form>
  );
}

function CommentItem({ c }: { c: FeedComment }) {
  const hasContent = c.content && c.content.trim().length > 0;
  return (
    <li className="flex gap-3">
      <Avatar url={c.author.avatar_url} name={c.author.full_name} size="sm" />
      <div className="flex-1 rounded-lg border border-[rgba(212,175,55,0.12)] bg-[#0c0c0c] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-medium text-brand-text">
            {c.author.full_name ?? 'Anónimo'}
          </span>
          <span className="text-brand-muted">· {timeAgo(c.created_at)}</span>
        </div>
        {hasContent && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-brand-text/90">
            {c.content}
          </p>
        )}
        {c.media_url && c.media_type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.media_url}
            alt="Adjunto"
            className="mt-2 max-h-72 rounded-md object-contain"
          />
        )}
        {c.media_url && c.media_type === 'audio' && (
          <audio src={c.media_url} controls className="mt-2 h-8 w-full max-w-xs" />
        )}
        {c.media_url && c.media_type === 'video' && (
          <video
            src={c.media_url}
            controls
            className="mt-2 max-h-72 w-full rounded-md bg-black"
          />
        )}
        {c.media_url && c.media_type === 'document' && (
          <a
            href={c.media_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] px-3 py-1.5 text-xs text-brand-text hover:border-brand-gold"
          >
            <FileText className="h-3.5 w-3.5 text-brand-gold" />
            {fileNameFromUrl(c.media_url)}
          </a>
        )}
      </div>
    </li>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLiking, startLike] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const ytId = extractYoutubeId(post.youtube_url);
  const authorName = post.author.full_name ?? 'Anónimo';
  const isOwner = currentUserId === post.user_id;

  function onLike() {
    startLike(() => toggleLikeAction(post.id));
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
          <h3 className="text-lg font-semibold text-brand-text">{post.title}</h3>
        )}
        {post.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text/90">
            {post.content}
          </p>
        )}
      </div>

      <MediaBlock url={post.media_url} type={post.media_type} ytId={ytId} />

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
            <p className="text-xs text-brand-muted">
              Sé el primero en comentar.
            </p>
          )}
          <ul className="space-y-3">
            {post.comments.map((c) => (
              <CommentItem key={c.id} c={c} />
            ))}
          </ul>

          {currentUserId ? (
            <CommentComposer postId={post.id} />
          ) : (
            <p className="text-xs text-brand-muted">
              Inicia sesión para comentar.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
