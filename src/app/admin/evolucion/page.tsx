'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Comportamiento = {
  id:               string;
  descripcion:      string;
  cita_textual:     string | null;
  fecha:            string | null;
  evidencia_id:     string | null;
  evidencia_titulo: string | null;
  valencia:         'refuerza' | 'debilita';
};

type Capacidad = {
  clave:           string;
  nombre:          string;
  nivel_actual:    number | null;
  nivel_objetivo:  number;
  tendencia:       'sube' | 'baja' | 'estable' | null;
  ultima_medicion: { valor: number; fecha: string } | null;
  ultimo_comportamiento: Comportamiento | null;
};

type Perfil = {
  tiene_datos:           boolean;
  total_evidencias:      number;
  total_comportamientos: number;
  capacidades:           Capacidad[];
};

// ── Paleta de colores por capacidad ──────────────────────────────────────────

const CAP_BAR: Record<string, string> = {
  claridad_ejecutiva:     '#f59e0b',
  priorizacion:           '#a855f7',
  delegacion:             '#06b6d4',
  seguimiento:            '#10b981',
  comunicacion_ejecutiva: '#3b82f6',
  presencia:              '#ef4444',
};

const CAP_GLOW: Record<string, string> = {
  claridad_ejecutiva:     'border-amber-500/30',
  priorizacion:           'border-purple-500/30',
  delegacion:             'border-cyan-500/30',
  seguimiento:            'border-emerald-500/30',
  comunicacion_ejecutiva: 'border-blue-500/30',
  presencia:              'border-red-500/30',
};

const TIPO_LABELS: Record<string, string> = {
  clase: 'Clase', mentoria_grupal: 'Mentoría grupal', mentoria_individual: 'Mentoría individual',
  reunion_estrategica: 'Reunión estratégica', reunion_equipo: 'Reunión de equipo',
  transcripcion: 'Transcripción', conversacion: 'Conversación', audio: 'Audio',
};

// ── Componentes simples ───────────────────────────────────────────────────────

function Tendencia({ t }: { t: Capacidad['tendencia'] }) {
  if (!t) return null;
  if (t === 'sube')   return <span className="text-emerald-400 text-sm font-bold">↑</span>;
  if (t === 'baja')   return <span className="text-red-400 text-sm font-bold">↓</span>;
  return <span className="text-zinc-500 text-sm">→</span>;
}

function BarNivel({ nivel, clave }: { nivel: number | null; clave: string }) {
  const pct = nivel != null ? Math.max(0, Math.min(100, (nivel / 10) * 100)) : 0;
  const color = CAP_BAR[clave] ?? '#6b7280';
  return (
    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
      {nivel != null && (
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EvolucionPage() {
  const router   = useRouter();
  const [perfil, setPerfil]         = useState<Perfil | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function loadPerfil() {
    try {
      const r = await fetch('/api/d2030/perfil');
      if (!r.ok) {
        const d = await r.json();
        setError(d.error ?? 'Error al cargar perfil');
        return;
      }
      const d = await r.json();
      setPerfil(d);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPerfil(); }, []);

  async function submitEvidencia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/d2030/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo:      fd.get('titulo'),
          tipo:        fd.get('tipo'),
          texto_crudo: fd.get('texto_crudo'),
          contexto:    fd.get('contexto') || null,
          fecha:       fd.get('fecha') || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setSubmitErr(data.error ?? 'Error al analizar'); return; }
      // Redirigir a la vista de resultado
      router.push(`/admin/evolucion/r/${data.evidencia_id}`);
    } catch (err: any) {
      setSubmitErr(err.message ?? 'Error de red');
    } finally {
      setSubmitting(false);
    }
  }

  // —— Estados de carga y error ─────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-red-400 text-sm text-center max-w-md">{error}</p>
      <p className="text-zinc-600 text-xs text-center max-w-md">
        ¿Corriste las migraciones 0027 y 0028 en Supabase?
      </p>
      <button
        onClick={() => { setLoading(true); setError(null); loadPerfil(); }}
        className="text-xs border border-zinc-700 text-zinc-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
      >
        Reintentar
      </button>
    </div>
  );

  const caps = perfil?.capacidades ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Diego 2030</h1>
            {perfil?.tiene_datos ? (
              <p className="text-zinc-500 text-sm mt-1">
                {perfil.total_evidencias} evidencia{perfil.total_evidencias !== 1 ? 's' : ''} ·{' '}
                {perfil.total_comportamientos} comportamiento{perfil.total_comportamientos !== 1 ? 's' : ''}
              </p>
            ) : (
              <p className="text-zinc-600 text-sm mt-1">Sin evidencias aún. Cargá la primera transcripción.</p>
            )}
          </div>
          <button
            onClick={() => { setShowForm(f => !f); setSubmitErr(null); }}
            className="shrink-0 text-sm bg-white text-zinc-900 hover:bg-zinc-100 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {showForm ? '✕' : '+ Cargar evidencia'}
          </button>
        </div>

        {/* Formulario de carga */}
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xs text-zinc-400 uppercase tracking-wider">Cargar evidencia de desempeño</h2>
            {submitErr && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{submitErr}</div>
            )}
            <form ref={formRef} onSubmit={submitEvidencia} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1">Título *</label>
                  <input
                    name="titulo" required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                    placeholder="Ej: Mentoría grupal — 21 jun"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Tipo *</label>
                  <select name="tipo" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
                    <option value="">Seleccioná...</option>
                    {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
                  <input name="fecha" type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1">Contexto</label>
                  <input name="contexto" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Opcional: tema de la sesión, participantes..." />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Transcripción *</label>
                <textarea
                  name="texto_crudo" required rows={10}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-y"
                  placeholder="Pegá la transcripción completa..."
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit" disabled={submitting}
                  className="bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border border-zinc-400 border-t-zinc-700 rounded-full animate-spin" />
                      Analizando...
                    </span>
                  ) : 'Analizar evidencia'}
                </button>
                <span className="text-xs text-zinc-600">~15–30 seg con gpt-4o</span>
              </div>
            </form>
          </div>
        )}

        {/* Las 6 capacidades */}
        {caps.length > 0 && (
          <div className="space-y-3">
            {caps.map(cap => (
              <CapacidadCard key={cap.clave} cap={cap} />
            ))}
          </div>
        )}

        {/* Empty state cuando no hay datos */}
        {!perfil?.tiene_datos && !showForm && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-3">
            <p className="text-zinc-400 text-sm">El perfil está vacío.</p>
            <p className="text-zinc-600 text-xs leading-relaxed max-w-sm mx-auto">
              Pegá una transcripción de clase, mentoría o reunión.
              El motor extrae comportamientos y los mapea a las 6 capacidades.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Card de capacidad ─────────────────────────────────────────────────────────

function CapacidadCard({ cap }: { cap: Capacidad }) {
  const nivel  = cap.nivel_actual;
  const sinDatos = nivel === null;
  const border = CAP_GLOW[cap.clave] ?? 'border-zinc-800';
  const comp   = cap.ultimo_comportamiento;

  return (
    <div className={`bg-zinc-900 border rounded-xl overflow-hidden ${sinDatos ? 'border-zinc-800' : border}`}>
      {/* Fila principal */}
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Nombre */}
        <div className="w-44 shrink-0">
          <div className="text-sm font-semibold text-zinc-100 leading-tight">{cap.nombre}</div>
        </div>

        {/* Barra + número */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1">
            <BarNivel nivel={nivel} clave={cap.clave} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sinDatos ? (
              <span className="text-sm text-zinc-600">—</span>
            ) : (
              <>
                <span className="text-base font-bold text-zinc-100">{nivel}</span>
                <span className="text-xs text-zinc-600">/10</span>
                <Tendencia t={cap.tendencia} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Último comportamiento */}
      {comp && (
        <div className="px-4 pb-3.5 border-t border-zinc-800/60">
          <div className="flex items-start gap-2 mt-2.5">
            <span className={`shrink-0 mt-0.5 text-xs ${comp.valencia === 'refuerza' ? 'text-emerald-500' : 'text-red-500'}`}>
              {comp.valencia === 'refuerza' ? '↑' : '↓'}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{comp.descripcion}</p>
              {comp.cita_textual && (
                <p className="text-xs text-zinc-600 italic mt-1 line-clamp-1">"{comp.cita_textual}"</p>
              )}
              {comp.evidencia_titulo && (
                <a
                  href={comp.evidencia_id ? `/admin/evolucion/r/${comp.evidencia_id}` : undefined}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1 block"
                >
                  {comp.evidencia_titulo}{comp.fecha ? ` · ${comp.fecha}` : ''}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sin datos — placeholder sutil */}
      {!comp && (
        <div className="px-4 pb-3 border-t border-zinc-800/40">
          <p className="text-xs text-zinc-700 mt-2">Sin comportamientos registrados</p>
        </div>
      )}
    </div>
  );
}
