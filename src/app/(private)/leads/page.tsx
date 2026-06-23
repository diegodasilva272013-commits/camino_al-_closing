'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Search, X, MessageCircle, ChevronRight } from 'lucide-react';
import { ContactModal } from './_components/ContactModal';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  current_status: string;
  follow_up_count: number;
  max_follow_ups: number;
  notes: string | null;
  last_action_at: string | null;
  updated_at: string;
  is_closed: boolean;
  opening_message_used: string | null;
  next_follow_up_at: string | null;
  country: string | null;
};

type OpeningMessage = { id: string; name: string; message: string };

// 6 columnas macro — llenan el ancho sin scroll horizontal
const MACRO = [
  {
    id:            'sin_contactar',
    label:         'Sin Contactar',
    statuses:      ['NO_CONTACTADO', 'APERTURA_ENVIADA'],
    dropStatus:    'NO_CONTACTADO',
    col:           'border-zinc-700/60',
    header:        'text-zinc-300',
    bar:           'bg-zinc-500',
    over:          'ring-2 ring-zinc-400 bg-zinc-800/30',
    badge:         'bg-zinc-700 text-zinc-300',
  },
  {
    id:            'contactado',
    label:         'Contactado',
    statuses:      ['CONTACTADO', 'NO_RESPONDE'],
    dropStatus:    'CONTACTADO',
    col:           'border-blue-800/50',
    header:        'text-blue-400',
    bar:           'bg-blue-500',
    over:          'ring-2 ring-blue-500 bg-blue-950/30',
    badge:         'bg-blue-900/60 text-blue-300',
  },
  {
    id:            'respondio',
    label:         'Respondió',
    statuses:      ['RESPONDIO', 'INTERES_DETECTADO', 'INVITADO_AL_GRUPO', 'INGRESO_AL_GRUPO', 'ACTIVO_EN_GRUPO'],
    dropStatus:    'RESPONDIO',
    col:           'border-blue-600/40',
    header:        'text-blue-300',
    bar:           'bg-blue-400',
    over:          'ring-2 ring-blue-400 bg-blue-900/20',
    badge:         'bg-blue-800/60 text-blue-200',
  },
  {
    id:            'diagnostico',
    label:         'Diagnóstico',
    statuses:      ['DIAGNOSTICO_INICIADO', 'DIAGNOSTICO_PROFUNDO', 'REUNION_PROPUESTA'],
    dropStatus:    'DIAGNOSTICO_INICIADO',
    col:           'border-yellow-700/50',
    header:        'text-yellow-400',
    bar:           'bg-yellow-400',
    over:          'ring-2 ring-yellow-400 bg-yellow-950/20',
    badge:         'bg-yellow-900/50 text-yellow-300',
  },
  {
    id:            'reunion',
    label:         'Reunión ✓',
    statuses:      ['REUNION_AGENDADA'],
    dropStatus:    'REUNION_AGENDADA',
    col:           'border-emerald-700/50',
    header:        'text-emerald-400',
    bar:           'bg-emerald-400',
    over:          'ring-2 ring-emerald-400 bg-emerald-950/20',
    badge:         'bg-emerald-900/50 text-emerald-300',
  },
  {
    id:            'no_avanza',
    label:         'No Avanza',
    statuses:      ['SEGUIMIENTO_FUTURO', 'NO_CALIFICA'],
    dropStatus:    'NO_CALIFICA',
    col:           'border-zinc-800/60',
    header:        'text-zinc-600',
    bar:           'bg-zinc-700',
    over:          'ring-2 ring-red-600 bg-red-950/20',
    badge:         'bg-zinc-800 text-zinc-500',
  },
] as const;

type MacroId = (typeof MACRO)[number]['id'];

// Todos los sub-estados con su macro
const ALL_STATUSES = [
  { key: 'NO_CONTACTADO',        macro: 'sin_contactar' },
  { key: 'APERTURA_ENVIADA',     macro: 'sin_contactar' },
  { key: 'CONTACTADO',           macro: 'contactado'    },
  { key: 'NO_RESPONDE',          macro: 'contactado'    },
  { key: 'RESPONDIO',            macro: 'respondio'     },
  { key: 'INTERES_DETECTADO',    macro: 'respondio'     },
  { key: 'INVITADO_AL_GRUPO',    macro: 'respondio'     },
  { key: 'INGRESO_AL_GRUPO',     macro: 'respondio'     },
  { key: 'ACTIVO_EN_GRUPO',      macro: 'respondio'     },
  { key: 'DIAGNOSTICO_INICIADO', macro: 'diagnostico'   },
  { key: 'DIAGNOSTICO_PROFUNDO', macro: 'diagnostico'   },
  { key: 'REUNION_PROPUESTA',    macro: 'diagnostico'   },
  { key: 'REUNION_AGENDADA',     macro: 'reunion'       },
  { key: 'SEGUIMIENTO_FUTURO',   macro: 'no_avanza'     },
  { key: 'NO_CALIFICA',          macro: 'no_avanza'     },
] as const;

function getMacro(status: string): typeof MACRO[number] | undefined {
  const entry = ALL_STATUSES.find(s => s.key === status);
  return MACRO.find(m => m.id === entry?.macro);
}

export default function LeadsPage() {
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [moveTarget, setMoveTarget]   = useState<Lead | null>(null);
  const [setterName, setSetterName]   = useState('');

  // Drag state
  const [dragging, setDragging]   = useState<Lead | null>(null);
  const [dragOver, setDragOver]   = useState<MacroId | null>(null);

  // Touch drag state
  const touchDrag  = useRef<Lead | null>(null);
  const touchClone = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const lr = await fetch('/api/leads').then(r => r.json());
    setLeads(Array.isArray(lr) ? lr : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/profile/me').then(r => r.json()).then(d => { if (d.full_name) setSetterName(d.full_name); }).catch(() => {});
  }, []);

  async function moveLead(lead: Lead, newStatus: string) {
    if (lead.current_status === newStatus) { setMoveTarget(null); return; }
    setSaving(lead.id);
    const isClosed = newStatus === 'NO_CALIFICA';
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_status: newStatus, ...(isClosed ? { is_closed: true, closed_reason: 'No califica' } : { is_closed: false }) }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updated } : l));
    }
    setSaving(null);
    setMoveTarget(null);
    setDragging(null);
    setDragOver(null);
  }

  const open = leads.filter(l => !l.is_closed);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return open;
    return open.filter(l =>
      `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  }, [open, search]);

  const byMacro = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const m of MACRO) map[m.id] = [];
    for (const l of visible) {
      const m = getMacro(l.current_status);
      if (m) map[m.id].push(l);
    }
    return map;
  }, [visible]);

  // ── Touch drag handlers ──
  function onTouchStart(lead: Lead, e: React.TouchEvent) {
    touchDrag.current = lead;
    const touch = e.touches[0];
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();

    const clone = el.cloneNode(true) as HTMLDivElement;
    clone.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none; opacity:0.85;
      width:${rect.width}px; top:${touch.clientY - 20}px; left:${touch.clientX - rect.width / 2}px;
      box-shadow:0 8px 32px rgba(0,0,0,0.6); transform:rotate(2deg) scale(1.03);
      border-radius:12px;
    `;
    document.body.appendChild(clone);
    touchClone.current = clone;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchClone.current) return;
    const touch = e.touches[0];
    const w = touchClone.current.offsetWidth;
    touchClone.current.style.top  = `${touch.clientY - 20}px`;
    touchClone.current.style.left = `${touch.clientX - w / 2}px`;

    // detect which column we're over
    touchClone.current.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.current.style.display = '';
    const col = el?.closest('[data-macro-id]');
    const id  = col?.getAttribute('data-macro-id') as MacroId | null;
    setDragOver(id ?? null);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchClone.current) { document.body.removeChild(touchClone.current); touchClone.current = null; }
    const lead = touchDrag.current;
    touchDrag.current = null;
    if (!lead || !dragOver) { setDragOver(null); return; }
    const col = MACRO.find(m => m.id === dragOver);
    if (col) moveLead(lead, col.dropStatus);
    else setDragOver(null);
  }

  return (
    <div className="flex flex-col h-screen bg-[#080808]">

      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/70 font-semibold">Pipeline</p>
            <p className="text-sm font-bold text-white">{open.length} leads activos</p>
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o mail..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-zinc-500" /></button>}
        </div>
      </div>

      {/* Kanban — 6 columnas simétricas, sin scroll horizontal */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 h-full">
            {MACRO.map(col => {
              const colLeads = byMacro[col.id] ?? [];
              const isOver   = dragOver === col.id;
              return (
                <div
                  key={col.id}
                  data-macro-id={col.id}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={e => { e.preventDefault(); if (dragging) moveLead(dragging, col.dropStatus); setDragOver(null); }}
                  className={cn(
                    'flex flex-col rounded-2xl border bg-zinc-900/40 transition-all',
                    col.col,
                    isOver && col.over
                  )}
                >
                  {/* Column header */}
                  <div className="px-3 pt-3 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className={cn('text-[11px] font-bold uppercase tracking-wider', col.header)}>{col.label}</p>
                      <span className={cn('text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center', col.badge)}>
                        {colLeads.length}
                      </span>
                    </div>
                    <div className={cn('h-0.5 rounded-full', col.bar, 'opacity-50')} />
                  </div>

                  {/* Cards — scrollable vertical dentro de la columna */}
                  <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                    {colLeads.length === 0 ? (
                      <div className={cn('h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition-all', isOver ? 'border-white/30 bg-white/5' : 'border-zinc-800')}>
                        <p className="text-[10px] text-zinc-700">Soltar aquí</p>
                      </div>
                    ) : (
                      colLeads.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          macroBar={col.bar}
                          macroBadge={col.badge}
                          saving={saving === lead.id}
                          isDragging={dragging?.id === lead.id}
                          onMove={() => setMoveTarget(lead)}
                          onContact={() => setContactLead(lead)}
                          onDragStart={() => setDragging(lead)}
                          onDragEnd={() => { setDragging(null); setDragOver(null); }}
                          onTouchStart={e => onTouchStart(lead, e)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={onTouchEnd}
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

      {/* Bottom sheet — mover a etapa exacta */}
      {moveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setMoveTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl">
            <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-zinc-700" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-white">{moveTarget.first_name} {moveTarget.last_name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Etapa actual: <span className="text-zinc-300">{STATUS_LABELS[moveTarget.current_status as LeadStatus] ?? moveTarget.current_status}</span>
              </p>
            </div>
            <div className="overflow-y-auto max-h-[52vh] px-3 pb-8 space-y-1">
              {ALL_STATUSES.map(({ key }) => {
                const isCurrent = moveTarget.current_status === key;
                const macro     = getMacro(key);
                return (
                  <button
                    key={key}
                    onClick={() => moveLead(moveTarget, key)}
                    disabled={isCurrent}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium transition text-left active:scale-[0.98]',
                      isCurrent
                        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 cursor-default'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', macro?.bar ?? 'bg-zinc-600')} />
                    <span className="flex-1">{STATUS_LABELS[key as LeadStatus] ?? key}</span>
                    {isCurrent && <span className="text-[10px] font-normal text-yellow-500/60">actual</span>}
                    {!isCurrent && <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />}
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
  lead, macroBar, macroBadge, saving, isDragging,
  onMove, onContact, onDragStart, onDragEnd, onTouchStart, onTouchMove, onTouchEnd,
}: {
  lead: Lead;
  macroBar: string;
  macroBadge: string;
  saving: boolean;
  isDragging: boolean;
  onMove: () => void;
  onContact: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}) {
  const waPhone  = lead.phone.replace(/\D/g, '');
  const fullName = `${lead.first_name} ${lead.last_name ?? ''}`.trim();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        'bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2.5 cursor-grab active:cursor-grabbing select-none',
        'hover:border-zinc-700 transition-all',
        isDragging && 'opacity-40 scale-95'
      )}
    >
      {/* Sub-estado badge */}
      <div className="flex items-center justify-between gap-1">
        <span className={cn('text-[9px] font-semibold rounded-full px-1.5 py-0.5 truncate max-w-[120px]', macroBadge)}>
          {STATUS_LABELS[lead.current_status as LeadStatus] ?? lead.current_status}
        </span>
      </div>

      {/* Nombre */}
      <p className="text-[13px] font-bold text-white leading-snug">{fullName}</p>

      {/* Teléfono → WhatsApp */}
      <a
        href={`https://wa.me/${waPhone}`}
        target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className="text-[11px] text-blue-400 font-mono block hover:text-blue-300 transition-colors"
      >
        {lead.phone}
      </a>

      {/* Mail */}
      {lead.email && (
        <p className="text-[10px] text-zinc-600 truncate">{lead.email}</p>
      )}

      {/* Seguimiento + acciones */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <div className="flex gap-0.5">
          {Array.from({ length: lead.max_follow_ups }).map((_, i) => (
            <div key={i} className={cn('h-1 w-3 rounded-full', i < lead.follow_up_count ? macroBar : 'bg-zinc-800')} />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onContact(); }}
            className="p-1 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition"
          >
            <MessageCircle className="h-3 w-3" />
          </button>
          <button
            disabled={saving}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onMove(); }}
            className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition disabled:opacity-40"
          >
            {saving ? '...' : <>Mover <ChevronRight className="h-3 w-3" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
