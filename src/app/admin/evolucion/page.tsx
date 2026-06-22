'use client';

import { useEffect, useState, useRef } from 'react';
import { CAPACIDADES, CAPACITY_COLORS, type CapacidadKey } from '@/lib/motor-cac-ceo';

type Estado = {
  has_data: boolean;
  total_evidencias?: number;
  ultima_evidencia?: { date_recorded: string; title: string; type: string } | null;
  capacidades?: { key: string; label: string; score: number | null; nivel: string }[];
  capacidad_debil?: { cap: string; label: string; score: number } | null;
  capacidad_fuerte?: { cap: string; label: string; score: number } | null;
  patron_dominante?: { patron: string; count: number; tipo: string; capacidad: string; label_capacidad: string; descripcion?: string } | null;
  patron_positivo?: { patron: string; count: number; tipo: string; capacidad: string; label_capacidad: string } | null;
  todos_patrones?: any[];
  comportamientos_neg?: { behavior: string; capacidad: string; count: number }[];
  comportamientos_pos?: { behavior: string; capacidad: string; count: number }[];
  proxima_accion?: { capacidad: string; titulo: string; descripcion: string; criterio_validacion: string } | null;
  feedback_general?: string | null;
  prediccion?: string | null;
  ejercicios_activos?: any[];
  snapshots?: { snapshot_date: string; scores: Record<string, number> }[];
};

const TYPE_LABELS: Record<string, string> = {
  clase: 'Clase', mentoria_grupal: 'Mentoría grupal', mentoria_individual: 'Mentoría individual',
  reunion_estrategica: 'Reunión estratégica', reunion_equipo: 'Reunión de equipo',
  reunion_lucas: 'Reunión Lucas', audio: 'Audio', video: 'Video',
  transcripcion: 'Transcripción', documento: 'Documento', conversacion: 'Conversación',
  planificacion: 'Planificación', discurso: 'Discurso', presentacion: 'Presentación',
  mensaje_equipo: 'Mensaje al equipo',
};

const NIVEL_COLOR: Record<string, string> = {
  fuerte: 'text-emerald-400', medio: 'text-yellow-400', debil: 'text-red-400', sin_datos: 'text-zinc-500',
};

export default function EvolucionPage() {
  const [estado, setEstado]         = useState<Estado | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { fetchEstado(); }, []);

  async function fetchEstado() {
    setLoading(true);
    try {
      const r = await fetch('/api/founder/estado');
      setEstado(await r.json());
    } catch {}
    setLoading(false);
  }

  async function submitEvidence(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      title:        fd.get('title'),
      type:         fd.get('type'),
      content_text: fd.get('content_text'),
      context:      fd.get('context'),
      duration_min: fd.get('duration_min') ? Number(fd.get('duration_min')) : null,
      date_recorded: fd.get('date_recorded') || null,
    };
    try {
      const r = await fetch('/api/founder/evidences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setResult({ error: data.error }); return; }
      setResult({ ok: true, analysis: data.analysis });
      formRef.current?.reset();
      setShowForm(false);
      await fetchEstado();
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-400 text-sm animate-pulse">Cargando estado de Diego...</div>
    </div>
  );

  if (!estado?.has_data) return (
    <EmptyState
      showForm={showForm} onAdd={() => setShowForm(true)}
      submitting={submitting} result={result}
      formRef={formRef} onSubmit={submitEvidence}
    />
  );

  const ev = estado;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Diego 2030</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {ev.total_evidencias} evidencia{ev.total_evidencias !== 1 ? 's' : ''} analizadas
              {ev.ultima_evidencia && ` · última: ${ev.ultima_evidencia.date_recorded}`}
            </p>
          </div>
          <button
            onClick={() => { setShowForm(f => !f); setResult(null); }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showForm ? '✕ Cerrar' : '+ Nueva evidencia'}
          </button>
        </div>

        {/* Estado HOY — 3 bloques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 ${ev.capacidad_debil ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Capacidad más débil</div>
            {ev.capacidad_debil ? (
              <>
                <div className="text-base font-bold text-red-300 leading-tight">{ev.capacidad_debil.label}</div>
                <div className="text-3xl font-black text-red-400 mt-1">
                  {ev.capacidad_debil.score}<span className="text-sm font-normal text-zinc-500">/10</span>
                </div>
              </>
            ) : <div className="text-zinc-500 text-sm mt-2">Sin datos</div>}
          </div>

          <div className={`rounded-xl border p-4 ${ev.patron_dominante ? 'bg-orange-500/10 border-orange-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Patrón más frecuente</div>
            {ev.patron_dominante ? (
              <>
                <div className="text-sm font-bold text-orange-300 leading-tight">"{ev.patron_dominante.patron}"</div>
                <div className="text-xs text-zinc-400 mt-0.5">{ev.patron_dominante.label_capacidad}</div>
                <div className="text-2xl font-black text-orange-400 mt-1">
                  {ev.patron_dominante.count}<span className="text-sm font-normal text-zinc-500"> veces</span>
                </div>
              </>
            ) : <div className="text-zinc-500 text-sm mt-2">Sin patrones</div>}
          </div>

          <div className={`rounded-xl border p-4 ${ev.capacidad_fuerte ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Punto más fuerte</div>
            {ev.capacidad_fuerte ? (
              <>
                <div className="text-base font-bold text-emerald-300 leading-tight">{ev.capacidad_fuerte.label}</div>
                <div className="text-3xl font-black text-emerald-400 mt-1">
                  {ev.capacidad_fuerte.score}<span className="text-sm font-normal text-zinc-500">/10</span>
                </div>
              </>
            ) : <div className="text-zinc-500 text-sm mt-2">Sin datos</div>}
          </div>
        </div>

        {/* Próxima acción */}
        {ev.proxima_accion && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Próxima acción · Motor de intervención</div>
            <div className="text-base font-semibold text-white mb-1">{ev.proxima_accion.titulo}</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{ev.proxima_accion.descripcion}</p>
            {ev.proxima_accion.criterio_validacion && (
              <div className="mt-3 pt-3 border-t border-zinc-700/50">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Validación: </span>
                <span className="text-xs text-zinc-300">{ev.proxima_accion.criterio_validacion}</span>
              </div>
            )}
          </div>
        )}

        {/* Predicción */}
        {ev.prediccion && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">Predicción a 30 días</div>
            <p className="text-sm text-zinc-300 leading-relaxed italic">{ev.prediccion}</p>
          </div>
        )}

        {/* Capacidades — barras */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">Capacidades</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
            {(ev.capacidades ?? []).map(cap => (
              <div key={cap.key} className="flex items-center gap-4 px-4 py-3">
                <div className="w-36 shrink-0">
                  <div className="text-sm font-medium text-zinc-200">{cap.label}</div>
                  <div className={`text-xs ${NIVEL_COLOR[cap.nivel] ?? 'text-zinc-500'}`}>
                    {cap.nivel === 'fuerte' ? 'Fuerte' : cap.nivel === 'medio' ? 'Medio' : cap.nivel === 'debil' ? 'Débil' : 'Sin datos'}
                  </div>
                </div>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  {cap.score != null && (
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cap.score * 10}%`, backgroundColor: CAPACITY_COLORS[cap.key as CapacidadKey] ?? '#6b7280' }}
                    />
                  )}
                </div>
                <div className="w-12 text-right">
                  <span className="text-sm font-bold text-zinc-100">{cap.score ?? '—'}</span>
                  {cap.score != null && <span className="text-xs text-zinc-500">/10</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback general */}
        {ev.feedback_general && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Feedback del último análisis</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{ev.feedback_general}</p>
          </div>
        )}

        {/* Patrones */}
        {(ev.todos_patrones ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Patrones detectados · {(ev.todos_patrones ?? []).length} total
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="px-4 py-2 text-left">Patrón</th>
                    <th className="px-4 py-2 text-left hidden sm:table-cell">Capacidad</th>
                    <th className="px-4 py-2 text-center">Tipo</th>
                    <th className="px-4 py-2 text-right">Veces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(ev.todos_patrones ?? []).slice(0, 15).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-zinc-200">{p.patron}</div>
                        {p.descripcion && <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{p.descripcion}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs hidden sm:table-cell">
                        {CAPACIDADES[p.capacidad as CapacidadKey] ?? p.capacidad}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.tipo === 'negativo' ? 'bg-red-500/20 text-red-300' :
                          p.tipo === 'positivo' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-zinc-700 text-zinc-300'
                        }`}>{p.tipo}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-zinc-200">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ejercicios activos */}
        {(ev.ejercicios_activos ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Ejercicios activos · {(ev.ejercicios_activos ?? []).length}
            </h2>
            <div className="space-y-3">
              {(ev.ejercicios_activos ?? []).map((ex: any, i: number) => (
                <div key={ex.id ?? i} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-100 text-sm">{ex.title}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {CAPACIDADES[ex.capacity as CapacidadKey] ?? ex.capacity}
                        {ex.due_at && ` · vence ${new Date(ex.due_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                      ex.status === 'pending'      ? 'bg-yellow-500/20 text-yellow-300' :
                      ex.status === 'in_progress'  ? 'bg-blue-500/20 text-blue-300' :
                      ex.status === 'delivered'    ? 'bg-orange-500/20 text-orange-300' :
                      ex.status === 'approved'     ? 'bg-emerald-500/20 text-emerald-300' :
                      'bg-zinc-700 text-zinc-300'
                    }`}>{ex.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario al fondo */}
        {showForm && (
          <div id="nueva-evidencia" className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4 uppercase tracking-wider">Nueva evidencia</h2>
            {result?.error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">{result.error}</div>
            )}
            <EvidenceForm formRef={formRef} onSubmit={submitEvidence} submitting={submitting} onCancel={() => { setShowForm(false); setResult(null); }} />
          </div>
        )}

        {result?.ok && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <div className="text-emerald-300 font-semibold text-sm mb-2">✓ Evidencia analizada con memoria histórica</div>
            {result.analysis?.feedback_general && (
              <p className="text-sm text-zinc-300 leading-relaxed">{result.analysis.feedback_general}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceForm({ formRef, onSubmit, submitting, onCancel }: {
  formRef: React.RefObject<HTMLFormElement>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  onCancel?: () => void;
}) {
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-zinc-400 mb-1">Título *</label>
          <input name="title" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Clase CAC Módulo 3 — 15 junio" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Tipo *</label>
          <select name="type" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
            <option value="">Seleccioná...</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Fecha</label>
          <input name="date_recorded" type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Contexto (opcional)</label>
        <input name="context" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Grupo de 8 setters, primer encuentro del mes" />
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Transcripción o texto *</label>
        <textarea name="content_text" required rows={10} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-y" placeholder="Pegá la transcripción, el texto del documento, o el resumen del audio..." />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={submitting} className="bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
          {submitting ? 'Analizando con o3...' : 'Analizar evidencia'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 px-4 py-2 rounded-lg text-sm transition-colors">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function EmptyState({ onAdd, showForm, submitting, result, formRef, onSubmit }: {
  onAdd: () => void; showForm: boolean; submitting: boolean; result: any;
  formRef: React.RefObject<HTMLFormElement>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-20 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Diego 2030</h1>
          <p className="text-zinc-500 text-sm mt-1">No hay evidencias analizadas aún.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
          <div className="text-4xl">🧠</div>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Subí la primera evidencia para que el Motor CAC CEO construya tu perfil de evolución.<br />
            Cada análisis acumula patrones, scores y memoria. El sistema aprende con cada evidencia.
          </p>
          {!showForm && (
            <button onClick={onAdd} className="bg-white text-zinc-900 hover:bg-zinc-100 px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              + Primera evidencia
            </button>
          )}
        </div>
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            {result?.error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">{result.error}</div>
            )}
            <EvidenceForm formRef={formRef} onSubmit={onSubmit} submitting={submitting} />
          </div>
        )}
      </div>
    </div>
  );
}
