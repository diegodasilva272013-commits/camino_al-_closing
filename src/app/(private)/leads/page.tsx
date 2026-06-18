'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Phone, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { LeadStatusBadge } from './_components/LeadStatusBadge';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  country: string | null;
  current_status: string;
  follow_up_count: number;
  max_follow_ups: number;
  opening_message_used: string | null;
  notes: string | null;
  next_follow_up_at: string | null;
  last_action_at: string | null;
  updated_at: string;
  is_closed: boolean;
};

type OpeningMessage = { id: string; name: string; message: string };

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [openings, setOpenings] = useState<OpeningMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; value: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [lr, or] = await Promise.all([
      fetch('/api/leads').then((r) => r.json()),
      fetch('/api/opening-messages').then((r) => r.json()),
    ]);
    setLeads(Array.isArray(lr) ? lr : []);
    setOpenings(Array.isArray(or) ? or : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patchLead(id: string, body: Record<string, unknown>) {
    setSaving(id);
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l));
    }
    setSaving(null);
  }

  async function followUp(id: string) {
    setSaving(id);
    const res = await fetch(`/api/leads/${id}/followup`, { method: 'POST' });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l));
    }
    setSaving(null);
  }

  const visible = leads.filter((l) => !filterStatus || l.current_status === filterStatus);
  const open    = leads.filter((l) => !l.is_closed);
  const closed  = leads.filter((l) => l.is_closed);

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.current_status] = (acc[l.current_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#080808] pb-24">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#080808]/95 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/60">Mis Leads</p>
            <p className="text-sm font-semibold text-white">
              {open.length} activos · {closed.length} cerrados
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Actualizar
          </button>
        </div>

        {/* Filtro por estado */}
        <div className="mt-2 overflow-x-auto">
          <div className="flex gap-1.5 pb-1 min-w-max">
            <button
              onClick={() => setFilterStatus('')}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap border transition',
                !filterStatus
                  ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400'
                  : 'border-white/10 text-zinc-500'
              )}
            >
              Todos ({leads.length})
            </button>
            {Object.entries(statusCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap border transition',
                    filterStatus === status
                      ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400'
                      : 'border-white/10 text-zinc-500'
                  )}
                >
                  {STATUS_LABELS[status as LeadStatus] ?? status} ({count})
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center pt-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-24 text-center px-8">
          <p className="text-zinc-400">No tenés leads{filterStatus ? ' con ese estado' : ' asignados'} todavía.</p>
          {filterStatus && (
            <button onClick={() => setFilterStatus('')} className="text-xs text-yellow-400 underline">
              Ver todos
            </button>
          )}
        </div>
      ) : (
        <div className="px-3 pt-3 space-y-2">
          {visible.map((lead) => {
            const isExpanded = expanded === lead.id;
            const isSaving   = saving === lead.id;

            return (
              <div
                key={lead.id}
                className={cn(
                  'rounded-2xl border bg-zinc-900/60 overflow-hidden transition',
                  lead.is_closed ? 'border-white/5 opacity-60' : 'border-white/8',
                  isExpanded && 'border-yellow-500/20'
                )}
              >
                {/* Fila principal — siempre visible */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-white/5"
                  onClick={() => setExpanded(isExpanded ? null : lead.id)}
                >
                  {/* Nombre + estado */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">
                      {lead.first_name} {lead.last_name ?? ''}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{lead.phone}</p>
                  </div>

                  {/* Badge estado */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <LeadStatusBadge
                      status={lead.current_status}
                      onChange={isSaving || lead.is_closed ? undefined : (s) => patchLead(lead.id, { current_status: s })}
                    />
                  </div>

                  {/* Chevron */}
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                  }
                </div>

                {/* Panel expandido */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-4 space-y-4">

                    {/* Acciones rápidas */}
                    {!lead.is_closed && (
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-xs text-emerald-400 active:bg-emerald-900/40"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1.5 rounded-lg border border-sky-700/40 bg-sky-900/20 px-3 py-1.5 text-xs text-sky-400 active:bg-sky-900/40"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Llamar
                        </a>
                        <button
                          onClick={() => patchLead(lead.id, { current_status: 'REUNION_AGENDADA' })}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-3 py-1.5 text-xs text-yellow-400 disabled:opacity-40"
                        >
                          ✓ Reunión agendada
                        </button>
                        <button
                          onClick={() => patchLead(lead.id, { current_status: 'NO_CALIFICA', is_closed: true, closed_reason: 'No califica' })}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-1.5 text-xs text-red-400 disabled:opacity-40"
                        >
                          ✕ No califica
                        </button>
                      </div>
                    )}

                    {/* Seguimiento */}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Seguimiento</p>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {Array.from({ length: lead.max_follow_ups }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                'h-2 w-2 rounded-full',
                                i < lead.follow_up_count ? 'bg-yellow-400' : 'bg-zinc-700'
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-zinc-400">{lead.follow_up_count}/{lead.max_follow_ups}</span>
                        {!lead.is_closed && lead.follow_up_count < lead.max_follow_ups && (
                          <button
                            onClick={() => followUp(lead.id)}
                            disabled={isSaving}
                            className="rounded-lg border border-yellow-700/30 px-2.5 py-1 text-[11px] text-yellow-400 disabled:opacity-40"
                          >
                            +1 seguimiento
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Apertura */}
                    {!lead.is_closed && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Mensaje de apertura</p>
                        <select
                          value={lead.opening_message_used ?? ''}
                          onChange={(e) => patchLead(lead.id, { opening_message_used: e.target.value || null })}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none"
                        >
                          <option value="">Sin apertura seleccionada</option>
                          {openings.map((o) => (
                            <option key={o.id} value={o.name}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Nota */}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Nota</p>
                      {noteEdit?.id === lead.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={noteEdit.value}
                            onChange={(e) => setNoteEdit({ id: lead.id, value: e.target.value })}
                            rows={3}
                            autoFocus
                            className="w-full rounded-lg border border-yellow-500/30 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { patchLead(lead.id, { notes: noteEdit.value }); setNoteEdit(null); }}
                              className="rounded-lg bg-yellow-500/20 border border-yellow-500/40 px-4 py-1.5 text-xs text-yellow-400"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setNoteEdit(null)}
                              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setNoteEdit({ id: lead.id, value: lead.notes ?? '' })}
                          className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400 min-h-[40px]"
                        >
                          {lead.notes || <span className="italic text-zinc-600">Tocar para agregar nota...</span>}
                        </button>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
