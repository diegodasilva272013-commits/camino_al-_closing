'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Search, X, ChevronRight, Users2, StickyNote } from 'lucide-react';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

type TeamLead = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  country: string | null;
  current_status: string;
  notes: string | null;
  is_closed: boolean;
  handled_by: string | null;
  updated_at: string;
};

type Member = { id: string; full_name: string | null; avatar_url: string | null };
type Team   = { id: string; name: string; setter1_id: string; setter2_id: string };

const MACRO = [
  { id: 'sin_contactar', label: 'Sin Contactar', statuses: ['NO_CONTACTADO', 'APERTURA_ENVIADA'], dropStatus: 'NO_CONTACTADO', col: 'border-zinc-700/60', header: 'text-zinc-300', bar: 'bg-zinc-500', over: 'ring-2 ring-zinc-400 bg-zinc-800/30', badge: 'bg-zinc-700 text-zinc-300' },
  { id: 'contactado',    label: 'Contactado',    statuses: ['CONTACTADO', 'NO_RESPONDE'],          dropStatus: 'CONTACTADO',    col: 'border-blue-800/50',  header: 'text-blue-400',  bar: 'bg-blue-500',  over: 'ring-2 ring-blue-500 bg-blue-950/30',    badge: 'bg-blue-900/60 text-blue-300' },
  { id: 'respondio',     label: 'Respondió',     statuses: ['RESPONDIO', 'INTERES_DETECTADO', 'INVITADO_AL_GRUPO', 'INGRESO_AL_GRUPO', 'ACTIVO_EN_GRUPO'], dropStatus: 'RESPONDIO', col: 'border-blue-600/40', header: 'text-blue-300', bar: 'bg-blue-400', over: 'ring-2 ring-blue-400 bg-blue-900/20', badge: 'bg-blue-800/60 text-blue-200' },
  { id: 'diagnostico',   label: 'Diagnóstico',   statuses: ['DIAGNOSTICO_INICIADO', 'DIAGNOSTICO_PROFUNDO', 'REUNION_PROPUESTA'], dropStatus: 'DIAGNOSTICO_INICIADO', col: 'border-yellow-700/50', header: 'text-yellow-400', bar: 'bg-yellow-400', over: 'ring-2 ring-yellow-400 bg-yellow-950/20', badge: 'bg-yellow-900/50 text-yellow-300' },
  { id: 'reunion',       label: 'Reunión ✓',     statuses: ['REUNION_AGENDADA'],                   dropStatus: 'REUNION_AGENDADA', col: 'border-emerald-700/50', header: 'text-emerald-400', bar: 'bg-emerald-400', over: 'ring-2 ring-emerald-400 bg-emerald-950/20', badge: 'bg-emerald-900/50 text-emerald-300' },
  { id: 'no_avanza',     label: 'No Avanza',     statuses: ['SEGUIMIENTO_FUTURO', 'NO_CALIFICA'],  dropStatus: 'NO_CALIFICA',   col: 'border-zinc-800/60',  header: 'text-zinc-600',  bar: 'bg-zinc-700',  over: 'ring-2 ring-red-600 bg-red-950/20',      badge: 'bg-zinc-800 text-zinc-500' },
] as const;

type MacroId = (typeof MACRO)[number]['id'];

const ALL_STATUSES = [
  'NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','NO_RESPONDE',
  'RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO',
  'DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA',
  'REUNION_AGENDADA','SEGUIMIENTO_FUTURO','NO_CALIFICA',
] as const;

function getMacro(status: string) {
  return MACRO.find(m => (m.statuses as readonly string[]).includes(status));
}

export default function EquipoPage() {
  const [team,    setTeam]    = useState<Team | null>(null);
  const [leads,   setLeads]   = useState<TeamLead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [activeMacro, setActiveMacro] = useState<MacroId>('sin_contactar');
  const [noteModal, setNoteModal] = useState<TeamLead | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [moveTarget, setMoveTarget] = useState<TeamLead | null>(null);
  const [meId, setMeId] = useState<string>('');
  const [dragging, setDragging] = useState<TeamLead | null>(null);
  const [dragOver, setDragOver] = useState<MacroId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/equipo').then(r => r.json());
    setTeam(r.team ?? null);
    setLeads(r.leads ?? []);
    setMembers(r.members ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/profile/me').then(r => r.json()).then(d => { if (d.id) setMeId(d.id); }).catch(() => {});
  }, []);

  async function patchLead(id: string, updates: Record<string, unknown>) {
    setSaving(id);
    const res = await fetch(`/api/equipo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l));
    }
    setSaving(null);
    setMoveTarget(null);
    setDragging(null);
    setDragOver(null);
  }

  async function saveNote() {
    if (!noteModal) return;
    await patchLead(noteModal.id, { notes: noteDraft });
    setNoteModal(null);
  }

  const memberName = (id: string | null) => {
    if (!id) return null;
    const m = members.find(m => m.id === id);
    return m?.full_name?.split(' ')[0] ?? null;
  };

  const visible = useMemo(() => {
    const active = leads.filter(l => l.current_status !== 'NO_CALIFICA');
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter(l =>
      `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  }, [leads, search]);

  const byMacroTotal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of MACRO) map[m.id] = 0;
    for (const l of visible) {
      const m = getMacro(l.current_status);
      if (m) map[m.id] = (map[m.id] ?? 0) + 1;
    }
    return map;
  }, [visible]);

  const byMacro = useMemo(() => {
    const map: Record<string, TeamLead[]> = {};
    for (const m of MACRO) map[m.id] = [];
    for (const l of visible) {
      const m = getMacro(l.current_status);
      if (m) map[m.id].push(l);
    }
    return map;
  }, [visible]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#080808]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
    </div>
  );

  if (!team) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#080808] text-center px-6">
      <Users2 className="h-12 w-12 text-zinc-700" />
      <p className="text-lg font-bold text-zinc-400">No estás asignado a ningún equipo todavía</p>
      <p className="text-sm text-zinc-600">El admin te asignará a un equipo desde el panel de administración.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen min-h-0 bg-[#080808]">

      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/70 font-semibold">Equipo</p>
            <p className="text-sm font-bold text-white">{team.name} · {visible.length} leads</p>
            <div className="flex gap-2 mt-0.5">
              {members.map(m => (
                <span key={m.id} className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', m.id === meId ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400')}>
                  {m.full_name?.split(' ')[0]}
                  {m.id === meId && ' (vos)'}
                </span>
              ))}
            </div>
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

      {/* Kanban */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* MOBILE: tabs */}
        <div className="lg:hidden flex flex-col flex-1 min-h-0">
          <div className="shrink-0 flex overflow-x-auto gap-1 px-2 py-2 border-b border-zinc-800/60 scrollbar-none">
            {MACRO.map(col => (
              <button key={col.id} onClick={() => setActiveMacro(col.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all',
                  activeMacro === col.id ? cn('border text-white bg-zinc-800', col.col) : 'text-zinc-500 hover:text-zinc-300')}>
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', col.bar)} />
                {col.label}
                <span className={cn('text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center',
                  activeMacro === col.id ? col.badge : 'bg-zinc-800 text-zinc-500')}>
                  {byMacroTotal[col.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
          {(() => {
            const col = MACRO.find(m => m.id === activeMacro)!;
            const colLeads = byMacro[col.id] ?? [];
            return (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className={cn('text-xs font-bold uppercase tracking-wider', col.header)}>{col.label}</p>
                  <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', col.badge)}>{colLeads.length}</span>
                </div>
                {colLeads.length === 0 ? (
                  <div className="h-32 rounded-2xl border-2 border-dashed border-zinc-800 flex items-center justify-center">
                    <p className="text-xs text-zinc-700">Sin leads en esta etapa</p>
                  </div>
                ) : colLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} macroBar={col.bar} macroBadge={col.badge}
                    saving={saving === lead.id} handledBy={memberName(lead.handled_by)} meId={meId}
                    onMove={() => setMoveTarget(lead)}
                    onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
                    onClaim={() => patchLead(lead.id, { handled_by: lead.handled_by === meId ? null : meId })}
                    onDragStart={() => setDragging(lead)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                  />
                ))}
              </div>
            );
          })()}
        </div>

        {/* DESKTOP: 6 columnas */}
        <div className="hidden lg:flex flex-1 overflow-hidden px-3 pt-3 pb-1">
          <div className="grid grid-cols-6 gap-2.5 h-full w-full">
            {MACRO.map(col => {
              const colLeads = byMacro[col.id] ?? [];
              const isOver   = dragOver === col.id;
              return (
                <div key={col.id} data-macro-id={col.id}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={e => { e.preventDefault(); if (dragging) patchLead(dragging.id, { current_status: col.dropStatus }); setDragOver(null); }}
                  className={cn('flex flex-col rounded-2xl border bg-zinc-900/40 transition-all min-h-0', col.col, isOver && col.over)}>
                  <div className="px-3 pt-3 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className={cn('text-[11px] font-bold uppercase tracking-wider', col.header)}>{col.label}</p>
                      <span className={cn('text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center', col.badge)}>
                        {byMacroTotal[col.id] ?? 0}
                      </span>
                    </div>
                    <div className={cn('h-0.5 rounded-full opacity-50', col.bar)} />
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-4 space-y-2">
                    {colLeads.length === 0 ? (
                      <div className={cn('h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition-all', isOver ? 'border-white/30 bg-white/5' : 'border-zinc-800')}>
                        <p className="text-[10px] text-zinc-700">Soltar aquí</p>
                      </div>
                    ) : colLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} macroBar={col.bar} macroBadge={col.badge}
                        saving={saving === lead.id} handledBy={memberName(lead.handled_by)} meId={meId}
                        onMove={() => setMoveTarget(lead)}
                        onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
                        onClaim={() => patchLead(lead.id, { handled_by: lead.handled_by === meId ? null : meId })}
                        onDragStart={() => setDragging(lead)}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal notas */}
      {noteModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setNoteModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl p-5 pb-8">
            <p className="text-base font-bold text-white mb-1">{noteModal.first_name} {noteModal.last_name}</p>
            <p className="text-xs text-zinc-500 mb-3">Notas del equipo</p>
            <textarea
              value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
              rows={5} placeholder="Escribí las notas del equipo aquí..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setNoteModal(null)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400">Cancelar</button>
              <button onClick={saveNote} disabled={saving === noteModal.id}
                className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black disabled:opacity-50">
                {saving === noteModal.id ? 'Guardando...' : 'Guardar nota'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet mover etapa */}
      {moveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setMoveTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl">
            <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-zinc-700" /></div>
            <div className="px-5 pt-3 pb-4">
              <p className="text-base font-bold text-white">{moveTarget.first_name} {moveTarget.last_name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Etapa actual: <span className="text-zinc-300">{STATUS_LABELS[moveTarget.current_status as LeadStatus] ?? moveTarget.current_status}</span></p>
            </div>
            <div className="overflow-y-auto max-h-[52vh] px-3 pb-8 space-y-1">
              {ALL_STATUSES.map(key => {
                const isCurrent = moveTarget.current_status === key;
                const macro = getMacro(key);
                return (
                  <button key={key} onClick={() => patchLead(moveTarget.id, { current_status: key })} disabled={isCurrent}
                    className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium transition text-left',
                      isCurrent ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 cursor-default'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200')}>
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', macro?.bar ?? 'bg-zinc-600')} />
                    <span className="flex-1">{STATUS_LABELS[key as LeadStatus] ?? key}</span>
                    {isCurrent && <span className="text-[10px] text-yellow-500/60">actual</span>}
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

function LeadCard({ lead, macroBar, macroBadge, saving, handledBy, meId, onMove, onNote, onClaim, onDragStart, onDragEnd }: {
  lead: TeamLead; macroBar: string; macroBadge: string; saving: boolean;
  handledBy: string | null; meId: string;
  onMove: () => void; onNote: () => void; onClaim: () => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  const waPhone  = lead.phone.replace(/\D/g, '');
  const fullName = `${lead.first_name} ${lead.last_name ?? ''}`.trim();
  const isMe     = lead.handled_by === meId;

  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing select-none hover:border-zinc-700 transition-all">
      <div className="flex items-center justify-between gap-1">
        <span className={cn('text-[9px] font-semibold rounded-full px-1.5 py-0.5 truncate max-w-[120px]', macroBadge)}>
          {STATUS_LABELS[lead.current_status as LeadStatus] ?? lead.current_status}
        </span>
        {handledBy && (
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', isMe ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400')}>
            {isMe ? 'Yo' : handledBy}
          </span>
        )}
      </div>

      <p className="text-[13px] font-bold text-white leading-snug">{fullName}</p>

      <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
        className="text-[11px] text-blue-400 font-mono block hover:text-blue-300 transition-colors">
        {lead.phone}
      </a>

      {lead.notes && (
        <p className="text-[10px] text-zinc-500 line-clamp-2 bg-zinc-900/60 rounded-lg px-2 py-1">{lead.notes}</p>
      )}

      <div className="flex items-center justify-end gap-1">
        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onNote(); }}
          className={cn('p-1 rounded-lg border transition', lead.notes ? 'border-yellow-700/40 text-yellow-600 hover:text-yellow-400' : 'border-zinc-700 text-zinc-500 hover:text-zinc-200')}>
          <StickyNote className="h-3 w-3" />
        </button>
        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClaim(); }}
          className={cn('px-2 py-1 rounded-lg border text-[10px] font-semibold transition',
            isMe ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200')}>
          {isMe ? 'Yo llevo' : 'Tomar'}
        </button>
        <button disabled={saving} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMove(); }}
          className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition disabled:opacity-40">
          {saving ? '...' : <>Mover <ChevronRight className="h-3 w-3" /></>}
        </button>
      </div>
    </div>
  );
}
