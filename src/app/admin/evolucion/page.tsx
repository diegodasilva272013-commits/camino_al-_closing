'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  proxima_accion?: { capacidad: string; titulo: string; descripcion: string; criterio_validacion: string } | null;
  feedback_general?: string | null;
  prediccion?: string | null;
  ejercicios_activos?: any[];
};

type SyncStatus = 'idle' | 'syncing' | 'done' | 'no_data';

const NIVEL_COLOR: Record<string, string> = {
  fuerte: 'text-emerald-400', medio: 'text-yellow-400', debil: 'text-red-400', sin_datos: 'text-zinc-500',
};

const TYPE_LABELS: Record<string, string> = {
  clase: 'Clase', mentoria_grupal: 'Mentoría grupal', mentoria_individual: 'Mentoría individual',
  reunion_estrategica: 'Reunión estratégica', reunion_equipo: 'Reunión de equipo',
  reunion_lucas: 'Reunión Lucas', audio: 'Audio', video: 'Video',
  transcripcion: 'Transcripción', documento: 'Documento', conversacion: 'Conversación',
  planificacion: 'Planificación', discurso: 'Discurso', presentacion: 'Presentación',
  mensaje_equipo: 'Mensaje al equipo',
};

export default function EvolucionPage() {
  const [estado, setEstado]           = useState<Estado | null>(null);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('syncing');
  const [syncMsg, setSyncMsg]         = useState('Sincronizando datos del equipo...');
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formResult, setFormResult]   = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const syncedRef = useRef(false);

  const fetchEstado = useCallback(async () => {
    try {
      const r = await fetch('/api/founder/estado');
      const d = await r.json();
      setEstado(d);
      return d as Estado;
    } catch { return null; }
  }, []);

  const runSync = useCallback(async () => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    setSyncStatus('syncing');
    setSyncMsg('Sincronizando datos del equipo...');

    try {
      const r = await fetch('/api/founder/sync', { method: 'POST' });
      const d = await r.json();

      if (d.synced > 0) {
        setSyncMsg(`${d.message} Actualizando perfil...`);
        const newEstado = await fetchEstado();
        if (newEstado?.has_data) {
          setSyncStatus('done');
          setSyncMsg(`✓ ${d.message}`);
          // Si hay más pendientes, volver a sincronizar
          if (d.pending > 0) {
            syncedRef.current = false;
            setTimeout(() => runSync(), 500);
          }
        } else {
          setSyncStatus('no_data');
          setSyncMsg('Datos sincronizados. Análisis en proceso...');
        }
      } else if (d.synced === 0 && d.already_synced > 0) {
        // Ya estaba sincronizado
        setSyncStatus('done');
        setSyncMsg('');
      } else {
        // No hay team_diagnostics todavía
        setSyncStatus('no_data');
        setSyncMsg(d.message ?? 'No hay datos de equipo aún.');
      }
    } catch {
      setSyncStatus('no_data');
      setSyncMsg('Error al sincronizar.');
    }
  }, [fetchEstado]);

  useEffect(() => {
    // Cargar estado Y lanzar sync en paralelo
    fetchEstado().then(e => {
      if (e?.has_data) setSyncStatus('idle');
    });
    runSync();
  }, []);

  async function submitManualEvidence(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormResult(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/founder/evidences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        fd.get('title'),
          type:         fd.get('type'),
          content_text: fd.get('content_text'),
          context:      fd.get('context'),
          date_recorded: fd.get('date_recorded') || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setFormResult({ error: data.error }); return; }
      setFormResult({ ok: true });
      formRef.current?.reset();
      setShowForm(false);
      await fetchEstado();
    } catch (err: any) {
      setFormResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // —— Loading inicial: sync todavía corriendo y sin datos
  if (!estado && syncStatus === 'syncing') return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      <p className="text-zinc-400 text-sm">Sincronizando datos del equipo...</p>
    </div>
  );

  // —— Sin datos después de sync
  if (!estado?.has_data) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-20 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Diego 2030</h1>
        </div>

        {syncStatus === 'no_data' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
            <div className="text-zinc-300 text-sm font-medium">Sin datos de equipo aún</div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              El diagnóstico diario del equipo corre automáticamente a las 8 AM UTC.<br />
              Una vez que haya diagnósticos, el sistema los analiza solo — sin formularios.
            </p>
            <button
              onClick={() => { syncedRef.current = false; runSync(); }}
              className="text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-4 py-2 rounded-lg transition-colors"
            >
              Reintentar sync
            </button>
          </div>
        )}

        {syncStatus === 'syncing' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin shrink-0" />
            <p className="text-zinc-400 text-sm">{syncMsg}</p>
          </div>
        )}

        <div className="border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-600 mb-3">O cargá evidencia directa:</p>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-4 py-2 rounded-lg transition-colors"
            >
              + Cargar transcripción manual
            </button>
          ) : (
            <ManualEvidenceForm formRef={formRef} onSubmit={submitManualEvidence} submitting={submitting} result={formResult} onCancel={() => setShowForm(false)} />
          )}
        </div>
      </div>
    </div>
  );

  const ev = estado!;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Diego 2030</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {ev.total_evidencias} evidencia{ev.total_evidencias !== 1 ? 's' : ''} analizadas
              {ev.ultima_evidencia && ` · última: ${ev.ultima_evidencia.date_recorded}`}
              {syncStatus === 'syncing' && <span className="ml-2 text-zinc-600 text-xs animate-pulse">· sincronizando...</span>}
              {syncMsg && syncStatus === 'done' && <span className="ml-2 text-emerald-600 text-xs">· {syncMsg}</span>}
            </p>
          </div>
          <button
            onClick={() => { setShowForm(f => !f); setFormResult(null); }}
            className="shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showForm ? '✕ Cerrar' : '+ Evidencia manual'}
          </button>
        </div>

        {/* Estado HOY — 3 bloques clave */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 ${ev.capacidad_debil ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Capacidad más débil</div>
            {ev.capacidad_debil ? (
              <>
                <div className="text-base font-bold text-red-300 leading-tight">{ev.capacidad_debil.label}</div>
                <div className="text-3xl font-black text-red-400 mt-2">
                  {ev.capacidad_debil.score}<span className="text-sm font-normal text-zinc-500">/10</span>
                </div>
              </>
            ) : <div className="text-zinc-500 text-sm mt-2">Sin datos</div>}
          </div>

          <div className={`rounded-xl border p-4 ${ev.patron_dominante ? 'bg-orange-500/10 border-orange-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Patrón más frecuente</div>
            {ev.patron_dominante ? (
              <>
                <div className="text-sm font-bold text-orange-300 leading-tight">"{ev.patron_dominante.patron}"</div>
                <div className="text-xs text-zinc-500 mt-0.5">{ev.patron_dominante.label_capacidad}</div>
                <div className="text-2xl font-black text-orange-400 mt-2">
                  {ev.patron_dominante.count}
                  <span className="text-sm font-normal text-zinc-500"> veces</span>
                </div>
              </>
            ) : <div className="text-zinc-500 text-sm mt-2">Sin patrones aún</div>}
          </div>

          <div className={`rounded-xl border p-4 ${ev.capacidad_fuerte ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Punto más fuerte</div>
            {ev.capacidad_fuerte ? (
              <>
                <div className="text-base font-bold text-emerald-300 leading-tight">{ev.capacidad_fuerte.label}</div>
                <div className="text-3xl font-black text-emerald-400 mt-2">
                  {ev.capacidad_fuerte.score}<span className="text-sm font-normal text-zinc-500">/10</span>
                </div>
              </>
            ) : <div className="text-zinc-500 text-sm mt-2">Sin datos</div>}
          </div>
        </div>

        {/* Próxima acción — Motor de intervención */}
        {ev.proxima_accion && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Próxima acción · Motor de intervención</div>
            <div className="text-base font-semibold text-white mb-2">{ev.proxima_accion.titulo}</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{ev.proxima_accion.descripcion}</p>
            {ev.proxima_accion.criterio_validacion && (
              <div className="mt-3 pt-3 border-t border-zinc-700/50 text-xs text-zinc-400">
                <span className="text-zinc-500 uppercase tracking-wide">Validación: </span>
                {ev.proxima_accion.criterio_validacion}
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
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Capacidades</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
            {(ev.capacidades ?? []).map(cap => (
              <div key={cap.key} className="flex items-center gap-4 px-4 py-3">
                <div className="w-36 shrink-0">
                  <div className="text-sm font-medium text-zinc-200 leading-tight">{cap.label}</div>
                  <div className={`text-xs mt-0.5 ${NIVEL_COLOR[cap.nivel] ?? 'text-zinc-500'}`}>
                    {cap.nivel === 'fuerte' ? 'Fuerte' : cap.nivel === 'medio' ? 'Medio' : cap.nivel === 'debil' ? 'Débil' : 'Sin datos'}
                  </div>
                </div>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  {cap.score != null && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${cap.score * 10}%`, backgroundColor: CAPACITY_COLORS[cap.key as CapacidadKey] ?? '#6b7280' }}
                    />
                  )}
                </div>
                <div className="w-14 text-right">
                  <span className="text-sm font-bold text-zinc-100">{cap.score ?? '—'}</span>
                  {cap.score != null && <span className="text-xs text-zinc-600">/10</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback último análisis */}
        {ev.feedback_general && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Feedback del último análisis</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{ev.feedback_general}</p>
          </div>
        )}

        {/* Patrones con frecuencia */}
        {(ev.todos_patrones ?? []).length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Patrones detectados · {(ev.todos_patrones ?? []).length}
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wider">
                    <th className="px-4 py-2 text-left">Patrón</th>
                    <th className="px-4 py-2 text-left hidden md:table-cell">Capacidad</th>
                    <th className="px-4 py-2 text-center">Tipo</th>
                    <th className="px-4 py-2 text-right">×</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(ev.todos_patrones ?? []).slice(0, 15).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-zinc-200 text-sm">{p.patron}</div>
                        {p.descripcion && <div className="text-xs text-zinc-600 mt-0.5 line-clamp-1">{p.descripcion}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs hidden md:table-cell">
                        {CAPACIDADES[p.capacidad as CapacidadKey] ?? p.capacidad}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.tipo === 'negativo' ? 'bg-red-500/20 text-red-400' :
                          p.tipo === 'positivo' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>{p.tipo}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-zinc-300">{p.count}</td>
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
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Ejercicios · {(ev.ejercicios_activos ?? []).length}
            </h2>
            <div className="space-y-2">
              {(ev.ejercicios_activos ?? []).map((ex: any, i: number) => (
                <div key={ex.id ?? i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-zinc-200 text-sm">{ex.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {CAPACIDADES[ex.capacity as CapacidadKey] ?? ex.capacity}
                      {ex.due_at && ` · ${new Date(ex.due_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                    ex.status === 'pending'     ? 'bg-yellow-500/20 text-yellow-400' :
                    ex.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                    ex.status === 'delivered'   ? 'bg-orange-500/20 text-orange-400' :
                    ex.status === 'approved'    ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>{ex.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario manual — AL FONDO, colapsado */}
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <h2 className="text-xs text-zinc-400 uppercase tracking-wider mb-4">Cargar evidencia manual</h2>
            {formResult?.error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{formResult.error}</div>
            )}
            <ManualEvidenceForm formRef={formRef} onSubmit={submitManualEvidence} submitting={submitting} result={formResult} onCancel={() => { setShowForm(false); setFormResult(null); }} />
          </div>
        )}

        {formResult?.ok && !showForm && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-sm">
            ✓ Evidencia analizada y agregada al perfil
          </div>
        )}
      </div>
    </div>
  );
}

function ManualEvidenceForm({ formRef, onSubmit, submitting, result, onCancel }: {
  formRef: React.RefObject<HTMLFormElement>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  result: any;
  onCancel?: () => void;
}) {
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">Título *</label>
          <input name="title" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Mentoría grupal — 21 junio" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Tipo *</label>
          <select name="type" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
            <option value="">Seleccioná...</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
          <input name="date_recorded" type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Contexto</label>
        <input name="context" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Opcional" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Transcripción / texto *</label>
        <textarea name="content_text" required rows={10} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-y" placeholder="Pegá la transcripción..." />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
          {submitting ? 'Analizando con o3...' : 'Analizar evidencia'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 px-4 py-2 rounded-lg text-sm transition-colors">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
