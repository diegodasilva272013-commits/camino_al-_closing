'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

type Grabacion = {
  id:            string;
  titulo:        string;
  tipo:          string;
  fecha:         string;
  estado:        string;
  error_detalle: string | null;
  evidencia_id:  string | null;
  video_url:     string | null;
};

type Segmento = { start: number; end: number; text: string; speaker?: string };
type Comportamiento = {
  id:           string;
  descripcion:  string;
  cita:         string;
  timestamp_inicio: number | null;
  comportamiento_capacidad: { capacidad_id: string; valencia: string; peso: number; objetivo_crecimiento: { nombre_display: string } }[];
};

const ESTADO_MSG: Record<string, string> = {
  comprimiendo:  'Comprimiendo video en tu browser...',
  subiendo:      'Subiendo a Storage...',
  transcribiendo: 'Transcribiendo audio con Whisper...',
  analizando:    'Analizando comportamientos...',
  completada:    '',
  error:         '',
};

export default function GrabacionPage() {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [grabacion, setGrabacion]       = useState<Grabacion | null>(null);
  const [segmentos, setSegmentos]       = useState<Segmento[]>([]);
  const [comps,     setComps]           = useState<Comportamiento[]>([]);
  const [videoUrl,  setVideoUrl]        = useState<string | null>(null);
  const [currentTime, setCurrentTime]   = useState(0);
  const [loading,   setLoading]         = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  async function loadData(grabId: string) {
    const r = await fetch(`/api/d2030/grabacion/${grabId}`);
    if (!r.ok) return;
    const data: Grabacion = await r.json();
    setGrabacion(data);

    if (data.estado === 'completada') {
      // Cargar transcripción y análisis
      const [transcRes, compsRes, urlRes] = await Promise.all([
        fetch(`/api/d2030/grabacion/${grabId}/transcripcion`),
        data.evidencia_id ? fetch(`/api/d2030/evidencia/${data.evidencia_id}/comportamientos`) : Promise.resolve(null),
        fetch(`/api/d2030/grabacion/${grabId}/video-url`),
      ]);

      if (transcRes.ok) {
        const td = await transcRes.json();
        setSegmentos(td.segmentos ?? []);
      }
      if (compsRes?.ok) {
        const cd = await compsRes.json();
        setComps(cd.comportamientos ?? []);
      }
      if (urlRes.ok) {
        const vd = await urlRes.json();
        setVideoUrl(vd.url ?? null);
      }
      setLoading(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
    } else if (data.estado === 'error') {
      setLoading(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadData(id);
    // Polling mientras procesa
    pollingRef.current = setInterval(() => loadData(id), 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [id]);

  function jumpTo(seconds: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  }

  if (!grabacion && loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
    </div>
  );

  if (!grabacion) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
      Grabación no encontrada.
    </div>
  );

  const procesando = !['completada', 'error'].includes(grabacion.estado);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">

        {/* Header */}
        <div>
          <a href="/admin/evolucion" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Diego 2030</a>
          <h1 className="text-lg font-bold text-white mt-2 tracking-tight">{grabacion.titulo}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{grabacion.tipo} · {grabacion.fecha}</p>
        </div>

        {/* Estado de procesamiento */}
        {procesando && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin shrink-0" />
              <p className="text-sm text-zinc-300">{ESTADO_MSG[grabacion.estado] ?? 'Procesando...'}</p>
            </div>
            <div className="space-y-1.5">
              {(['comprimiendo', 'subiendo', 'transcribiendo', 'analizando'] as string[]).map(e => {
                const orden = ['comprimiendo', 'subiendo', 'transcribiendo', 'analizando', 'completada'];
                const idx     = orden.indexOf(grabacion.estado);
                const thisIdx = orden.indexOf(e);
                const done    = thisIdx < idx;
                const active  = thisIdx === idx;
                return (
                  <div key={e} className={`flex items-center gap-2 text-xs ${active ? 'text-zinc-200' : done ? 'text-emerald-500' : 'text-zinc-700'}`}>
                    <span>{done ? '✓' : active ? '→' : '·'}</span>
                    <span>{ESTADO_MSG[e]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {grabacion.estado === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            <p className="font-semibold mb-1">Error en el procesamiento</p>
            <p className="font-mono text-xs">{grabacion.error_detalle}</p>
          </div>
        )}

        {/* Completada: Video + Transcripción + Análisis */}
        {grabacion.estado === 'completada' && (
          <div className="space-y-6">
            {/* Video player */}
            {videoUrl && (
              <div className="bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full max-h-96"
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                />
              </div>
            )}

            {/* Transcripción con click para saltar */}
            {segmentos.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Transcripción · {segmentos.length} segmentos
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/50 max-h-96 overflow-y-auto">
                  {segmentos.map((seg, i) => {
                    const activo = currentTime >= seg.start && currentTime < seg.end;
                    const ts = Math.floor(seg.start);
                    const min = Math.floor(ts / 60).toString().padStart(2, '0');
                    const sec = (ts % 60).toString().padStart(2, '0');
                    return (
                      <button
                        key={i}
                        onClick={() => jumpTo(seg.start)}
                        className={`w-full text-left flex gap-3 px-4 py-2.5 transition-colors ${
                          activo ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <span className="text-xs text-zinc-500 font-mono shrink-0 mt-0.5">{min}:{sec}</span>
                        <span className="text-sm text-zinc-300 leading-relaxed">{seg.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Análisis */}
            {comps.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Comportamientos detectados · {comps.length}
                </h2>
                <div className="space-y-3">
                  {comps.map(c => (
                    <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        {c.timestamp_inicio != null && (
                          <button
                            onClick={() => jumpTo(c.timestamp_inicio!)}
                            className="shrink-0 text-xs text-zinc-500 hover:text-white font-mono bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
                          >
                            {Math.floor(c.timestamp_inicio / 60).toString().padStart(2,'0')}:{(Math.floor(c.timestamp_inicio) % 60).toString().padStart(2,'0')}
                          </button>
                        )}
                        <p className="text-sm text-zinc-100 leading-relaxed flex-1">{c.descripcion}</p>
                      </div>
                      <blockquote className="border-l-2 border-zinc-700 pl-3 text-xs text-zinc-500 italic leading-relaxed">
                        &ldquo;{c.cita}&rdquo;
                      </blockquote>
                      {c.comportamiento_capacidad?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {c.comportamiento_capacidad.map((cc, j) => (
                            <span key={j} className={`text-xs px-2.5 py-1 rounded-full border ${
                              cc.valencia === 'refuerza'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                              {cc.objetivo_crecimiento?.nombre_display ?? cc.capacidad_id}
                              {' '}{cc.valencia === 'refuerza' ? '↑' : '↓'} {cc.peso}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sin comportamientos */}
            {comps.length === 0 && !loading && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
                No se detectaron comportamientos relevantes de Diego en esta grabación.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
