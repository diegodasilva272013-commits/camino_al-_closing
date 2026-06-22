'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const VideoUploader = dynamic(() => import('@/components/d2030/VideoUploader'), { ssr: false });

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
  const [perfil, setPerfil]     = useState<Perfil | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
          <div className="flex items-center gap-2 shrink-0">
            <a href="/admin/evolucion/config" className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors">
              Config
            </a>
            <button
              onClick={() => setShowForm(f => !f)}
              className="text-sm bg-white text-zinc-900 hover:bg-zinc-100 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {showForm ? '✕' : '+ Cargar evidencia'}
            </button>
          </div>
        </div>

        {/* Uploader */}
        {showForm && (
          <VideoUploader onClose={() => setShowForm(false)} />
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
