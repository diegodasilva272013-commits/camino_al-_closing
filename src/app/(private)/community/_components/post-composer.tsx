'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Image as ImageIcon,
  Video,
  Youtube,
  Type,
  Loader2,
  X,
} from 'lucide-react';
import { COMMUNITY_CATEGORIES } from '@/constants/categories';
import { createPostAction } from '../actions';

type Tab = 'text' | 'image' | 'video' | 'youtube';

const tabs: { id: Tab; label: string; icon: typeof Type }[] = [
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'image', label: 'Foto', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
];

export function PostComposer({ userName }: { userName: string }) {
  const [tab, setTab] = useState<Tab>('text');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(COMMUNITY_CATEGORIES[0]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setContent('');
    setTitle('');
    setYoutubeUrl('');
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('content', content);
    fd.set('title', title);
    fd.set('category', category);
    if (tab === 'youtube') fd.set('youtube_url', youtubeUrl);
    if ((tab === 'image' || tab === 'video') && file) fd.set('media', file);

    startTransition(async () => {
      const res = await createPostAction({}, fd);
      if (res.error) setError(res.error);
      else reset();
    });
  }

  const accept = tab === 'image' ? 'image/*' : tab === 'video' ? 'video/*' : '';

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] p-5 shadow-[0_20px_60px_-30px_rgba(212,175,55,0.25)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(212,175,55,0.35)] bg-[#111] text-sm font-semibold text-brand-gold">
          {userName.slice(0, 1).toUpperCase()}
        </div>
        <p className="text-sm text-brand-muted">
          ¿Qué quieres compartir hoy, <span className="text-brand-text">{userName.split(' ')[0]}</span>?
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
                if (t.id !== 'image' && t.id !== 'video') handleFile(null);
                if (t.id !== 'youtube') setYoutubeUrl('');
              }}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ' +
                (active
                  ? 'border border-brand-gold bg-[#1a1408] text-brand-gold'
                  : 'border border-[rgba(212,175,55,0.18)] text-brand-muted hover:border-[rgba(212,175,55,0.4)] hover:text-brand-text')
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text focus:border-brand-gold focus:outline-none"
        >
          {COMMUNITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder={
          tab === 'youtube'
            ? 'Cuéntales por qué deben verlo…'
            : 'Comparte tu experiencia, resultados o pregunta…'
        }
        className="mt-3 w-full resize-none rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
      />

      {tab === 'youtube' && (
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="mt-3 w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
        />
      )}

      {(tab === 'image' || tab === 'video') && (
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-brand-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-[rgba(212,175,55,0.35)] file:bg-[#111] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-gold hover:file:bg-[#1a1408]"
          />
          {preview && (
            <div className="relative mt-3 overflow-hidden rounded-lg border border-[rgba(212,175,55,0.2)]">
              <button
                type="button"
                onClick={() => handleFile(null)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1 text-brand-text hover:text-brand-gold"
                aria-label="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
              {tab === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="max-h-80 w-full object-contain bg-[#050505]" />
              ) : (
                <video src={preview} controls className="max-h-80 w-full bg-black" />
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
            </>
          ) : (
            'Publicar'
          )}
        </button>
      </div>
    </form>
  );
}
