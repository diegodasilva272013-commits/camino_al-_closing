import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  moderatorDeletePostAction,
  moderatorRestorePostAction,
  moderatorTogglePinAction,
  moderatorDeleteCommentAction,
} from '@/app/admin/actions';
import { Pin, PinOff, Trash2, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace instantes';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export default async function AdminCommunityPage() {
  const supabase = createSupabaseServerClient();

  const [postsRes, commentsRes] = await Promise.all([
    supabase
      .from('community_posts')
      .select(
        'id, title, content, category, is_pinned, is_deleted, created_at, profiles(full_name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('community_comments')
      .select('id, content, is_deleted, created_at, post_id, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const posts = (postsRes.data ?? []) as any[];
  const comments = (commentsRes.data ?? []) as any[];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Admin"
        title="Moderación de comunidad"
        description="Fijar, ocultar y restaurar publicaciones y comentarios."
      />

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
          Publicaciones recientes ({posts.length})
        </h2>
        <ul className="space-y-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className={
                'rounded border px-4 py-3 ' +
                (p.is_deleted
                  ? 'border-rose-900/40 bg-rose-950/20'
                  : 'border-[rgba(212,175,55,0.15)] bg-[#0d0d0d]')
              }
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-muted">
                <span className="rounded-full border border-[rgba(212,175,55,0.2)] px-2 py-0.5 text-brand-gold">
                  {p.category}
                </span>
                <span>{p.profiles?.full_name ?? p.profiles?.email ?? 'Anónimo'}</span>
                <span>· {timeAgo(p.created_at)}</span>
                {p.is_pinned && <span className="text-brand-gold">📌 Fijado</span>}
                {p.is_deleted && <span className="text-rose-400">Eliminado</span>}
              </div>
              <p className="text-sm font-medium text-brand-text">{p.title || '(sin título)'}</p>
              {p.content && (
                <p className="mt-1 line-clamp-2 text-xs text-brand-muted">{p.content}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={moderatorTogglePinAction.bind(null, p.id, !p.is_pinned)}>
                  <button className="inline-flex items-center gap-1 rounded border border-[rgba(212,175,55,0.2)] bg-[#111] px-2 py-1 text-[11px] text-brand-text hover:border-brand-gold hover:text-brand-gold">
                    {p.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {p.is_pinned ? 'Desfijar' : 'Fijar'}
                  </button>
                </form>
                {p.is_deleted ? (
                  <form action={moderatorRestorePostAction.bind(null, p.id)}>
                    <button className="inline-flex items-center gap-1 rounded border border-emerald-900/40 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-300 hover:border-emerald-700">
                      <RotateCcw className="h-3 w-3" /> Restaurar
                    </button>
                  </form>
                ) : (
                  <form action={moderatorDeletePostAction.bind(null, p.id)}>
                    <button className="inline-flex items-center gap-1 rounded border border-rose-900/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300 hover:border-rose-700">
                      <Trash2 className="h-3 w-3" /> Ocultar
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
          Comentarios recientes ({comments.length})
        </h2>
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={
                'rounded border px-4 py-3 ' +
                (c.is_deleted
                  ? 'border-rose-900/40 bg-rose-950/20'
                  : 'border-[rgba(212,175,55,0.15)] bg-[#0d0d0d]')
              }
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-muted">
                <span>{c.profiles?.full_name ?? c.profiles?.email ?? 'Anónimo'}</span>
                <span>· {timeAgo(c.created_at)}</span>
                {c.is_deleted && <span className="text-rose-400">Eliminado</span>}
              </div>
              {c.content && <p className="text-sm text-brand-text">{c.content}</p>}
              {!c.is_deleted && (
                <form
                  action={moderatorDeleteCommentAction.bind(null, c.id)}
                  className="mt-2"
                >
                  <button className="inline-flex items-center gap-1 rounded border border-rose-900/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300 hover:border-rose-700">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
