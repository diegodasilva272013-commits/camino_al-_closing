'use client';

import { useTransition, useState } from 'react';
import { aprobarCandidatoAction, descartarCandidatoAction } from '../actions';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { CatalogoComportamiento, Capacidad } from '@/types/evolucion';

export function CatalogoClient({
  capacidades,
  aprobados,
  candidatos,
}: {
  capacidades: Capacidad[];
  aprobados: CatalogoComportamiento[];
  candidatos: CatalogoComportamiento[];
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string[]>(capacidades.map((c) => c.id));

  function toggle(id: string) {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function aprobar(id: string) {
    startTransition(() => aprobarCandidatoAction(id));
  }
  function descartar(id: string) {
    startTransition(() => descartarCandidatoAction(id));
  }

  // Group aprobados por capacidad
  const porCapacidad: Record<string, CatalogoComportamiento[]> = {};
  for (const c of aprobados) {
    const cap = (c.capacidad as any)?.id ?? c.capacidad_id;
    if (!porCapacidad[cap]) porCapacidad[cap] = [];
    porCapacidad[cap].push(c);
  }

  return (
    <div className="mt-6 max-w-4xl space-y-8">
      {/* Candidatos para revisión */}
      {candidatos.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-amber-950/50 border border-amber-700/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
              {candidatos.length} para revisar
            </span>
            <p className="text-xs text-brand-muted">Observados 3+ veces — decidí si los aprobás</p>
          </div>
          <div className="space-y-2">
            {candidatos.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-700/20 bg-amber-950/10 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.tipo === 'positivo' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                      {c.tipo}
                    </span>
                    <p className="text-sm font-medium text-brand-text">{c.etiqueta}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-brand-muted">
                    {(c.capacidad as any)?.nombre} · {c.veces_observado} veces observado
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => aprobar(c.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-950/60 transition disabled:opacity-40"
                  >
                    <Check className="h-3 w-3" /> Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => descartar(c.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/60 transition disabled:opacity-40"
                  >
                    <X className="h-3 w-3" /> Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidatos.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-4 text-xs text-brand-muted">
          No hay candidatos pendientes de revisión esta semana.
        </div>
      )}

      {/* Catálogo aprobado por capacidad */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-gold/50">
          Catálogo completo ({aprobados.length} comportamientos aprobados)
        </p>
        <div className="space-y-3">
          {capacidades.map((cap) => {
            const items = porCapacidad[cap.id] ?? [];
            const isOpen = expanded.includes(cap.id);
            const positivos = items.filter((i) => i.tipo === 'positivo');
            const negativos = items.filter((i) => i.tipo === 'negativo');

            return (
              <div key={cap.id} className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d]">
                <button
                  type="button"
                  onClick={() => toggle(cap.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-brand-muted" />
                      : <ChevronRight className="h-3.5 w-3.5 text-brand-muted" />}
                    <span className="text-sm font-semibold text-brand-text">{cap.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-400">{positivos.length}+</span>
                    <span className="text-red-400">{negativos.length}−</span>
                  </div>
                </button>

                {isOpen && items.length > 0 && (
                  <div className="border-t border-zinc-800/60 px-4 pb-3 pt-2 space-y-1.5">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.tipo === 'positivo' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-brand-muted">{item.etiqueta}</span>
                        {item.veces_observado > 0 && (
                          <span className="ml-auto text-[10px] text-brand-muted/50">×{item.veces_observado}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isOpen && items.length === 0 && (
                  <p className="border-t border-zinc-800/60 px-4 py-3 text-xs text-brand-muted/50">
                    Sin comportamientos aprobados en esta capacidad.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
