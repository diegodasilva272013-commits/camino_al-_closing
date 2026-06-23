'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Search, X, MessageCircle, ChevronRight, Download } from 'lucide-react';
import { ContactModal } from './_components/ContactModal';
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from '@/constants/leads';
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

// Pipeline columns — paleta alineada al logo (azul · amarillo · negro · gris)
const COLUMNS = [
  { key: 'NO_CONTACTADO',        label: 'Sin Contactar',     phase: 'new'      },
  { key: 'APERTURA_ENVIADA',     label: 'Apertura Enviada',  phase: 'new'      },
  { key: 'CONTACTADO',           label: 'Contactado',        phase: 'contact'  },
  { key: 'NO_RESPONDE',          label: 'No Responde',       phase: 'stuck'    },
  { key: 'RESPONDIO',            label: 'Respondió',         phase: 'blue'     },
  { key: 'INTERES_DETECTADO',    label: 'Interés',           phase: 'blue'     },
  { key: 'INVITADO_AL_GRUPO',    label: 'Invitado Grupo',    phase: 'blue'     },
  { key: 'INGRESO_AL_GRUPO',     label: 'En Grupo',          phase: 'blue'     },
  { key: 'ACTIVO_EN_GRUPO',      label: 'Activo Grupo',      phase: 'blue'     },
  { key: 'DIAGNOSTICO_INICIADO', label: 'Diagnóstico',       phase: 'gold'     },
  { key: 'DIAGNOSTICO_PROFUNDO', label: 'Diagn. Profundo',   phase: 'gold'     },
  { key: 'REUNION_PROPUESTA',    label: 'Reunión Prop.',     phase: 'gold'     },
  { key: 'REUNION_AGENDADA',     label: 'Reunión ✓',         phase: 'won'      },
  { key: 'SEGUIMIENTO_FUTURO',   label: 'Seguim. Futuro',    phase: 'paused'   },
  { key: 'NO_CALIFICA',          label: 'No Califica',       phase: 'lost'     },
] as const;

type Phase = (typeof COLUMNS)[number]['phase'];

const PHASE: Record<Phase, { col: string; header: string; badge: string; bar: string }> = {
  new:     { col: 'bg-zinc-900/60 border-zinc-700/50',          header: 'text-zinc-400',       badge: 'bg-zinc-700 text-zinc-300',                       bar: 'bg-zinc-600'    },
  contact: { col: 'bg-zinc-900/60 border-zinc-600/50',          header: 'text-zinc-300',       badge: 'bg-zinc-600 text-white',                          bar: 'bg-zinc-400'    },
  stuck:   { col: 'bg-red-950/30 border-red-900/40',            header: 'text-red-400',        badge: 'bg-red-900/60 text-red-300',                      bar: 'bg-red-500'     },
  blue:    { col: 'bg-blue-950/25 border-blue-800/40',          header: 'text-blue-400',       badge: 'bg-blue-900/50 text-blue-300',                    bar: 'bg-blue-500'    },
  gold:    { col: 'bg-yellow-950/20 border-yellow-700/40',      header: 'text-yellow-400',     badge: 'bg-yellow-900/40 text-yellow-300',                bar: 'bg-yellow-400'  },
  won:     { col: 'bg-emerald-950/30 border-emerald-700/50',    header: 'text-emerald-400',    badge: 'bg-emerald-900/50 text-emerald-300',              bar: 'bg-emerald-400' },
  paused:  { col: 'bg-zinc-900/40 border-zinc-800/40',          header: 'text-zinc-500',       badge: 'bg-zinc-800 text-zinc-500',                       bar: 'bg-zinc-600'    },
  lost:    { col: 'bg-zinc-950/80 border-red-900/30',           header: 'text-red-500/80',     badge: 'bg-red-950/60 text-red-400',                      bar: 'bg-red-700'     },
};

export default function LeadsPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [openings, setOpenings]     = useState<OpeningMessage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState<string | null>(null);
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [statusOpen, setStatusOpen]   = useState<Lead | null>(null);
  const [setterName, setSetterName]   = useState('');
  const [search, setSearch]           = useState('');
  const [showClosed, setShowClosed]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [lr, or] = await Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/opening-messages').then(r => r.json()),
    ]);
    setLeads(Array.isArray(lr) ? lr : []);
    setOpenings(Array.isArray(or) ? or : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/profile/me').then(r => r.json()).then(d => { if (d.full_name) setSetterName(d.full_name); }).catch(() => {});
  }, []);

  async function moveToStatus(lead: Lead, newStatus: string) {
    setSaving(lead.id);
    const isClosed = newStatus === 'NO_CALIFICA';
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_status: newStatus, ...(isClosed ? { is_closed: true, closed_reason: 'No califica' } : {}) }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updated } : l));
    }
    setSaving(null);
    setStatusOpen(null);
  }

  const open   = leads.filter(l => !l.is_closed);
  const closed = leads.filter(l => l.is_closed);

  const visible = useMemo(() => {
    const base = showClosed ? leads : open;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(l =>
      `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  }, [leads, search, showClosed]);

  const byStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const l of visible) {
      if (map[l.current_status]) map[l.current_status].push(l);
    }
    return map;
  }, [visible]);

  return (
    <div className="flex flex-col h-screen bg-[#080808] overflow-hidden">

      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/60 font-medium">Pipeline</p>
            <p className="text-sm font-semibold text-white">{open.length} activos · {closed.length} cerrados</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/leads/export" download className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </a>
            <button onClick={load} disabled={loading} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lead..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 pl-9 pr-8 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-zinc-500" /></button>}
          </div>

          {/* Toggle cerrados */}
          <button
            onClick={() => setShowClosed(v => !v)}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition',
              showClosed ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            )}
          >
            {showClosed ? 'Todos' : 'Activos'}
          </button>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-2.5 h-full px-3 py-3 min-w-max">
            {COLUMNS.map(col => {
              const colLeads = byStatus[col.key] ?? [];
              const style    = PHASE[col.phase];
              return (
                <div key={col.key} className={cn('flex flex-col w-[210px] rounded-2xl border', style.col)}>
                  {/* Column header */}
                  <div className="px-3.5 pt-3 pb-2.5">
                    <div className="flex items-center justify-between">
                      <p className={cn('text-[11px] font-bold uppercase tracking-wider', style.header)}>{col.label}</p>
                      {colLeads.length > 0 && (
                        <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', style.badge)}>
                          {colLeads.length}
                        </span>
                      )}
                    </div>
                    {/* Color bar */}
                    <div className={cn('h-0.5 rounded-full mt-2 opacity-60', style.bar)} />
                  </div>

                  {/* Lead cards */}
                  <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2 scrollbar-thin">
                    {colLeads.length === 0 ? (
                      <div className="flex items-center justify-center h-16">
                        <p className="text-[10px] text-zinc-700">Vacío</p>
                      </div>
                    ) : (
                      colLeads.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          saving={saving === lead.id}
                          onMove={() => setStatusOpen(lead)}
                          onContact={() => setContactLead(lead)}
                          phaseStyle={style}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal contactar */}
      {contactLead && (
        <ContactModal
          lead={contactLead}
          setterName={setterName}
          onClose={() => setContactLead(null)}
          onSent={leadId => {
            setContactLead(null);
            setLeads(prev => prev.map(l => l.id === leadId
              ? { ...l, current_status: l.current_status === 'NO_CONTACTADO' ? 'APERTURA_ENVIADA' : l.current_status }
              : l
            ));
          }}
        />
      )}

      {/* Bottom sheet — mover lead */}
      {statusOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setStatusOpen(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800 rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <p className="text-sm font-semibold text-white">
                  {statusOpen.first_name} {statusOpen.last_name}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Ahora en <span className="text-zinc-300">{STATUS_LABELS[statusOpen.current_status as LeadStatus] ?? statusOpen.current_status}</span> · Mover a:
                </p>
              </div>
              <button onClick={() => setStatusOpen(null)} className="p-2 text-zinc-600 hover:text-zinc-300 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-3 space-y-1">
              {COLUMNS.map(col => {
                const isCurrent = statusOpen.current_status === col.key;
                const s = PHASE[col.phase];
                return (
                  <button
                    key={col.key}
                    onClick={() => moveToStatus(statusOpen, col.key)}
                    disabled={isCurrent}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition active:scale-[0.99]',
                      isCurrent
                        ? cn('border-yellow-500/30 bg-yellow-500/10 text-yellow-400', 'cursor-default')
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={cn('h-2 w-2 rounded-full shrink-0', s.bar)} />
                      {col.label}
                    </span>
                    {isCurrent
                      ? <span className="text-[10px] text-yellow-500/70 font-normal">actual</span>
                      : <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
                    }
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LeadCard({
  lead, saving, onMove, onContact, phaseStyle,
}: {
  lead: Lead;
  saving: boolean;
  onMove: () => void;
  onContact: () => void;
  phaseStyle: { bar: string };
}) {
  const waPhone  = lead.phone.replace(/\D/g, '');
  const fullName = `${lead.first_name} ${lead.last_name ?? ''}`.trim();

  return (
    <div className="bg-[#0f0f0f] border border-zinc-800/80 rounded-xl p-3 space-y-2.5 hover:border-zinc-700 transition">
      {/* Nombre */}
      <p className="text-[13px] font-semibold text-white leading-snug">{fullName}</p>

      {/* Teléfono → WhatsApp */}
      <a
        href={`https://wa.me/${waPhone}`}
        target="_blank" rel="noopener noreferrer"
        className="text-[11px] text-blue-400 font-mono block hover:text-blue-300 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {lead.phone}
      </a>

      {/* Mail */}
      {lead.email && (
        <p className="text-[10px] text-zinc-600 truncate">{lead.email}</p>
      )}

      {/* Follow-up bar + acciones */}
      <div className="flex items-center justify-between gap-2">
        {/* Dots seguimiento */}
        <div className="flex gap-0.5">
          {Array.from({ length: lead.max_follow_ups }).map((_, i) => (
            <div
              key={i}
              className={cn('h-1 w-3.5 rounded-full', i < lead.follow_up_count ? phaseStyle.bar : 'bg-zinc-800')}
            />
          ))}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onContact}
            title="Contactar"
            className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition"
          >
            <MessageCircle className="h-3 w-3" />
          </button>
          <button
            onClick={onMove}
            disabled={saving}
            title="Mover a..."
            className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition disabled:opacity-40"
          >
            {saving ? '...' : <>Mover <ChevronRight className="h-3 w-3" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
