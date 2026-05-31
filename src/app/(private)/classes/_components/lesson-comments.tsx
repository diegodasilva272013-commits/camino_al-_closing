'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addLessonCommentAction, deleteLessonCommentAction } from '../actions';

type Comment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

function SubmitBtn({ label = 'Comentar' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? 'Enviando…' : label}
    </button>
  );
}

function CommentForm({
  lessonId,
  parentId,
  onDone,
  placeholder = 'Escribe tu pregunta o aporte…',
}: {
  lessonId: string;
  parentId?: string;
  onDone?: () => void;
  placeholder?: string;
}) {
  const action = addLessonCommentAction.bind(null, lessonId);
  const [state, formAction] = useFormState(action, {} as { ok?: boolean; error?: string });

  if (state.ok && onDone) {
    setTimeout(() => onDone(), 0);
  }

  return (
    <form action={formAction} className="space-y-2">
      {parentId ? <input type="hidden" name="parent_id" value={parentId} /> : null}
      <textarea
        name="content"
        rows={3}
        required
        maxLength={4000}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-brand-muted focus:border-brand-gold focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        {state.error ? (
          <p className="text-xs text-red-400">{state.error}</p>
        ) : (
          <span />
        )}
        <SubmitBtn />
      </div>
    </form>
  );
}

export function LessonComments({
  lessonId,
  comments,
  currentUserId,
  isAdmin = false,
}: {
  lessonId: string;
  comments: Comment[];
  currentUserId: string | null;
  isAdmin?: boolean;
}) {
  const top = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesByParent.get(c.parent_id) ?? [];
      arr.push(c);
      repliesByParent.set(c.parent_id, arr);
    }
  }

  return (
    <section className="card-premium space-y-4">
      <h3 className="text-base font-semibold text-white">
        Discusión <span className="text-brand-muted">({comments.length})</span>
      </h3>

      {currentUserId ? (
        <CommentForm lessonId={lessonId} />
      ) : (
        <p className="text-sm text-brand-muted">Inicia sesión para comentar.</p>
      )}

      <div className="divide-y divide-white/5">
        {top.length === 0 ? (
          <p className="py-4 text-sm text-brand-muted">
            Sé el primero en abrir la conversación.
          </p>
        ) : null}
        {top.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            replies={repliesByParent.get(c.id) ?? []}
            lessonId={lessonId}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </section>
  );
}

function CommentItem({
  comment,
  replies,
  lessonId,
  currentUserId,
  isAdmin,
}: {
  comment: Comment;
  replies: Comment[];
  lessonId: string;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const canDelete = currentUserId === comment.user_id || isAdmin;
  const name = comment.profiles?.full_name ?? 'Usuario';
  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        {comment.profiles?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.profiles.avatar_url}
            alt={name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-brand-gold/20 text-center text-xs font-semibold leading-8 text-brand-gold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-white">{name}</span>
            <span className="text-brand-muted">
              {new Date(comment.created_at).toLocaleString('es-AR')}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white/90">
            {comment.content}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            {currentUserId ? (
              <ReplyToggle lessonId={lessonId} parentId={comment.id} />
            ) : null}
            {canDelete ? (
              <form action={deleteLessonCommentAction.bind(null, comment.id, lessonId)}>
                <button
                  type="submit"
                  className="text-brand-muted hover:text-red-400"
                >
                  Eliminar
                </button>
              </form>
            ) : null}
          </div>

          {replies.length > 0 ? (
            <div className="mt-3 space-y-3 border-l border-white/10 pl-4">
              {replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  replies={[]}
                  lessonId={lessonId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplyToggle({ lessonId, parentId }: { lessonId: string; parentId: string }) {
  const [open, setOpen] = useToggle(false);
  return (
    <>
      <button onClick={() => setOpen()} className="text-brand-gold hover:underline">
        {open ? 'Cancelar' : 'Responder'}
      </button>
      {open ? (
        <div className="mt-2 w-full">
          <CommentForm
            lessonId={lessonId}
            parentId={parentId}
            placeholder="Tu respuesta…"
            onDone={() => setOpen()}
          />
        </div>
      ) : null}
    </>
  );
}

function useToggle(initial = false): [boolean, () => void] {
  const [v, setV] = useState(initial);
  return [v, () => setV((x) => !x)];
}
