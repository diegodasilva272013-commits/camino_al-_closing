'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, AlertTriangle, Clock, Users2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TareaEstado = {
  team: { id: string; name: string } | null;
  estado: {
    aperturas_count: number; contactados_count: number; conv_count: number;
    task_aperturas_ok: boolean; task_contactados_ok: boolean; task_conv_ok: boolean;
    all_tasks_ok: boolean;
  } | null;
  partner_estado: {
    aperturas_count: number; contactados_count: number; conv_count: number;
    all_tasks_ok: boolean;
  } | null;
  partner_profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
  config: { aperturas_meta: number; contactados_meta: number; conv_meta: number };
  strikes: number;
  fecha: string;
  minutos_restantes: number;
};

function ProgressBar({ value, max, ok }: { value: number; max: number; ok: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full rounded-full bg-zinc-800">
      <div
        className={cn('h-full rounded-full transition-all duration-500', ok ? 'bg-emerald-500' : 'bg-blue-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Countdown({ mins }: { mins: number }) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const urgent = mins <= 60;
  return (
    <div className={cn('flex items-center gap-1.5 text-sm font-bold tabular-nums', urgent ? 'text-red-400' : 'text-zinc-400')}>
      <Clock className="h-4 w-4" />
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')} restantes
    </div>
  );
}

export default function TareasPage() {
  const [data,    setData]    = useState<TareaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [mins,    setMins]    = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/duplas/estado').then(r => r.json()).catch(() => null);
    setData(r);
    setMins(r?.minutos_restantes ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => setMins(m => Math.max(0, m - 1)), 60000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
    </div>
  );

  if (!data?.team) return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-6">
      <Users2 className="h-12 w-12 text-zinc-700" />
      <p className="text-lg font-bold text-zinc-400">No estás en ningún equipo todavía</p>
      <p className="text-sm text-zinc-600">El admin te tiene que asignar a una dupla.</p>
    </div>
  );

  const { estado, partner_estado, partner_profile, config, strikes, fecha } = data;

  const ap = estado?.aperturas_count   ?? 0;
  const co = estado?.contactados_count ?? 0;
  const cv = estado?.conv_count        ?? 0;

  const TAREAS = [
    {
      label:    'Aperturas enviadas',
      sublabel: 'Leads con primer mensaje enviado hoy',
      count: ap, meta: config.aperturas_meta,
      ok:    estado?.task_aperturas_ok   ?? false,
      color: 'text-sky-400', dotColor: 'bg-sky-500',
    },
    {
      label:    'Contactados',
      sublabel: 'Leads que pasaron a CONTACTADO hoy',
      count: co, meta: config.contactados_meta,
      ok:    estado?.task_contactados_ok ?? false,
      color: 'text-indigo-400', dotColor: 'bg-indigo-500',
    },
    {
      label:    'Conversaciones analizadas',
      sublabel: 'Conversaciones subidas y analizadas hoy',
      count: cv, meta: config.conv_meta,
      ok:    estado?.task_conv_ok        ?? false,
      color: 'text-purple-400', dotColor: 'bg-purple-500',
    },
  ];

  const allOk   = estado?.all_tasks_ok ?? false;
  const urgent  = mins <= 60 && !allOk;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Tareas del día</h1>
          <p className="text-xs text-zinc-600 mt-0.5">{data.team.name} · {fecha}</p>
        </div>
        <button onClick={load}
          className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Estado global */}
      {allOk ? (
        <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Check className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-400">¡Tareas completadas!</p>
            <p className="text-xs text-zinc-500 mt-0.5">Cumpliste con todo hoy. Sin riesgo de strike.</p>
          </div>
        </div>
      ) : (
        <div className={cn('rounded-2xl border px-4 py-3 flex items-center justify-between gap-3',
          urgent ? 'border-red-700/40 bg-red-950/20' : 'border-zinc-800 bg-zinc-900/30')}>
          <div>
            <p className={cn('text-sm font-bold', urgent ? 'text-red-400' : 'text-yellow-400')}>
              {urgent ? '⚠ Quedan menos de 60 minutos' : 'Tareas pendientes'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {urgent ? 'Completá las tareas para evitar un strike automático.' : 'Detectado automáticamente cada 15 min.'}
            </p>
          </div>
          <Countdown mins={mins} />
        </div>
      )}

      {/* Tareas individuales */}
      <div className="space-y-4">
        {TAREAS.map(t => (
          <div key={t.label}
            className={cn('rounded-2xl border p-4 space-y-3 transition-all',
              t.ok ? 'border-emerald-700/25 bg-emerald-950/10' : 'border-zinc-800 bg-zinc-900/20')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className={cn('mt-0.5 h-2.5 w-2.5 rounded-full shrink-0', t.ok ? 'bg-emerald-500' : t.dotColor)} />
                <div>
                  <p className={cn('text-sm font-semibold', t.ok ? 'text-zinc-400 line-through' : 'text-white')}>
                    {t.label}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{t.sublabel}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn('text-xl font-bold tabular-nums', t.ok ? 'text-emerald-400' : 'text-white')}>
                  {t.count}
                </span>
                <span className="text-zinc-600 text-sm">/{t.meta}</span>
                {t.ok && <p className="text-[10px] text-emerald-500 font-bold">✓ Listo</p>}
              </div>
            </div>
            <ProgressBar value={t.count} max={t.meta} ok={t.ok} />
          </div>
        ))}
      </div>

      {/* Strikes */}
      <div className={cn('rounded-2xl border p-4',
        strikes >= 3 ? 'border-red-700/40 bg-red-950/15'
        : strikes > 0 ? 'border-yellow-700/30 bg-yellow-950/10'
        : 'border-zinc-800')}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Mis strikes
          </p>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <span key={i} className={cn('h-3 w-3 rounded-full border',
                i < strikes
                  ? (strikes >= 3 ? 'bg-red-500 border-red-400' : strikes === 2 ? 'bg-orange-400 border-orange-300' : 'bg-yellow-400 border-yellow-300')
                  : 'bg-zinc-800 border-zinc-700'
              )} />
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          {strikes === 0 && 'Sin strikes. Seguí cumpliendo las tareas diarias.'}
          {strikes === 1 && '1 strike acumulado. Podés tener 2 más antes del bloqueo.'}
          {strikes === 2 && '⚠ 2 strikes. Un strike más y tu cuenta queda bloqueada.'}
          {strikes >= 3 && '🔴 Cuenta bloqueada. Hablá con coordinación para desbloquear.'}
        </p>
      </div>

      {/* Estado del compañero */}
      {partner_profile && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {partner_profile.avatar_url
              ? <img src={partner_profile.avatar_url} className="h-9 w-9 rounded-full object-cover border border-zinc-700" alt="" />
              : <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-400">
                  {partner_profile.full_name?.[0] ?? '?'}
                </div>
            }
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{partner_profile.full_name ?? 'Tu compañero/a'}</p>
              <p className="text-[11px] text-zinc-600">Dupla</p>
            </div>
            {partner_estado?.all_tasks_ok
              ? <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full">✓ Completó</span>
              : <span className="text-xs text-zinc-600 bg-zinc-800/60 px-2.5 py-1 rounded-full">Pendiente</span>
            }
          </div>
          {partner_estado ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Aperturas', v: partner_estado.aperturas_count,  m: config.aperturas_meta },
                { label: 'Contactados', v: partner_estado.contactados_count, m: config.contactados_meta },
                { label: 'Conversaciones', v: partner_estado.conv_count,       m: config.conv_meta },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-zinc-800/50 py-2.5">
                  <p className={cn('text-lg font-bold', s.v >= s.m ? 'text-emerald-400' : 'text-white')}>{s.v}</p>
                  <p className="text-[10px] text-zinc-600">{s.label}</p>
                  <p className="text-[9px] text-zinc-700">/{s.m}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-700">Sin datos del compañero todavía</p>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-700">
        Las tareas se detectan automáticamente cada 15 minutos.<br />
        Tocá el botón ↺ para actualizar manualmente.
      </p>
    </div>
  );
}
