'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users2, RefreshCw, ChevronDown, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [openings, setOpenings] = useState<OpeningMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNote, setEditNote] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

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
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
    }
    setSaving(null);
  }

  async function followUp(id: string) {
    setSaving(id);
    const res = await fetch(`/api/leads/${id}/followup`, { method: 'POST' });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
    }
    setSaving(null);
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  }

  const open  = leads.filter((l) => !l.is_closed);
  const closed = leads.filter((l) => l.is_closed);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        title="Mis Leads"
        description={`${open.length} activos · ${closed.length} cerrados`}
        icon={<Users2 className="h-5 w-5 text-brand-gold" />}
      />

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2 text-sm text-brand-muted">
          <span>{leads.length} leads asignados</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs text-brand-muted hover:text-brand-gold transition"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-24 flex flex-col items-center gap-3 text-center">
          <Users2 className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-muted">No tenés leads asignados todavía.</p>
          <p className="text-xs text-brand-muted/60">El admin te asignará leads próximamente.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[rgba(212,175,55,0.08)] text-left">
                {['Nombre', 'Teléfono', 'País', 'Estado', 'Seguimiento', 'Apertura', 'Notas', 'Última Act.', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(212,175,55,0.05)]">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={cn(
                    'transition hover:bg-[rgba(212,175,55,0.03)]',
                    lead.is_closed && 'opacity-50'
                  )}
                >
                  {/* Nombre */}
                  <td className="px-4 py-3 font-medium text-brand-text whitespace-nowrap">
                    {lead.first_name} {lead.last_name ?? ''}
                  </td>

                  {/* Teléfono */}
                  <td className="px-4 py-3 text-brand-muted font-mono text-xs whitespace-nowrap">
                    {lead.phone}
                  </td>

                  {/* País */}
                  <td className="px-4 py-3 text-brand-muted text-xs">
                    {lead.country ?? '—'}
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    {lead.is_closed ? (
                      <LeadStatusBadge status={lead.current_status} />
                    ) : (
                      <LeadStatusBadge
                        status={lead.current_status}
                        onChange={(s) => patchLead(lead.id, { current_status: s })}
                      />
                    )}
                  </td>

                  {/* Seguimiento */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: lead.max_follow_ups }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              i < lead.follow_up_count
                                ? 'bg-brand-gold'
                                : 'bg-zinc-700'
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-brand-muted">
                        {lead.follow_up_count}/{lead.max_follow_ups}
                      </span>
                      {!lead.is_closed && lead.follow_up_count < lead.max_follow_ups && (
                        <button
                          onClick={() => followUp(lead.id)}
                          disabled={saving === lead.id}
                          className="rounded border border-[rgba(212,175,55,0.2)] px-1.5 py-0.5 text-[10px] text-brand-gold hover:bg-[rgba(212,175,55,0.1)] transition disabled:opacity-40"
                        >
                          +1
                        </button>
                      )}
                      {lead.follow_up_count >= lead.max_follow_ups && (
                        <span className="text-[10px] text-orange-400">Máx.</span>
                      )}
                    </div>
                  </td>

                  {/* Apertura */}
                  <td className="px-4 py-3">
                    {lead.is_closed ? (
                      <span className="text-xs text-brand-muted">{lead.opening_message_used ?? '—'}</span>
                    ) : (
                      <select
                        value={lead.opening_message_used ?? ''}
                        onChange={(e) => patchLead(lead.id, { opening_message_used: e.target.value || null })}
                        className="rounded border border-[rgba(212,175,55,0.15)] bg-[#111] px-2 py-1 text-xs text-brand-muted focus:outline-none focus:border-brand-gold/40 max-w-[130px]"
                      >
                        <option value="">Sin apertura</option>
                        {openings.map((o) => (
                          <option key={o.id} value={o.name}>{o.name}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Notas */}
                  <td className="px-4 py-3 max-w-[180px]">
                    {editNote?.id === lead.id ? (
                      <div className="flex items-start gap-1">
                        <textarea
                          value={editNote.value}
                          onChange={(e) => setEditNote({ id: lead.id, value: e.target.value })}
                          rows={2}
                          className="w-full rounded border border-brand-gold/30 bg-[#111] px-2 py-1 text-xs text-brand-text focus:outline-none resize-none"
                          autoFocus
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => {
                              patchLead(lead.id, { notes: editNote.value });
                              setEditNote(null);
                            }}
                            className="rounded bg-brand-gold/20 p-1 text-brand-gold hover:bg-brand-gold/30"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditNote(null)}
                            className="rounded bg-zinc-800 p-1 text-brand-muted hover:text-brand-text"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditNote({ id: lead.id, value: lead.notes ?? '' })}
                        className="w-full text-left text-xs text-brand-muted hover:text-brand-text transition truncate block max-w-[160px]"
                        title={lead.notes ?? 'Agregar nota'}
                      >
                        {lead.notes ? (
                          <span className="text-brand-muted/80">{lead.notes}</span>
                        ) : (
                          <span className="text-brand-muted/40 italic">+ nota</span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Última acción */}
                  <td className="px-4 py-3 text-xs text-brand-muted whitespace-nowrap">
                    {fmtDate(lead.last_action_at ?? lead.updated_at)}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    {!lead.is_closed && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => patchLead(lead.id, {
                            current_status: 'REUNION_AGENDADA',
                          })}
                          title="Reunión agendada"
                          className="rounded border border-[rgba(212,175,55,0.2)] px-2 py-1 text-[10px] text-brand-gold hover:bg-[rgba(212,175,55,0.1)] transition whitespace-nowrap"
                        >
                          Reunión ✓
                        </button>
                        <button
                          onClick={() => patchLead(lead.id, {
                            current_status: 'NO_CALIFICA',
                            is_closed: true,
                            closed_reason: 'No califica',
                          })}
                          title="No califica — cerrar"
                          className="rounded border border-red-800/40 px-2 py-1 text-[10px] text-red-400 hover:bg-red-900/20 transition whitespace-nowrap"
                        >
                          ✕ NC
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
