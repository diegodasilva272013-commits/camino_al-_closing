'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { forgotPasswordAction } from '../actions';
import type { AuthActionState } from '../types';

const initial: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold w-full" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar enlace'}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
          Email
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
        />
      </div>
      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="rounded-md border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] px-3 py-2 text-xs text-brand-gold">
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
