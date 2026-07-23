'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { APP_TIMEZONE } from '@/constants/timezone';
import { ReunionModal } from './_components/reunion-modal';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

type Reunion = {
  id: string;
  inicio: string;
  duracion_min: number;
  estado: string;
  conversacion_whatsapp: string;
  notas: string | null;
  resultado: string | null;
  closer_id: string;
  setter_id: string;
  lead_id: string | null;
  team_lead_id: string | null;
  estado_lead_anterior: string | null;
  closer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  setter: { id: string; full_name: string | null; avatar_url: string | null } | null;
  lead: { id: string; first_name: string; last_name: string | null; phone: string; current_status: string } | null;
  team_lead: { id: string; first_name: string; last_name: string | null; phone: string; current_status: string } | null;
};

const ESTADO_DOT: Record<string, string> = {
  agendada:     'bg-[#C9A84C]',
  reprogramada: 'bg-amber-400',
  completada:   'bg-green-400',
  no_show:      'bg-red-400',
  cancelada:    'bg-zinc-500',
};

const ESTADO_CHIP: Record<string, string> = {
  agendada:     'bg-[rgba(212,175,55,0.15)] text-[#d4af37] border-[rgba(212,175,55,0.3)]',
  reprogramada: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
  completada:   'bg-green-900/30 text-green-300 border-green-700/40',
  no_show:      'bg-red-900/30 text-red-300 border-red-700/40',
  cancelada:    'bg-zinc-800/60 text-zinc-500 border-zinc-700/40 line-through',
};

function toCaracasDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE }); // YYYY-MM-DD
}

function getHourMinCaracas(iso: string) {
  return new Date(iso).toLocaleTimeString('es-VE', {
    timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit',
  });
}

function getLeadName(r: Reunion) {
  const l = r.lead ?? r.team_lead;
  if (!l) return 'Lead eliminado';
  return `${l.first_name}${l.last_name ? ' ' + l.last_name : ''}`;
}

function monthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export default function AgendaPage() {
  const now        = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView]   = useState<'mes' | 'semana' | 'dia'>('mes');
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Reunion | null>(null);
  const [expandDia, setExpandDia] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentRole,   setCurrentRole]   = useState<string | undefined>();

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await sb.from('profiles').select('role').eq('id', user.id).single();
      setCurrentRole((data as { role?: string } | null)?.role ?? undefined);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // Rango del mes en UTC (con margen de ±1 día para cubrir diferencias de TZ)
    const desde = new Date(year, month, 0).toISOString();
    const hasta  = new Date(year, month + 1, 2).toISOString();
    const res = await fetch(`/api/agenda/reuniones?desde=${desde}&hasta=${hasta}`);
    if (res.ok) setReuniones(await res.json());
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // ── Mes navigation ────────────────────────────────────────────────────
  function prevMes() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else { setMonth(m => m - 1); }
  }
  function nextMes() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else { setMonth(m => m + 1); }
  }
  function goHoy() { setYear(now.getFullYear()); setMonth(now.getMonth()); }

  // ── Calendario grilla ─────────────────────────────────────────────────
  const primerDia = new Date(year, month, 1);
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const inicioDow = primerDia.getDay(); // 0=dom

  const celdas: (number | null)[] = [
    ...Array(inicioDow).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  // Rellenar hasta múltiplo de 7
  while (celdas.length % 7 !== 0) celdas.push(null);

  // Reuniones por día-Caracas
  const porDia: Record<string, Reunion[]> = {};
  for (const r of reuniones) {
    const dk = toCaracasDate(r.inicio);
    if (!porDia[dk]) porDia[dk] = [];
    porDia[dk].push(r);
  }

  const DIAS_HEADER = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const HOY = toCaracasDate(new Date().toISOString());

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted">Agenda</p>
          <h1 className="text-2xl font-bold text-brand-gold">Mi Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-[rgba(212,175,55,0.2)] overflow-hidden text-xs">
            {(['mes','semana','dia'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize transition ${view === v ? 'bg-brand-gold text-black font-semibold' : 'text-brand-muted hover:text-brand-text'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={goHoy} className="rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs text-brand-muted hover:text-brand-text transition">
            Hoy
          </button>
        </div>
      </div>

      {/* Navegación de mes */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMes} className="rounded p-1.5 text-brand-muted hover:text-brand-text transition">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-brand-text">
          {MESES[month]} {year}
        </h2>
        <button onClick={nextMes} className="rounded p-1.5 text-brand-muted hover:text-brand-text transition">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Vista mes */}
      {view === 'mes' && (
        <div className="rounded-xl border border-[rgba(212,175,55,0.12)] overflow-hidden">
          {/* Cabecera días */}
          <div className="grid grid-cols-7 border-b border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
            {DIAS_HEADER.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-brand-muted">
                {d}
              </div>
            ))}
          </div>

          {/* Grilla */}
          <div className="grid grid-cols-7">
            {celdas.map((dia, idx) => {
              if (!dia) {
                return <div key={idx} className="min-h-[100px] border-b border-r border-[rgba(212,175,55,0.06)] bg-[#070707]" />;
              }
              const dk = `${year}-${String(month + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const rsDay = porDia[dk] ?? [];
              const isHoy = dk === HOY;
              const isExpanded = expandDia === dk;
              const visibles = isExpanded ? rsDay : rsDay.slice(0, 3);
              const extras   = rsDay.length - 3;

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r border-[rgba(212,175,55,0.06)] p-1.5 ${isHoy ? 'bg-[rgba(212,175,55,0.04)]' : 'bg-[#0a0a0a]'}`}
                >
                  <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isHoy ? 'bg-brand-gold text-black' : 'text-brand-muted'
                  }`}>
                    {dia}
                  </span>
                  <div className="space-y-0.5">
                    {visibles.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`w-full rounded px-1.5 py-0.5 text-left border ${ESTADO_CHIP[r.estado] ?? ''} text-[10px] leading-tight hover:opacity-80 transition`}
                      >
                        <span className="font-semibold">{getHourMinCaracas(r.inicio)}</span>{' '}
                        <span className="truncate block">{getLeadName(r)}</span>
                      </button>
                    ))}
                    {!isExpanded && extras > 0 && (
                      <button
                        onClick={() => setExpandDia(dk)}
                        className="w-full text-left text-[10px] text-brand-muted hover:text-brand-gold pl-1"
                      >
                        +{extras} más
                      </button>
                    )}
                    {isExpanded && rsDay.length > 3 && (
                      <button
                        onClick={() => setExpandDia(null)}
                        className="w-full text-left text-[10px] text-brand-muted hover:text-brand-gold pl-1"
                      >
                        Colapsar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista día — lista en timeline */}
      {view === 'dia' && (
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-brand-muted">Cargando...</p>
          ) : (
            (() => {
              const hoy = new Date();
              const hoyDk = toCaracasDate(hoy.toISOString());
              const rsHoy = porDia[hoyDk] ?? [];
              return rsHoy.length === 0 ? (
                <p className="text-sm text-brand-muted">Sin reuniones hoy.</p>
              ) : (
                rsHoy.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full text-left flex items-center gap-3 rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 hover:border-[rgba(212,175,55,0.25)] transition"
                  >
                    <div className={`h-2 w-2 rounded-full shrink-0 ${ESTADO_DOT[r.estado] ?? 'bg-zinc-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-text">{getHourMinCaracas(r.inicio)} — {getLeadName(r)}</p>
                      <p className="text-xs text-brand-muted">{r.duracion_min} min · {r.closer?.full_name ?? '—'}</p>
                    </div>
                  </button>
                ))
              );
            })()
          )}
        </div>
      )}

      {/* Vista semana — lista agrupada por día */}
      {view === 'semana' && (
        <div className="space-y-4">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - d.getDay() + i);
            const dk = toCaracasDate(d.toISOString());
            const rs = porDia[dk] ?? [];
            return (
              <div key={dk}>
                <h3 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${dk === HOY ? 'text-brand-gold' : 'text-brand-muted'}`}>
                  {d.toLocaleDateString('es-VE', { timeZone: APP_TIMEZONE, weekday: 'long', day: 'numeric', month: 'short' })}
                </h3>
                {rs.length === 0 ? (
                  <p className="text-xs text-brand-muted pl-1">Sin reuniones</p>
                ) : (
                  <div className="space-y-1">
                    {rs.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="w-full text-left flex items-center gap-3 rounded-lg border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] px-3 py-2 hover:border-[rgba(212,175,55,0.2)] transition"
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${ESTADO_DOT[r.estado] ?? 'bg-zinc-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-text">{getHourMinCaracas(r.inicio)} — {getLeadName(r)}</p>
                          <p className="text-xs text-brand-muted">{r.duracion_min} min · {r.closer?.full_name ?? '—'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <ReunionModal
          reunion={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load(); }}
          currentUserId={currentUserId}
          currentRole={currentRole}
        />
      )}
    </div>
  );
}
