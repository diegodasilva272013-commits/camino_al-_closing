'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { APP_TIMEZONE } from '@/constants/timezone';
import { ReunionModal } from '../_components/reunion-modal';
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

const ESTADO_COLORS: Record<string, string> = {
  agendada:     'bg-[rgba(212,175,55,0.15)] text-[#d4af37] border-[rgba(212,175,55,0.35)]',
  reprogramada: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
  completada:   'bg-green-900/30 text-green-300 border-green-700/40',
  no_show:      'bg-red-900/30 text-red-300 border-red-700/40',
  cancelada:    'bg-zinc-800/60 text-zinc-500 border-zinc-700/40',
};

const ESTADO_LABELS: Record<string, string> = {
  agendada:     'Agendada',
  reprogramada: 'Reprogramada',
  completada:   'Completada',
  no_show:      'No Show',
  cancelada:    'Cancelada',
};

function formatCaracas(iso: string) {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReunionesPage() {
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEstado, setFiltro] = useState('');
  const [selected, setSelected]   = useState<Reunion | null>(null);
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
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    const res = await fetch(`/api/agenda/reuniones?${params}`);
    if (res.ok) setReuniones(await res.json());
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => { load(); }, [load]);

  const proximas  = reuniones.filter(r => ['agendada', 'reprogramada'].includes(r.estado));
  const historial = reuniones.filter(r => !['agendada', 'reprogramada'].includes(r.estado));

  function getLeadName(r: Reunion) {
    const l = r.lead ?? r.team_lead;
    if (!l) return 'Lead eliminado';
    return `${l.first_name}${l.last_name ? ' ' + l.last_name : ''}`;
  }

  function Row({ r }: { r: Reunion }) {
    return (
      <button
        onClick={() => setSelected(r)}
        className="w-full text-left flex items-start gap-3 rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 hover:border-[rgba(212,175,55,0.25)] hover:bg-[#111] transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-brand-text truncate">{getLeadName(r)}</span>
            <span className={`shrink-0 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESTADO_COLORS[r.estado] ?? ''}`}>
              {ESTADO_LABELS[r.estado] ?? r.estado}
            </span>
          </div>
          <p className="text-xs text-brand-muted">{formatCaracas(r.inicio)} · {r.duracion_min} min</p>
          {r.closer && <p className="text-xs text-brand-muted mt-0.5">Closer: {r.closer.full_name}</p>}
        </div>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Agenda"
        title="Mis Reuniones"
        description="Historial y próximas reuniones."
      />

      <div className="mb-4 flex gap-2">
        {['', 'agendada', 'reprogramada', 'completada', 'no_show', 'cancelada'].map(e => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
              filtroEstado === e
                ? 'bg-brand-gold text-black border-brand-gold'
                : 'border-[rgba(212,175,55,0.2)] text-brand-muted hover:text-brand-text'
            }`}
          >
            {e === '' ? 'Todas' : ESTADO_LABELS[e]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-brand-muted">Cargando...</p>
      ) : (
        <>
          {proximas.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-gold">Próximas</h3>
              <div className="space-y-2">
                {proximas.map(r => <Row key={r.id} r={r} />)}
              </div>
            </div>
          )}
          {historial.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-muted">Historial</h3>
              <div className="space-y-2">
                {historial.map(r => <Row key={r.id} r={r} />)}
              </div>
            </div>
          )}
          {reuniones.length === 0 && (
            <p className="text-sm text-brand-muted">No hay reuniones{filtroEstado ? ` con estado "${ESTADO_LABELS[filtroEstado]}"` : ''}.</p>
          )}
        </>
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
