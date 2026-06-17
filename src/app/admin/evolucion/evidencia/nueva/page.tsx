'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createEvidenciaAction } from '../../actions';
import { ArrowLeft, Loader2 } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-50"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'Guardando…' : 'Guardar y etiquetar comportamientos →'}
    </button>
  );
}

const TIPOS = [
  { value: 'conversacion', label: 'Conversación' },
  { value: 'reporte',      label: 'Reporte' },
  { value: 'simulacion',   label: 'Simulación' },
  { value: 'reunion',      label: 'Reunión' },
  { value: 'evaluacion',   label: 'Evaluación' },
];

function NuevaEvidenciaForm() {
  const searchParams = useSearchParams();
  const persona_id = searchParams.get('persona_id') ?? '';
  const [state, action] = useFormState(createEvidenciaAction, null);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <Link
        href={persona_id ? `/admin/evolucion/persona/${persona_id}` : '/admin/evolucion'}
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      <PageHeader
        eyebrow="Admin · Evolución"
        title="Cargar evidencia"
        description="Registrá una interacción o situación observable para etiquetar comportamientos."
      />

      <form action={action} className="mt-6 max-w-lg space-y-4">
        <input type="hidden" name="persona_id" value={persona_id} />

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Tipo de evidencia <span className="text-red-400">*</span>
          </label>
          <select
            name="tipo"
            required
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text focus:border-brand-gold/50 focus:outline-none"
          >
            <option value="">Seleccioná un tipo…</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Fecha <span className="text-red-400">*</span>
          </label>
          <input
            name="fecha"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text focus:border-brand-gold/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Resumen de lo observado <span className="text-red-400">*</span>
          </label>
          <textarea
            name="contenido_resumen"
            rows={4}
            required
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none resize-none"
            placeholder="Describí brevemente qué pasó en esta evidencia…"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Contexto adicional (opcional)
          </label>
          <textarea
            name="contexto_adicional"
            rows={2}
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none resize-none"
            placeholder="¿Hay algo más del contexto que sea relevante?"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}

export default function NuevaEvidenciaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaEvidenciaForm />
    </Suspense>
  );
}
