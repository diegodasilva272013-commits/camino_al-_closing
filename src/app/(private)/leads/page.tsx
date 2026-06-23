'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, MessageCircle, ChevronDown, ChevronUp,
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download,
} from 'lucide-react';
import { ContactModal } from './_components/ContactModal';
import { ConversationPanel } from './_components/ConversationPanel';
import { LEAD_STATUSES, STATUS_LABELS, STATUS_COLORS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
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
type SortKey = 'name' | 'status' | 'followups' | 'updated';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<string, number> = {
  NO_CONTACTADO:        0,
  APERTURA_ENVIADA:     1,
  CONTACTADO:           2,
  NO_RESPONDE:          3,
  RESPONDIO:            4,
  INTERES_DETECTADO:    5,
  INVITADO_AL_GRUPO:    6,
  INGRESO_AL_GRUPO:     7,
  ACTIVO_EN_GRUPO:      8,
  DIAGNOSTICO_INICIADO: 9,
  DIAGNOSTICO_PROFUNDO: 10,
  REUNION_PROPUESTA:    11,
  REUNION_AGENDADA:     12,
  SEGUIMIENTO_FUTURO:   13,
  NO_CALIFICA:          14,
};

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [openings, setOpenings] = useState<OpeningMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; value: string } | null>(null);
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [statusOpen, setStatusOpen]   = useState<string | null>(null); // lead id con sheet abierto
  const [setterName, setSetterName]   = useState('');

  // Filters & sort
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClosed, setFilterClosed] = useState<'all' | 'open' | 'closed'>('open');
  const [sortKey, setSortKey]           = useState<SortKey>('updated');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');

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

  useEffect(() => {
    fetch('/api/profile/me').then(r => r.json()).then(d => { if (d.full_name) setSetterName(d.full_name); }).catch(() => {});
  }, []);

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const visible = useMemo(() => {
    let result = leads;
    if (filterClosed === 'open')   result = result.filter(l => !l.is_closed);
    if (filterClosed === 'closed') result = result.filter(l => l.is_closed);
    if (filterStatus) result = result.filter(l => l.current_status === filterStatus);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(l =>
        `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.notes ?? '').toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        const na = `${a.first_name} ${a.last_name ?? ''}`.toLowerCase();
        const nb = `${b.first_name} ${b.last_name ?? ''}`.toLowerCase();
        cmp = na.localeCompare(nb, 'es');
      } else if (sortKey === 'status') {
        cmp = (STATUS_ORDER[a.current_status] ?? 99) - (STATUS_ORDER[b.current_status] ?? 99);
      } else if (sortKey === 'followups') {
        cmp = a.follow_up_count - b.follow_up_count;
      } else {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [leads, search, filterStatus, filterClosed, sortKey, sortDir]);

  const open   = leads.filter(l => !l.is_closed);
  const closed = leads.filter(l => l.is_closed);

  const statusCounts = useMemo(() => {
    const base = filterClosed === 'open' ? open : filterClosed === 'closed' ? closed : leads;
    return base.reduce<Record<string, number>>((acc, l) => {
      acc[l.current_status] = (acc[l.current_status] ?? 0) + 1;
      return acc;
    }, {});
  }, [leads, filterClosed]);

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap border transition',
          active
            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
            : 'border-white/8 text-zinc-500 hover:text-zinc-300'
        )}
      >
        {label}
        {active
          ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    );
  }

  // El lead cuyo sheet de estado está abierto
  const sheetLead = statusOpen ? leads.find(l => l.id === statusOpen) : null;

  return (
    <div className="min-h-screen bg-[#080808] pb-24">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#080808]/95 backdrop-blur border-b border-white/5 px-4 pt-3 pb-2 space-y-2">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/60">Mis Leads</p>
            <p className="text-sm font-semibold text-white">
              {open.length} activos · {closed.length} cerrados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/leads/export"
              download
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-900/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/20 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </a>
            <button
              onClick={load} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, mail o nota..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-9 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-zinc-500" />
            </button>
          )}
        </div>

        {/* Activos / Cerrados */}
        <div className="flex gap-1.5">
          {([['open', 'Activos'], ['closed', 'Cerrados'], ['all', 'Todos']] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setFilterClosed(v); setFilterStatus(''); }}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-semibold border transition',
                filterClosed === v
                  ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400'
                  : 'border-white/10 text-zinc-500'
              )}>
              {l} ({v === 'open' ? open.length : v === 'closed' ? closed.length : leads.length})
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="overflow-x-auto">
          <div className="flex gap-1.5 pb-1 min-w-max">
            <button
              onClick={() => setFilterStatus('')}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap border transition',
                !filterStatus ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400' : 'border-white/10 text-zinc-500'
              )}>
              Todos ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})
            </button>
            {Object.entries(statusCounts).sort(([,a],[,b]) => b - a).map(([status, count]) => (
              <button key={status} onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap border transition',
                  filterStatus === status ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400' : 'border-white/10 text-zinc-500'
                )}>
                {STATUS_LABELS[status as LeadStatus] ?? status} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Sort row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] text-zinc-600 shrink-0 mr-0.5">Ordenar:</span>
          <SortBtn k="name" label="Nombre" />
          <SortBtn k="status" label="Estado" />
          <SortBtn k="followups" label="Seguim." />
          <SortBtn k="updated" label="Última acción" />
        </div>

        {(search || filterStatus) && (
          <p className="text-[11px] text-zinc-500 pb-1">
            {visible.length} resultado{visible.length !== 1 ? 's' : ''}
            {search && ` para "${search}"`}
            {filterStatus && ` · ${STATUS_LABELS[filterStatus as LeadStatus] ?? filterStatus}`}
          </p>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center pt-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-24 text-center px-8">
          <p className="text-zinc-400">
            {search ? `Sin resultados para "${search}"` : 'No hay leads con ese filtro.'}
          </p>
          <button onClick={() => { setSearch(''); setFilterStatus(''); }}
            className="text-xs text-yellow-400 underline">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="px-3 pt-3 space-y-2">
          {visible.map((lead) => {
            const isExpanded = expanded === lead.id;
            const isSaving   = saving === lead.id;
            const fullName   = `${lead.first_name} ${lead.last_name ?? ''}`.trim();
            const waPhone    = lead.phone.replace(/\D/g, '');

            return (
              <div
                key={lead.id}
                className={cn(
                  'rounded-2xl border bg-zinc-900/60 overflow-hidden transition',
                  lead.is_closed ? 'border-white/5 opacity-60' : 'border-white/8',
                  isExpanded && 'border-yellow-500/20'
                )}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">

                  {/* Info — tap to expand */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer active:opacity-70"
                    onClick={() => setExpanded(isExpanded ? null : lead.id)}
                  >
                    <p className="font-semibold text-white text-sm truncate">{fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {/* Celular → WhatsApp directo */}
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] text-emerald-400 font-mono hover:text-emerald-300 transition-colors"
                      >
                        {lead.phone}
                      </a>
                      {lead.email && (
                        <span className="text-[11px] text-zinc-500 truncate max-w-[160px]">{lead.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Estado — tap abre sheet */}
                  {!lead.is_closed ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setStatusOpen(lead.id); }}
                      disabled={isSaving}
                      className={cn(
                        'shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition active:scale-95 disabled:opacity-50',
                        STATUS_COLORS[lead.current_status as LeadStatus] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      )}
                    >
                      {isSaving ? '...' : STATUS_LABELS[lead.current_status as LeadStatus] ?? lead.current_status}
                    </button>
                  ) : (
                    <span className="shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap bg-zinc-800/60 text-zinc-500 border-zinc-700/40">
                      Cerrado
                    </span>
                  )}

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : lead.id)}
                    className="text-zinc-600 shrink-0"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-4 space-y-4">

                    {!lead.is_closed && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setContactLead(lead)}
                          className="flex items-center gap-1.5 rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-3 py-1.5 text-xs font-bold text-yellow-400 active:bg-yellow-900/40"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Contactar
                        </button>
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-xs text-emerald-400 active:bg-emerald-900/40"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
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
                            <div key={i} className={cn('h-2 w-2 rounded-full', i < lead.follow_up_count ? 'bg-yellow-400' : 'bg-zinc-700')} />
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
                          {openings.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
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
                            rows={3} autoFocus
                            className="w-full rounded-lg border border-yellow-500/30 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { patchLead(lead.id, { notes: noteEdit.value }); setNoteEdit(null); }}
                              className="rounded-lg bg-yellow-500/20 border border-yellow-500/40 px-4 py-1.5 text-xs text-yellow-400"
                            >
                              Guardar
                            </button>
                            <button onClick={() => setNoteEdit(null)}
                              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400">
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

                    {lead.last_action_at && (
                      <p className="text-[10px] text-zinc-600">
                        Última acción: {new Date(lead.last_action_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    <div className="pt-1 border-t border-zinc-800">
                      <ConversationPanel leadId={lead.id} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contact modal */}
      {contactLead && (
        <ContactModal
          lead={contactLead}
          setterName={setterName}
          onClose={() => setContactLead(null)}
          onSent={(leadId) => {
            setContactLead(null);
            setLeads(prev => prev.map(l => l.id === leadId
              ? { ...l, current_status: l.current_status === 'NO_CONTACTADO' ? 'APERTURA_ENVIADA' : l.current_status }
              : l
            ));
          }}
        />
      )}

      {/* Status bottom sheet */}
      {sheetLead && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setStatusOpen(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-700 rounded-t-2xl pb-safe">
            <div className="p-4 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 text-center">
                {sheetLead.first_name} {sheetLead.last_name} — cambiar estado
              </p>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-3 space-y-1.5">
              {LEAD_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    patchLead(sheetLead.id, { current_status: s });
                    setStatusOpen(null);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition active:scale-[0.98]',
                    STATUS_COLORS[s],
                    sheetLead.current_status === s && 'ring-2 ring-white/25'
                  )}
                >
                  <span className="flex items-center justify-between">
                    {STATUS_LABELS[s]}
                    {sheetLead.current_status === s && <span className="text-base">✓</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

