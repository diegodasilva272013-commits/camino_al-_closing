'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, Users2, Target, Calendar, Wifi, WifiOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NO_CONTACTADO:       { label: 'Sin contactar',    color: 'bg-zinc-700/50 text-zinc-300' },
  APERTURA_ENVIADA:    { label: 'Apertura env.',     color: 'bg-blue-900/40 text-blue-300' },
  CONTACTADO:          { label: 'Contactado',        color: 'bg-sky-900/40 text-sky-300' },
  RESPONDIO:           { label: 'Respondió',         color: 'bg-cyan-900/40 text-cyan-300' },
  INTERES_DETECTADO:   { label: 'Interesado',        color: 'bg-yellow-900/40 text-yellow-300' },
  INVITADO_AL_GRUPO:   { label: 'Inv. grupo',        color: 'bg-orange-900/40 text-orange-300' },
  INGRESO_AL_GRUPO:    { label: 'Ing. grupo',        color: 'bg-amber-900/40 text-amber-300' },
  ACTIVO_EN_GRUPO:     { label: 'Activo grupo',      color: 'bg-lime-900/40 text-lime-300' },
  DIAGNOSTICO_INICIADO:{ label: 'Diagnóstico',       color: 'bg-emerald-900/40 text-emerald-300' },
  DIAGNOSTICO_PROFUNDO:{ label: 'Diag. profundo',    color: 'bg-teal-900/40 text-teal-300' },
  REUNION_PROPUESTA:   { label: 'Reun. propuesta',   color: 'bg-violet-900/40 text-violet-300' },
  REUNION_AGENDADA:    { label: 'Reun. agendada',    color: 'bg-brand-gold/20 text-brand-gold' },
  NO_CALIFICA:         { label: 'No califica',       color: 'bg-red-900/40 text-red-400' },
  NO_RESPONDE:         { label: 'No responde',       color: 'bg-zinc-800/60 text-zinc-400' },
  SEGUIMIENTO_FUTURO:  { label: 'Seg. futuro',       color: 'bg-indigo-900/40 text-indigo-300' },
};

type SetterData = {
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

export default function LeadsDashboardPage() {
  const [global, setGlobal]   = useState<GlobalMetrics | null>(null);
  const [setters, setSetters] = useState<SetterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [live, setLive]       = useState(false);
  const [tick, setTick]       = useState(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/leads/metrics');
      const data = await res.json();
      setGlobal(data?.global ?? null);
      setSetters(data?.ranking ?? []);
      setLastUpdate(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => { fetchData(); }, [fetchData]);

  // Supabase Realtime
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('leads-live-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchData(true); // silent refresh on any leads change
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Polling de respaldo cada 15 seg
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Tick para "hace X seg"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  function timeAgo() {
    if (!lastUpdate) return '';
    const diff = Math.round((Date.now() - lastUpdate.getTime()) / 1000);
    if (diff < 10) return 'ahora mismo';
    if (diff < 60) return `hace ${diff} seg`;
    return `hace ${Math.round(diff / 60)} min`;
  }

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          eyebrow="Admin · Dashboard"
          title="Leads en tiempo real"
          description={today}
        />
        <div className="flex items-center gap-3 shrink-0 mt-1">
          {/* Indicador LIVE */}
          <div className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition',
            live
              ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-400'
              : 'border-zinc-700 bg-zinc-900 text-zinc-500'
          )}>
            {live
              ? <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/></span> EN VIVO</>
              : <><WifiOff className="h-3 w-3" /> Polling</>
            }
          </div>
          {lastUpdate && (
            <span className="text-[11px] text-brand-muted">{timeAgo()}</span>
          )}
        </div>
      </div>

      {loading && !global ? (
        <div className="mt-20 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : global ? (
        <>
          {/* Métricas globales */}
          <div className="mt-6">
            <p className="mb-3 text-[10px] uppercase tracking-widest text-brand-gold/50">Métricas globales</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: 'Total', value: global.total, icon: <Users2 className="h-4 w-4" /> },
                { label: 'Hoy', value: global.assignedToday, icon: <Calendar className="h-4 w-4" /> },
                { label: 'Contactados', value: global.contacted },
                { label: 'Respondieron', value: global.responded },
                { label: 'Interesados', value: global.interested, accent: true },
                { label: 'Reun. prop.', value: global.meetingProposed, accent: true },
                { label: 'Reun. agend.', value: global.meetingScheduled, accent: true, icon: <Target className="h-4 w-4" /> },
                { label: 'No califica', value: global.noFit },
              ].map((m) => (
                <div key={m.label} className={cn(
                  'rounded-xl border p-3 text-center',
                  m.accent ? 'border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.06)]' : 'border-[rgba(212,175,55,0.08)] bg-[#0d0d0d]'
                )}>
                  {m.icon && <div className="flex justify-center mb-1 text-brand-gold/40">{m.icon}</div>}
                  <p className={cn('text-xl font-bold', m.accent ? 'text-brand-gold' : 'text-brand-text')}>{m.value}</p>
                  <p className="text-[10px] text-brand-muted mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Por setter */}
          <div className="mt-8">
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-brand-gold/50">
              <TrendingUp className="h-3.5 w-3.5" />
              Estado por setter — actualización automática
            </p>
            <div className="space-y-3">
              {setters.length === 0 && (
                <p className="text-sm text-brand-muted">Sin setters con leads asignados.</p>
              )}
              {setters.map((s, i) => (
                <div key={s.id} className="rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-5">
                  {/* Header setter */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 text-[11px] font-bold text-brand-gold">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-brand-text">{s.name}</p>
                        <p className="text-[11px] text-brand-muted">
                          {s.total} leads · {s.responseRate}% respuesta · {s.interestRate}% interés
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.meetingScheduled > 0 && (
                        <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-1 text-xs font-bold text-brand-gold">
                          {s.meetingScheduled} reun. agendada{s.meetingScheduled !== 1 ? 's' : ''}
                        </span>
                      )}
                      <Link
                        href={`/admin/leads?user_id=${s.id}`}
                        className="text-xs text-brand-gold/70 hover:text-brand-gold underline transition"
                      >
                        Ver todos →
                      </Link>
                    </div>
                  </div>

                  {/* Barra de progreso visual */}
                  {s.total > 0 && (
                    <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                      {[
                        { key: 'REUNION_AGENDADA', color: 'bg-brand-gold' },
                        { key: 'REUNION_PROPUESTA', color: 'bg-violet-500' },
                        { key: 'DIAGNOSTICO_INICIADO', color: 'bg-emerald-500' },
                        { key: 'INTERES_DETECTADO', color: 'bg-yellow-500' },
                        { key: 'RESPONDIO', color: 'bg-cyan-500' },
                        { key: 'CONTACTADO', color: 'bg-sky-600' },
                        { key: 'NO_RESPONDE', color: 'bg-zinc-600' },
                        { key: 'NO_CONTACTADO', color: 'bg-zinc-700' },
                      ].map(({ key, color }) => {
                        const pct = ((s.byStatus[key] ?? 0) / s.total) * 100;
                        return pct > 0 ? (
                          <div key={key} className={cn(color)} style={{ width: `${pct}%` }} title={`${STATUS_LABELS[key]?.label}: ${s.byStatus[key]}`} />
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Grid de estados */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(s.byStatus)
                      .filter(([, v]) => v > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => {
                        const meta = STATUS_LABELS[status];
                        return (
                          <Link
                            key={status}
                            href={`/admin/leads?user_id=${s.id}`}
                            title={meta?.label ?? status}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:opacity-80',
                              meta?.color ?? 'bg-zinc-800 text-zinc-400'
                            )}
                          >
                            <span className="font-bold">{count}</span>
                            <span className="opacity-80">{meta?.label ?? status}</span>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-16 text-center text-brand-muted">Sin datos disponibles.</div>
      )}
    </div>
  );
}
