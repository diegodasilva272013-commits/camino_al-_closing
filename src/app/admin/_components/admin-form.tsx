'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRef, useEffect } from 'react';
import type { AdminState } from '@/app/admin/actions';

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-gold disabled:opacity-60">
      {pending ? 'Guardando…' : label}
    </button>
  );
}

export function AdminForm({
  action,
  children,
  submitLabel = 'Guardar',
  resetOnSuccess = false,
}: {
  action: (state: AdminState, fd: FormData) => Promise<AdminState>;
  children: React.ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {children}
      {state.error && (
        <p className="rounded border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          Guardado correctamente.
        </p>
      )}
      <SubmitBtn label={submitLabel} />
    </form>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="w-full rounded border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.45)] focus:outline-none"
      />
      {hint && <span className="mt-1 block text-[10px] text-brand-muted/70">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 3,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-widest text-brand-muted">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="w-full rounded border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.45)] focus:outline-none"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-widest text-brand-muted">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? options[0]?.value}
        className="w-full rounded border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text focus:border-[rgba(212,175,55,0.45)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-brand-text">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-[rgba(212,175,55,0.3)] bg-[#0d0d0d] accent-brand-gold"
      />
      {label}
    </label>
  );
}

export function FileField({ label, name }: { label: string; name: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="file"
        name={name}
        className="block w-full text-xs text-brand-muted file:mr-3 file:rounded file:border-0 file:bg-[#1a1408] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-gold hover:file:bg-[#241a0c]"
      />
    </label>
  );
}

export function DeleteButton({
  action,
  confirm = '¿Eliminar este elemento?',
  children = 'Eliminar',
}: {
  action: () => Promise<void>;
  confirm?: string;
  children?: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded border border-rose-900/60 bg-rose-950/40 px-2.5 py-1 text-[11px] font-medium text-rose-300 transition hover:border-rose-700 hover:bg-rose-900/40"
      >
        {children}
      </button>
    </form>
  );
}
