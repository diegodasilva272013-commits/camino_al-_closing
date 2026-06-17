'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createIntervencionAction } from '../../actions';
import { ArrowLeft, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-50"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'Guardando…' : 'Registrar intervención'}
    </button>
  );
}

const TIPOS = [
  { value: 'roleplay',      label: 'Roleplay', desc: 'Práctica de conversación en vivo' },
  { value: 'simulacion_ia', label: 'Simulación IA', desc: 'Práctica con el Trainer IA' },
  { value: 'correccion',    label: 'Corrección', desc: 'Feedback directo sobre un error' },
  { value: 'clase',         label: 'Clase', desc: 'Sesión de entrenamiento grupal o individual' },
  { value: 'mentoria',      label: 'Mentoría', desc: 'Sesión de acompañamiento 1:1' },
];

export function IntervencionClient({
  patron,
  persona,
}: {
  patron: any;
  persona: any;
}) {
  const [state, action] = useFormState(createIntervencionAction, null);

  const tendencia = patron.tendencia ?? 'estable';

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <Link
        href={`/admin/evolucion/persona/${persona.id}`}
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al perfil de {persona.nombre}
      </Link>

      <PageHeader
        eyebrow="Admin · Evolución"
        title="Asignar intervención"
        description={`Para el patrón detectado en ${persona.nombre}`}
      />

      {/* Resumen del patrón */}
      <div className="mt-2 max-w-lg rounded-xl border border-[rgba(212,175,55,0.15)] bg-[rgba(212,175,55,0.04)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-brand-gold/50 mb-1">Patrón a intervenir</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-brand-text">{patron.etiqueta}</p>
          <span className="flex items-center gap-1 text-[10px]">
            {tendencia === 'aumentando'   && <><TrendingUp   className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Aumentando</span></>}
            {tendencia === 'disminuyendo' && <><TrendingDown className="h-3 w-3 text-red-400" /><span className="text-red-400">Disminuyendo</span></>}
            {tendencia === 'estable'      && <><Minus        className="h-3 w-3 text-zinc-400" /><span className="text-zinc-400">Estable</span></>}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-brand-muted">
          {patron.capacidad?.nombre} · ×{patron.frecuencia} veces observado
        </p>
      </div>

      <form action={action} className="mt-6 max-w-lg space-y-5">
        <input type="hidden" name="persona_id"   value={persona.id} />
        <input type="hidden" name="patron_id"    value={patron.id} />
        <input type="hidden" name="capacidad_id" value={patron.capacidad?.id ?? ''} />

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-2">
            Tipo de intervención <span className="text-red-400">*</span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIPOS.map((t) => (
              <label
                key={t.value}
                className="relative flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-[#0d0d0d] p-3 transition has-[:checked]:border-brand-gold/40 has-[:checked]:bg-brand-gold/10"
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t.value}
                  required
                  className="mt-0.5 accent-brand-gold"
                />
                <div>
                  <p className="text-xs font-semibold text-brand-text">{t.label}</p>
                  <p className="text-[10px] text-brand-muted">{t.desc}</p>
                </div>
              </label>
            ))}
          </div>
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
            Resultado observado (opcional)
          </label>
          <textarea
            name="resultado_observado"
            rows={3}
            className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none resize-none"
            placeholder="¿Qué cambió después de la intervención? Podés completarlo más tarde."
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
