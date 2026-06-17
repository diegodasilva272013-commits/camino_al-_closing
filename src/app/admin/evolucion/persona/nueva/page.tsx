'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createPersonaAction } from '../../actions';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NuevaPersonaPage() {
  const [state, action, pending] = useActionState(createPersonaAction, null);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <Link
        href="/admin/evolucion"
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
      </Link>

      <PageHeader
        eyebrow="Admin · Evolución"
        title="Nueva persona"
        description="Registrá un setter para hacer seguimiento de su evolución."
      />

      <form action={action} className="mt-6 max-w-lg space-y-4">
        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Nombre completo <span className="text-red-400">*</span>
          </label>
          <input
            name="nombre"
            required
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none"
            placeholder="Ej: Martina García"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none"
            placeholder="setter@ejemplo.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Fecha de ingreso <span className="text-red-400">*</span>
          </label>
          <input
            name="fecha_ingreso"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text focus:border-brand-gold/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Rol actual
          </label>
          <input
            name="rol_actual"
            defaultValue="Setter"
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none"
            placeholder="Setter"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Objetivo actual
          </label>
          <textarea
            name="objetivo_actual"
            rows={3}
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none resize-none"
            placeholder="¿En qué está trabajando esta persona ahora?"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? 'Guardando…' : 'Crear persona'}
        </button>
      </form>
    </div>
  );
}
