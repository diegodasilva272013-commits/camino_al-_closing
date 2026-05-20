'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, Check, AlertCircle, KeyRound } from 'lucide-react';
import { changePasswordAction, type ProfileActionState } from '../actions';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-brand-text transition hover:border-brand-gold hover:text-brand-gold disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <KeyRound className="h-4 w-4" />
      )}
      Cambiar contraseña
    </button>
  );
}

const initial: ProfileActionState = {};

export function PasswordForm() {
  const [state, formAction] = useFormState(changePasswordAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-3"
      key={state?.ok ? 'reset' : 'form'}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[11px] uppercase tracking-wider text-brand-muted"
          >
            Nueva contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
          />
        </div>
        <div>
          <label
            htmlFor="confirm"
            className="mb-1.5 block text-[11px] uppercase tracking-wider text-brand-muted"
          >
            Repetir contraseña
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            minLength={8}
            required
            placeholder="Repetí la nueva contraseña"
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
          />
        </div>
      </div>

      {state?.error && (
        <p className="inline-flex items-center gap-2 text-sm text-red-300">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p className="inline-flex items-center gap-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" /> {state.message}
        </p>
      )}

      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}
