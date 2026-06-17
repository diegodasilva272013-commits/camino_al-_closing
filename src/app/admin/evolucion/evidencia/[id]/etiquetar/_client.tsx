'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createComportamientosAction } from '../../../actions';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import type { CatalogoComportamiento, Capacidad } from '@/types/evolucion';

type SelectedItem = {
  catalogo_id: string;
  capacidad_id: string;
  etiqueta: string;
  tipo: string;
  momento_descripcion?: string;
};

export function EtiquetadoClient({
  evidencia,
  capacidades,
  catalogo,
}: {
  evidencia: any;
  capacidades: Capacidad[];
  catalogo: CatalogoComportamiento[];
}) {
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [momentos, setMomentos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(item: CatalogoComportamiento) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = {
          catalogo_id:  item.id,
          capacidad_id: item.capacidad_id,
          etiqueta:     item.etiqueta,
          tipo:         item.tipo,
        };
      }
      return next;
    });
  }

  function handleSubmit() {
    const items = Object.entries(selected).map(([cid, item]) => ({
      ...item,
      momento_descripcion: momentos[cid] ?? '',
    }));

    if (!items.length) {
      setError('Seleccioná al menos un comportamiento.');
      return;
    }

    const fd = new FormData();
    fd.set('evidencia_id', evidencia.id);
    fd.set('persona_id', evidencia.persona?.id ?? evidencia.persona_id);
    fd.set('items', JSON.stringify(items));

    setError(null);
    startTransition(async () => {
      const res = await createComportamientosAction(null, fd);
      if (res?.error) setError(res.error);
    });
  }

  // Group catalogo by capacidad
  const porCapacidad: Record<string, CatalogoComportamiento[]> = {};
  for (const c of catalogo) {
    const cap = (c.capacidad as any)?.id ?? c.capacidad_id;
    if (!porCapacidad[cap]) porCapacidad[cap] = [];
    porCapacidad[cap].push(c);
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <Link
        href={`/admin/evolucion/persona/${evidencia.persona?.id ?? evidencia.persona_id}`}
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al perfil
      </Link>

      <PageHeader
        eyebrow="Admin · Evolución"
        title="Etiquetar comportamientos"
        description={`Evidencia: ${evidencia.tipo} del ${new Date(evidencia.fecha).toLocaleDateString('es-AR')}`}
      />

      {evidencia.contenido_resumen && (
        <div className="mt-2 max-w-2xl rounded-xl border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.03)] px-4 py-3">
          <p className="text-xs text-brand-muted">{evidencia.contenido_resumen}</p>
        </div>
      )}

      <div className="mt-6 max-w-3xl space-y-6">
        {capacidades.map((cap) => {
          const items = porCapacidad[cap.id] ?? [];
          if (!items.length) return null;
          return (
            <div key={cap.id}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-gold/60">
                {cap.nombre}
              </p>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const isSelected = !!selected[item.id];
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        className={
                          'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ' +
                          (isSelected
                            ? 'border-brand-gold/40 bg-brand-gold/10'
                            : 'border-zinc-800/60 bg-[#0d0d0d] hover:border-zinc-700')
                        }
                      >
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${isSelected ? 'border-brand-gold bg-brand-gold/20' : 'border-zinc-600'}`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-brand-gold" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-brand-text">{item.etiqueta}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${item.tipo === 'positivo' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                          {item.tipo}
                        </span>
                      </button>

                      {isSelected && (
                        <input
                          type="text"
                          placeholder="¿En qué momento específico? (opcional)"
                          value={momentos[item.id] ?? ''}
                          onChange={(e) => setMomentos((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="mt-1 ml-7 w-[calc(100%-1.75rem)] rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#111] px-3 py-1.5 text-xs text-brand-text placeholder:text-brand-muted/40 focus:border-brand-gold/40 focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 max-w-3xl rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || selectedCount === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 px-6 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? 'Guardando…' : `Guardar ${selectedCount} comportamiento${selectedCount !== 1 ? 's' : ''}`}
        </button>
        <span className="text-xs text-brand-muted">{selectedCount} seleccionados</span>
      </div>
    </div>
  );
}
