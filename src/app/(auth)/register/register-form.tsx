'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { registerAction } from '../actions';
import type { AuthActionState } from '../types';

const initial: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold w-full" disabled={pending}>
      {pending ? 'Creando…' : 'Crear cuenta'}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
          Nombre completo
        </label>
        <input
          type="text"
          name="full_name"
          required
          autoComplete="name"
          placeholder="Tu nombre"
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
        />
      </div>
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
      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
          Contraseña
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
          Código de acceso
        </label>
        <input
          type="text"
          name="access_code"
          required
          autoComplete="off"
          placeholder="Código que te dieron"
          className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none tracking-widest uppercase"
        />
        <p className="mt-1 text-[11px] text-brand-muted/60">
          Solicitalo al administrador si no lo tenés.
        </p>
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
