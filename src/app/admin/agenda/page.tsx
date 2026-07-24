'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, Eye, EyeOff } from 'lucide-react';
import { APP_TIMEZONE } from '@/constants/timezone';
import { ReunionModal } from '@/app/(private)/agenda/_components/reunion-modal';

// ── Types ─────────────────────────────────────────────────────────────────────

type Reunion = {
  id: string;
  inicio: string;
  duracion_min: number;
  estado: string;
  closer_id: string;
  setter_id: string;
  closer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  setter: { id: string; full_name: string | null; avatar_url: string | null } | null;
  lead: { id: string; first_name: string; last_name: string | null; current_status: string } | null;
  conversacion_whatsapp: string;
  notas: string | null;
  resultado: string | null;
  lead_id: string | null;
  estado_lead_anterior: string | null;
};

type Franja = {
  id: string;
  closer_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activa: boolean;
};

type CloserDisp = {
  closer: { id: string; full_name: string | null; avatar_url: string | null };
  franjas: Franja[];
};

type CloserBasic = { id: string; full_name: string | null };

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const ESTADO_CHIP: Record<string, string> = {
  agendada:     'bg-[rgba(212,175,55,0.12)] text-[#d4af37] border-[rgba(212,175,55,0.3)]',
  reprogramada: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
  completada:   'bg-green-900/30 text-green-300 border-green-700/40',
  no_show:      'bg-red-900/30 text-red-300 border-red-700/40',
  cancelada:    'bg-zinc-800/60 text-zinc-500 border-zinc-700/40',
};

const ESTADO_LABELS: Record<string, string> = {
  agendada: 'Agendada', reprogramada: 'Reprogramada',
  completada: 'Completada', no_show: 'No Show', cancelada: 'Cancelada',
};

function toAppDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}
function getHourMin(iso: string) {
  return new Date(iso).toLocaleTimeString('es-VE', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}
function getLeadName(r: Reunion) {
  return r.lead ? `${r.lead.first_name}${r.lead.last_name ? ' ' + r.lead.last_name : ''}` : 'Lead eliminado';
}

// ── Tab: Reuniones ────────────────────────────────────────────────────────────

function TabReuniones() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [closers, setClosers]     = useState<CloserBasic[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroCloser, setFiltroCloser] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [selected, setSelected]         = useState<Reunion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const desde = new Date(year, month, 0).toISOString();
    const hasta  = new Date(year, month + 1, 2).toISOString();
    const params = new URLSearchParams({ desde, hasta });
    if (filtroCloser) params.set('closer_id', filtroCloser);
    if (filtroEstado) params.set('estado', filtroEstado);
    const res = await fetch(`/api/agenda/reuniones?${params}`);
    if (res.ok) setReuniones(await res.json());
    setLoading(false);
  }, [year, month, filtroCloser, filtroEstado]);

  useEffect(() => {
    fetch('/api/agenda/closers').then(r => r.json()).then(d => setClosers(Array.isArray(d) ? d : []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const primerDia = new Date(year, month, 1);
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const inicioDow = primerDia.getDay();
  const celdas: (number | null)[] = [
    ...Array(inicioDow).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const porDia: Record<string, Reunion[]> = {};
  for (const r of reuniones) {
    const dk = toAppDate(r.inicio);
    if (!porDia[dk]) porDia[dk] = [];
    porDia[dk].push(r);
  }
  const HOY = toAppDate(new Date().toISOString());

  return (
    <>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={filtroCloser} onChange={e => setFiltroCloser(e.target.value)}
          className="rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-xs text-brand-text">
          <option value="">Todos los closers</option>
          {closers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-xs text-brand-text">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Navegación mes */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }}
          className="rounded p-1 text-brand-muted hover:text-brand-text"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="text-base font-bold text-brand-text">{MESES[month]} {year}</h2>
        <button onClick={() => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }}
          className="rounded p-1 text-brand-muted hover:text-brand-text"><ChevronRight className="h-5 w-5" /></button>
        <span className="ml-2 text-xs text-brand-muted">{reuniones.length} reuniones</span>
      </div>

      {loading ? <p className="text-sm text-brand-muted">Cargando...</p> : (
        <div className="rounded-xl border border-[rgba(212,175,55,0.12)] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
            {DIAS.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-brand-muted">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celdas.map((dia, idx) => {
              if (!dia) return <div key={idx} className="min-h-[90px] border-b border-r border-[rgba(212,175,55,0.05)] bg-[#070707]" />;
              const dk = `${year}-${String(month+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const rs = porDia[dk] ?? [];
              const isHoy = dk === HOY;
              return (
                <div key={idx} className={`min-h-[90px] border-b border-r border-[rgba(212,175,55,0.05)] p-1 ${isHoy ? 'bg-[rgba(212,175,55,0.03)]' : 'bg-[#0a0a0a]'}`}>
                  <span className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${isHoy ? 'bg-brand-gold text-black' : 'text-brand-muted'}`}>{dia}</span>
                  <div className="space-y-0.5">
                    {rs.slice(0,3).map(r => (
                      <button key={r.id} onClick={() => setSelected(r)}
                        className={`w-full rounded px-1 py-0.5 text-left border text-[9px] leading-tight hover:opacity-80 transition ${ESTADO_CHIP[r.estado] ?? ''}`}>
                        <span className="font-semibold">{getHourMin(r.inicio)}</span>{' '}
                        <span className="truncate block">{getLeadName(r)}</span>
                        <span className="block text-[8px] opacity-70">{r.closer?.full_name}</span>
                      </button>
                    ))}
                    {rs.length > 3 && <p className="text-[9px] text-brand-muted pl-1">+{rs.length-3} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <ReunionModal
          reunion={selected as any}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load(); }}
          currentRole="admin"
        />
      )}
    </>
  );
}

// ── Tab: Disponibilidad de Closers ────────────────────────────────────────────

function TabDisponibilidad() {
  const [data, setData]       = useState<CloserDisp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/agenda/disponibilidad')
      .then(async r => {
        if (r.ok) setData(await r.json());
        else { const d = await r.json(); setError(d.error ?? `Error ${r.status}`); }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-brand-muted">Cargando disponibilidades...</p>;
  if (error)   return <p className="text-sm text-red-400">Error: {error}</p>;
  if (data.length === 0) return <p className="text-sm text-brand-muted">No hay closers configurados aún.</p>;

  return (
    <div className="space-y-6">
      {data.map(({ closer, franjas }) => {
        const porDia = DIAS_FULL.map((dia, idx) => ({
          dia,
          idx,
          franjas: franjas
            .filter(f => f.dia_semana === idx)
            .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
        }));

        const totalActivas = franjas.filter(f => f.activa).length;

        return (
          <div key={closer.id} className="rounded-xl border border-[rgba(212,175,55,0.15)] bg-[#0a0a0a] overflow-hidden">
            {/* Header closer */}
            <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-5 py-3">
              {closer.avatar_url ? (
                <img src={closer.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-sm font-bold text-brand-gold">
                  {(closer.full_name ?? '?')[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-text">{closer.full_name ?? 'Closer sin nombre'}</p>
                <p className="text-[11px] text-brand-muted">
                  {totalActivas} franja{totalActivas !== 1 ? 's' : ''} activa{totalActivas !== 1 ? 's' : ''}
                  {' · '}
                  {franjas.length - totalActivas > 0 && `${franjas.length - totalActivas} inactiva${franjas.length - totalActivas !== 1 ? 's' : ''}`}
                </p>
              </div>
              {totalActivas === 0 && (
                <span className="rounded-full border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Sin disponibilidad activa
                </span>
              )}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7 divide-x divide-[rgba(212,175,55,0.06)]">
              {porDia.map(({ dia, idx, franjas: fs }) => (
                <div key={idx} className="p-2 min-h-[80px]">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-muted">
                    {dia.slice(0, 3)}
                  </p>
                  {fs.length === 0 ? (
                    <p className="text-[10px] text-brand-muted/40">—</p>
                  ) : (
                    <div className="space-y-1">
                      {fs.map(f => (
                        <div key={f.id} className={`flex items-center gap-1 ${f.activa ? '' : 'opacity-40'}`}>
                          {f.activa
                            ? <Eye className="h-2.5 w-2.5 shrink-0 text-brand-gold" />
                            : <EyeOff className="h-2.5 w-2.5 shrink-0 text-brand-muted" />
                          }
                          <span className={`font-mono text-[10px] tabular-nums leading-tight ${f.activa ? 'text-brand-text' : 'text-brand-muted line-through'}`}>
                            {f.hora_inicio.slice(0,5)}–{f.hora_fin.slice(0,5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAgendaPage() {
  const [tab, setTab] = useState<'reuniones' | 'disponibilidad'>('reuniones');

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted">Admin</p>
        <h1 className="text-2xl font-bold text-brand-gold">Agenda Closers</h1>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-1 w-fit">
        <button
          onClick={() => setTab('reuniones')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'reuniones' ? 'bg-brand-gold text-black' : 'text-brand-muted hover:text-brand-text'}`}
        >
          Reuniones
        </button>
        <button
          onClick={() => setTab('disponibilidad')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'disponibilidad' ? 'bg-brand-gold text-black' : 'text-brand-muted hover:text-brand-text'}`}
        >
          <Clock className="h-3.5 w-3.5" />
          Disponibilidad
        </button>
      </div>

      {tab === 'reuniones'      && <TabReuniones />}
      {tab === 'disponibilidad' && <TabDisponibilidad />}
    </div>
  );
}
