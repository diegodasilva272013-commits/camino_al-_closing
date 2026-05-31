'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTransition } from 'react';
import type { AdminState } from '@/app/admin/actions';

type Lesson = { id: string; title: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? 'Guardando…' : label}
    </button>
  );
}

export function QuizForm({
  action,
  lessons,
}: {
  action: (prev: AdminState, fd: FormData) => Promise<AdminState>;
  lessons: Lesson[];
}) {
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase text-brand-muted">Título</span>
          <input
            name="title"
            required
            maxLength={200}
            className="mt-1 w-full rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase text-brand-muted">Lección</span>
          <select
            name="lesson_id"
            className="mt-1 w-full rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text"
          >
            <option value="">— sin lección —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs uppercase text-brand-muted">Descripción</span>
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text"
        />
      </label>
      <label className="block w-40">
        <span className="text-xs uppercase text-brand-muted">% para aprobar</span>
        <input
          name="pass_score"
          type="number"
          min={0}
          max={100}
          defaultValue={70}
          className="mt-1 w-full rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text"
        />
      </label>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-400">Guardado ✓</p>}
      <SubmitButton label="Crear quiz" />
    </form>
  );
}

export function QuestionForm({
  action,
  quizId,
}: {
  action: (prev: AdminState, fd: FormData) => Promise<AdminState>;
  quizId: string;
}) {
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3 rounded border border-white/5 bg-[#0a0a0a] p-3">
      <input type="hidden" name="quiz_id" value={quizId} />
      <label className="block">
        <span className="text-xs uppercase text-brand-muted">Pregunta</span>
        <textarea
          name="question"
          required
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded border border-white/10 bg-[#111] px-3 py-2 text-sm text-brand-text"
        />
      </label>
      <label className="block">
        <span className="text-xs uppercase text-brand-muted">
          Opciones (JSON, array de {`{id,label}`})
        </span>
        <textarea
          name="options"
          required
          rows={4}
          maxLength={4000}
          defaultValue={'[\n  {"id":"a","label":"Opción A"},\n  {"id":"b","label":"Opción B"},\n  {"id":"c","label":"Opción C"}\n]'}
          className="mt-1 w-full rounded border border-white/10 bg-[#111] px-3 py-2 font-mono text-xs text-brand-text"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-xs uppercase text-brand-muted">id correcto</span>
          <input
            name="correct_option_id"
            required
            maxLength={50}
            className="mt-1 w-full rounded border border-white/10 bg-[#111] px-3 py-2 text-sm text-brand-text"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase text-brand-muted">Orden</span>
          <input
            name="order_index"
            type="number"
            defaultValue={0}
            className="mt-1 w-full rounded border border-white/10 bg-[#111] px-3 py-2 text-sm text-brand-text"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase text-brand-muted">Explicación</span>
          <input
            name="explanation"
            maxLength={1000}
            className="mt-1 w-full rounded border border-white/10 bg-[#111] px-3 py-2 text-sm text-brand-text"
          />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-400">Pregunta agregada ✓</p>}
      <SubmitButton label="Agregar pregunta" />
    </form>
  );
}

export function DeleteButton({
  id,
  action,
  label,
}: {
  id: string;
  action: (id: string) => Promise<void>;
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('¿Eliminar? Esta acción no se puede deshacer.')) return;
        start(() => action(id));
      }}
      className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
    >
      {pending ? '…' : label}
    </button>
  );
}
