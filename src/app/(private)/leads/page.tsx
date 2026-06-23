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

const STAGES = [
  { key: 'NO_CONTACTADO',        label: 'Sin Contactar',    color: 'text-zinc-400',    active: 'bg-zinc-700 text-white',      dot: 'bg-zinc-500'    },
  { key: 'APERTURA_ENVIADA',     label: 'Apertura Enviada', color: 'text-zinc-400',    active: 'bg-zinc-700 text-white',      dot: 'bg-zinc-400'    },
  { key: 'CONTACTADO',           label: 'Contactado',       color: 'text-zinc-300',    active: 'bg-zinc-600 text-white',      dot: 'bg-zinc-300'    },
  { key: 'NO_RESPONDE',          label: 'No Responde',      color: 'text-red-400',     active: 'bg-red-700 text-white',       dot: 'bg-red-500'     },
  { key: 'RESPONDIO',            label: 'Respondió',        color: 'text-blue-400',    active: 'bg-blue-700 text-white',      dot: 'bg-blue-400'    },
  { key: 'INTERES_DETECTADO',    label: 'Interés',          color: 'text-blue-300',    active: 'bg-blue-600 text-white',      dot: 'bg-blue-400'    },
  { key: 'INVITADO_AL_GRUPO',    label: 'Invitado Grupo',   color: 'text-blue-300',    active: 'bg-blue-600 text-white',      dot: 'bg-blue-400'    },
  { key: 'INGRESO_AL_GRUPO',     label: 'En Grupo',         color: 'text-blue-300',    active: 'bg-blue-600 text-white',      dot: 'bg-blue-400'    },
  { key: 'ACTIVO_EN_GRUPO',      label: 'Activo Grupo',     color: 'text-blue-200',    active: 'bg-blue-500 text-white',      dot: 'bg-blue-300'    },
  { key: 'DIAGNOSTICO_INICIADO', label: 'Diagnóstico',      color: 'text-yellow-400',  active: 'bg-yellow-600 text-black',    dot: 'bg-yellow-400'  },
  { key: 'DIAGNOSTICO_PROFUNDO', label: 'Diagn. Profundo',  color: 'text-yellow-300',  active: 'bg-yellow-500 text-black',    dot: 'bg-yellow-300'  },
  { key: 'REUNION_PROPUESTA',    label: 'Reunión Prop.',    color: 'text-yellow-300',  active: 'bg-yellow-500 text-black',    dot: 'bg-yellow-400'  },
  { key: 'REUNION_AGENDADA',     label: 'Reunión ✓',        color: 'text-emerald-400', active: 'bg-emerald-600 text-white',   dot: 'bg-emerald-400' },
  { key: 'SEGUIMIENTO_FUTURO',   label: 'Seguim. Futuro',   color: 'text-zinc-500',    active: 'bg-zinc-700 text-zinc-300',   dot: 'bg-zinc-600'    },
  { key: 'NO_CALIFICA',          label: 'No Califica',      color: 'text-red-500',     active: 'bg-red-900 text-red-300',     dot: 'bg-red-600'     },
] as const;

type StageKey = (typeof STAGES)[number]['key'];

export default function LeadsPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [openings, setOpenings]     = useState<OpeningMessage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [activeStage, setActiveStage] = useState<StageKey>('NO_CONTACTADO');
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [moveTarget, setMoveTarget]   = useState<Lead | null>(null);
  const [setterName, setSetterName]   = useState('');
  const tabsRef = useRef<HTMLDivElement>(null);

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

  async function moveLead(lead: Lead, newStatus: StageKey) {
    setSaving(lead.id);
    setMoveTarget(null);
    const body: Record<string, unknown> = { current_status: newStatus };
    if (newStatus === 'NO_CALIFICA') { body.is_closed = true; body.closed_reason = 'No califica'; }
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updated } : l));
      setActiveStage(newStatus);
    }
    setSaving(null);
  }

  // Contar leads por etapa (solo activos)
  const countByStage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads.filter(l => !l.is_closed)) {
      m[l.current_status] = (m[l.current_status] ?? 0) + 1;
    }
    return m;
  }, [leads]);

  const totalActive = leads.filter(l => !l.is_closed).length;

  // Cards visibles en la etapa activa
  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (l.current_status !== activeStage) return false;
      if (!q) return true;
      return (
        `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [leads, activeStage, search]);

  const activeStageInfo = STAGES.find(s => s.key === activeStage)!;

  // Auto-scroll tab activo al centro
  function selectStage(key: StageKey) {
    setActiveStage(key);
    setSearch('');
    // scroll tab into view
    setTimeout(() => {
      const el = document.getElementById(`tab-${key}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 50);
  }

  return (
    <div className="flex flex-col h-screen bg-[#080808]">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-yellow-500/70">Pipeline</p>
            <p className="text-lg font-bold text-white leading-tight">{totalActive} leads activos</p>
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o mail..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-zinc-500" /></button>}
        </div>
      </div>

      {/* ── Stage tabs ── */}
      <div ref={tabsRef} className="shrink-0 overflow-x-auto border-b border-white/5">
        <div className="flex gap-1.5 px-3 py-2.5 min-w-max">
          {STAGES.map(stage => {
            const count   = countByStage[stage.key] ?? 0;
            const isActive = activeStage === stage.key;
            return (
              <button
                id={`tab-${stage.key}`}
                key={stage.key}
                onClick={() => selectStage(stage.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all',
                  isActive
                    ? stage.active
                    : 'bg-zinc-900/60 text-zinc-600 hover:text-zinc-400 border border-zinc-800'
                )}
              >
                {stage.label}
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center',
                    isActive ? 'bg-white/20' : 'bg-zinc-700 text-zinc-300'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">

          {/* Etapa actual label */}
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className={cn('h-2 w-2 rounded-full', activeStageInfo.dot)} />
            <span className={cn('text-xs font-semibold', activeStageInfo.color)}>{activeStageInfo.label}</span>
            <span className="text-xs text-zinc-600">· {visibleCards.length} lead{visibleCards.length !== 1 ? 's' : ''}</span>
          </div>

          {visibleCards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <span className="text-2xl">📭</span>
              </div>
              <p className="text-sm text-zinc-500">
                {search ? `Sin resultados para "${search}"` : 'No hay leads en esta etapa'}
              </p>
            </div>
          ) : (
            visibleCards.map(lead => {
              const waPhone  = lead.phone.replace(/\D/g, '');
              const fullName = `${lead.first_name} ${lead.last_name ?? ''}`.trim();
              const isSaving = saving === lead.id;
              return (
                <div key={lead.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">

                  {/* Nombre */}
                  <p className="font-bold text-white text-[15px] leading-snug">{fullName}</p>

                  {/* Contacto */}
                  <div className="space-y-1">
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[13px] text-blue-400 font-mono hover:text-blue-300 transition-colors block"
                    >
                      {lead.phone}
                    </a>
                    {lead.email && (
                      <p className="text-[12px] text-zinc-500">{lead.email}</p>
                    )}
                  </div>

                  {/* Nota */}
                  {lead.notes && (
                    <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2 italic">{lead.notes}</p>
                  )}

                  {/* Seguimiento + acciones */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    {/* Dots */}
                    <div className="flex gap-1">
                      {Array.from({ length: lead.max_follow_ups }).map((_, i) => (
                        <div key={i} className={cn(
                          'h-1.5 w-5 rounded-full transition-colors',
                          i < lead.follow_up_count ? activeStageInfo.dot : 'bg-zinc-800'
                        )} />
                      ))}
                    </div>

                    {/* Botones */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setContactLead(lead)}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 hover:text-white hover:border-zinc-600 transition"
                        title="Contactar"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setMoveTarget(lead)}
                        disabled={isSaving}
                        className={cn(
                          'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                          'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white hover:border-zinc-600',
                          'disabled:opacity-40'
                        )}
                      >
                        {isSaving ? 'Moviendo...' : <>Cambiar etapa <ChevronRight className="h-3.5 w-3.5" /></>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Modal contactar ── */}
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

      {/* ── Bottom sheet: mover etapa ── */}
      {moveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setMoveTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-zinc-700" />
            </div>

            <div className="px-5 pb-4 pt-2">
              <p className="text-base font-bold text-white">{moveTarget.first_name} {moveTarget.last_name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Etapa actual: <span className="text-zinc-300">{STATUS_LABELS[moveTarget.current_status as LeadStatus] ?? moveTarget.current_status}</span>
              </p>
            </div>

            <div className="overflow-y-auto max-h-[50vh] px-3 pb-6 space-y-1">
              {STAGES.map(stage => {
                const isCurrent = moveTarget.current_status === stage.key;
                return (
                  <button
                    key={stage.key}
                    onClick={() => !isCurrent && moveLead(moveTarget, stage.key)}
                    disabled={isCurrent}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition text-left',
                      isCurrent
                        ? cn(stage.active, 'opacity-90 cursor-default ring-1 ring-white/10')
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 active:scale-[0.98]'
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', stage.dot)} />
                    <span className="flex-1">{stage.label}</span>
                    {isCurrent && <span className="text-[10px] font-normal opacity-60">etapa actual</span>}
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
