'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { APP_TIMEZONE } from '@/constants/timezone';

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
  team_lead: { id: string; first_name: string; last_name: string | null; current_status: string } | null;
  conversacion_whatsapp: string;
  notas: string | null;
  resultado: string | null;
  lead_id: string | null;
  team_lead_id: string | null;
  estado_lead_anterior: string | null;
};

type Closer = { id: string; full_name: string | null };

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

function toCaracasDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}
function getHourMin(iso: string) {
  return new Date(iso).toLocaleTimeString('es-VE', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}
function getLeadName(r: Reunion) {
  const l = r.lead ?? r.team_lead;
  return l ? `${l.first_name}${l.last_name ? ' ' + l.last_name : ''}` : 'Lead eliminado';
}

export default function AdminAgendaPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [closers, setClosers]     = useState<Closer[]>([]);
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
    const res = await fetch(`/api/admin/agenda?${params}`);
    if (res.ok) setReuniones(await res.json());
    setLoading(false);
  }, [year, month, filtroCloser, filtroEstado]);

  useEffect(() => {
    fetch('/api/agenda/closers').then(r => r.json()).then(d => setClosers(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { load(); }, [load]);

  function prevMes() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMes() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  // Conteo por closer
  const countPorCloser: Record<string, number> = {};
  for (const r of reuniones) {
    if (!countPorCloser[r.closer_id]) countPorCloser[r.closer_id] = 0;
    countPorCloser[r.closer_id]++;
  }

  // Grilla
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
    const dk = toCaracasDate(r.inicio);
    if (!porDia[dk]) porDia[dk] = [];
    porDia[dk].push(r);
  }

  const HOY = toCaracasDate(new Date().toISOString());
  const DIAS_HDR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted">Admin</p>
        <h1 className="text-2xl font-bold text-brand-gold">Agenda Closers</h1>
      </div>

      {/* Contador por closer */}
      {closers.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {closers.map(c => (
            <div key={c.id} className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] px-3 py-1.5">
              <Users className="h-3 w-3 text-brand-muted" />
              <span className="text-xs text-brand-text">{c.full_name ?? 'Closer'}</span>
              <span className="rounded-full bg-brand-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-gold">
                {countPorCloser[c.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filtroCloser}
          onChange={e => setFiltroCloser(e.target.value)}
          className="rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-xs text-brand-text"
        >
          <option value="">Todos los closers</option>
          {closers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="rounded-md border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-xs text-brand-text"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Navegación mes */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={prevMes} className="rounded p-1 text-brand-muted hover:text-brand-text">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-bold text-brand-text">{MESES[month]} {year}</h2>
        <button onClick={nextMes} className="rounded p-1 text-brand-muted hover:text-brand-text">
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="ml-2 text-xs text-brand-muted">{reuniones.length} reuniones</span>
      </div>

      {loading ? (
        <p className="text-sm text-brand-muted">Cargando...</p>
      ) : (
        <div className="rounded-xl border border-[rgba(212,175,55,0.12)] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
            {DIAS_HDR.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-brand-muted">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celdas.map((dia, idx) => {
              if (!dia) return <div key={idx} className="min-h-[90px] border-b border-r border-[rgba(212,175,55,0.05)] bg-[#070707]" />;
              const dk = `${year}-${String(month + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const rs = porDia[dk] ?? [];
              const isHoy = dk === HOY;
              return (
                <div key={idx} className={`min-h-[90px] border-b border-r border-[rgba(212,175,55,0.05)] p-1 ${isHoy ? 'bg-[rgba(212,175,55,0.03)]' : 'bg-[#0a0a0a]'}`}>
                  <span className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${isHoy ? 'bg-brand-gold text-black' : 'text-brand-muted'}`}>
                    {dia}
                  </span>
                  <div className="space-y-0.5">
                    {rs.slice(0, 3).map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`w-full rounded px-1 py-0.5 text-left border text-[9px] leading-tight hover:opacity-80 transition ${ESTADO_CHIP[r.estado] ?? ''}`}
                      >
                        <span className="font-semibold">{getHourMin(r.inicio)}</span>{' '}
                        <span className="truncate block">{getLeadName(r)}</span>
                        <span className="block text-[8px] opacity-70">{r.closer?.full_name}</span>
                      </button>
                    ))}
                    {rs.length > 3 && (
                      <p className="text-[9px] text-brand-muted pl-1">+{rs.length - 3} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-brand-muted">{getHourMin(selected.inicio)} · {selected.duracion_min} min</p>
                <h3 className="text-lg font-bold text-brand-text">{getLeadName(selected)}</h3>
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${ESTADO_CHIP[selected.estado] ?? ''}`}>
                  {ESTADO_LABELS[selected.estado] ?? selected.estado}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-brand-muted hover:text-brand-text text-lg leading-none">✕</button>
            </div>
            <div className="space-y-2 text-sm text-brand-muted">
              <p>Setter: <span className="text-brand-text">{selected.setter?.full_name ?? '—'}</span></p>
              <p>Closer: <span className="text-brand-text">{selected.closer?.full_name ?? '—'}</span></p>
              {selected.notas && <p>Notas: <span className="text-brand-text">{selected.notas}</span></p>}
              {selected.resultado && <p>Resultado: <span className="text-brand-text">{selected.resultado}</span></p>}
            </div>
            <div className="mt-4">
              <p className="mb-1 text-xs text-brand-muted uppercase tracking-wide">Conversación WhatsApp</p>
              <pre className="whitespace-pre-wrap rounded border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-2 text-xs text-brand-text/80 font-mono max-h-36 overflow-y-auto">
                {selected.conversacion_whatsapp}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
