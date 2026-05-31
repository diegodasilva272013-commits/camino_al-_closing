'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveLessonNoteAction } from '../actions';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost-gold" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar nota'}
    </button>
  );
}

export function LessonNotes({
  lessonId,
  initialContent,
}: {
  lessonId: string;
  initialContent: string;
}) {
  const action = saveLessonNoteAction.bind(null, lessonId);
  const [state, formAction] = useFormState(action, {} as { ok?: boolean; error?: string });

  return (
    <form action={formAction} className="card-premium space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Mis notas</h3>
        {state.ok ? (
          <span className="text-xs text-emerald-400">Guardado ✓</span>
        ) : state.error ? (
          <span className="text-xs text-red-400">{state.error}</span>
        ) : null}
      </div>
      <textarea
        name="content"
        defaultValue={initialContent}
        rows={6}
        placeholder="Tus apuntes son privados — solo vos los ves."
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-brand-muted focus:border-brand-gold focus:outline-none"
      />
      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}
