'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, Users2, Target, Calendar, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NO_CONTACTADO:        { label: 'Sin contactar',   color: 'bg-zinc-700/50 text-zinc-300' },
  APERTURA_ENVIADA:     { label: 'Apertura env.',    color: 'bg-blue-900/40 text-blue-300' },
  CONTACTADO:           { label: 'Contactado',       color: 'bg-sky-900/40 text-sky-300' },
  RESPONDIO:            { label: 'Respondió',        color: 'bg-cyan-900/40 text-cyan-300' },
  INTERES_DETECTADO:    { label: 'Interesado',       color: 'bg-yellow-900/40 text-yellow-300' },
  INVITADO_AL_GRUPO:    { label: 'Inv. grupo',       color: 'bg-orange-900/40 text-orange-300' },
  INGRESO_AL_GRUPO:     { label: 'Ing. grupo',       color: 'bg-amber-900/40 text-amber-300' },
  ACTIVO_EN_GRUPO:      { label: 'Activo grupo',     color: 'bg-lime-900/40 text-lime-300' },
  DIAGNOSTICO_INICIADO: { label: 'Diagnóstico',      color: 'bg-emerald-900/40 text-emerald-300' },
  DIAGNOSTICO_PROFUNDO: { label: 'Diag. profundo',   color: 'bg-teal-900/40 text-teal-300' },
  REUNION_PROPUESTA:    { label: 'Reun. propuesta',  color: 'bg-violet-900/40 text-violet-300' },
  REUNION_AGENDADA:     { label: 'Reun. agendada',   color: 'bg-yellow-900/40 text-yellow-200' },
  NO_CALIFICA:          { label: 'No califica',      color: 'bg-red-900/40 text-red-400' },
  NO_RESPONDE:          { label: 'No responde',      color: 'bg-zinc-800/60 text-zinc-400' },
  SEGUIMIENTO_FUTURO:   { label: 'Seg. futuro',      color: 'bg-indigo-900/40 text-indigo-300' },
};

type SetterRow = {
  id: string;
  name: string;
  total: number;
  responded: number;
  interested: number;
  meetingProposed: number;
  meetingScheduled: number;
  pending: number;
  responseRate: number;
  interestRate: number;
  byStatus: Record<string, number>;
};

type GlobalMetrics = {
  total: number;
  assignedToday: number;
  contacted: number;
  responded: number;
  interested: number;
  meetingProposed: number;
  meetingScheduled: number;
  noFit: number;
};

type MetricsData = {
  global: GlobalMetrics;
  ranking: SetterRow[];
};

export default function LeadsDashboard() {
  const [data, setData]         = useState<MetricsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res  = await fetch('/api/admin/leads/metrics');
      const json = await res.json();
      if (json && json.global) {
        setData(json);
        setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // carga inicial
  useEffect(() => { load(); }, [load]);

  // polling cada 10 segundos
  useEffect(() => {
    const id = setInterval(() => load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-zinc-400">
        No se pudieron cargar los datos.{' '}
        <button onClick={() => load(true)} className="text-yellow-400 underline">Reintentar</button>
      </div>
    );
  }

  const g = data.global;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-yellow-500/60">Admin · Dashboard</p>
          <h1 className="text-2xl font-bold text-white mt-1">Leads en tiempo real</h1>
          {lastUpdate && (
            <p className="text-xs text-zinc-500 mt-0.5">Última actualización: {lastUpdate} · auto-refresh 10s</p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/20 transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Métricas globales */}
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Total del equipo</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {([
            { label: 'Total',        value: g.total,            icon: <Users2 className="h-4 w-4" />, hi: false },
            { label: 'Asig. hoy',    value: g.assignedToday,    icon: <Calendar className="h-4 w-4" />, hi: false },
            { label: 'Contactados',  value: g.contacted,        icon: null, hi: false },
            { label: 'Respondieron', value: g.responded,        icon: null, hi: false },
            { label: 'Interesados',  value: g.interested,       icon: null, hi: true },
            { label: 'Reun. prop.',  value: g.meetingProposed,  icon: null, hi: true },
            { label: 'Reun. agend.', value: g.meetingScheduled, icon: <Target className="h-4 w-4" />, hi: true },
            { label: 'No califica',  value: g.noFit,            icon: null, hi: false },
          ] as const).map((m) => (
            <div key={m.label} className={cn(
              'rounded-xl border p-3 text-center',
              m.hi
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : 'border-white/5 bg-zinc-900/60'
            )}>
              {m.icon && <div className={cn('flex justify-center mb-1', m.hi ? 'text-yellow-500/50' : 'text-zinc-600')}>{m.icon}</div>}
              <p className={cn('text-2xl font-bold', m.hi ? 'text-yellow-400' : 'text-white')}>{m.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Por setter */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" /> Por setter
        </p>

        {data.ranking.length === 0 && (
          <p className="text-zinc-500 text-sm">Sin setters con leads asignados aún.</p>
        )}

        <div className="space-y-3">
          {data.ranking.map((s, i) => (
            <div key={s.id} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-5">

              {/* Nombre y stats */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-yellow-500/30 text-[11px] font-bold text-yellow-400">
                    #{i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-[11px] text-zinc-400">
                      {s.total} leads · {s.responseRate}% respuesta · {s.interestRate}% interés
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {s.meetingScheduled > 0 && (
                    <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400">
                      {s.meetingScheduled} reunión{s.meetingScheduled !== 1 ? 'es' : ''} agendada{s.meetingScheduled !== 1 ? 's' : ''}
                    </span>
                  )}
                  <Link
                    href={`/admin/leads?user_id=${s.id}`}
                    className="text-xs text-yellow-400/60 hover:text-yellow-400 underline"
                  >
                    Ver leads →
                  </Link>
                </div>
              </div>

              {/* Barra de progreso */}
              {s.total > 0 && (
                <div className="mt-3 h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                  {[
                    { k: 'REUNION_AGENDADA',    c: 'bg-yellow-400' },
                    { k: 'REUNION_PROPUESTA',   c: 'bg-violet-500' },
                    { k: 'DIAGNOSTICO_INICIADO',c: 'bg-emerald-500' },
                    { k: 'INTERES_DETECTADO',   c: 'bg-yellow-600' },
                    { k: 'RESPONDIO',           c: 'bg-cyan-500' },
                    { k: 'CONTACTADO',          c: 'bg-sky-700' },
                    { k: 'NO_RESPONDE',         c: 'bg-zinc-600' },
                    { k: 'NO_CONTACTADO',       c: 'bg-zinc-700' },
                  ].map(({ k, c }) => {
                    const pct = (((s.byStatus ?? {})[k] ?? 0) / s.total) * 100;
                    return pct > 0 ? (
                      <div
                        key={k}
                        className={c}
                        style={{ width: `${pct}%` }}
                        title={`${STATUS_LABELS[k]?.label ?? k}: ${s.byStatus[k]}`}
                      />
                    ) : null;
                  })}
                </div>
              )}

              {/* Chips de estado */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(s.byStatus ?? {})
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const meta = STATUS_LABELS[status];
                    return (
                      <span
                        key={status}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                          meta?.color ?? 'bg-zinc-800 text-zinc-400'
                        )}
                      >
                        <span className="font-bold">{count}</span>
                        <span className="opacity-75">{meta?.label ?? status}</span>
                      </span>
                    );
                  })}
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
