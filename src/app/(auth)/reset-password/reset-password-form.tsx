'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { resetPasswordAction } from '../actions';
import type { AuthActionState } from '../types';

const initial: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold w-full" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar nueva contraseña'}
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(resetPasswordAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => router.push('/dashboard'), 2000);
      return () => clearTimeout(t);
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
          Nueva contraseña
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
          Repetir contraseña
        </label>
        <input
          type="password"
          name="password2"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Repetí la nueva contraseña"
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
        />
      </div>
      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] px-3 py-2 text-xs text-brand-gold">
          {state.message} Redirigiendo…
        </p>
      )}
      {!state.ok && <SubmitButton />}
    </form>
  );
}
