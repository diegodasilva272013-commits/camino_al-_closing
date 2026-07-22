'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw, Search, X, ChevronRight, Users2, StickyNote,
  BarChart2, MessageSquare, Settings, LayoutGrid,
  Star, TrendingUp, Camera, Check, AlertCircle, Loader2, Send,
  ClipboardList, AlertTriangle,
} from 'lucide-react';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type TeamLead = {
  id: string; team_id: string; first_name: string; last_name: string | null;
  phone: string; email: string | null; country: string | null;
  current_status: string; notes: string | null;
  is_closed: boolean; handled_by: string | null; updated_at: string;
};
type Member  = { id: string; full_name: string | null; avatar_url: string | null };
type Team    = { id: string; name: string; avatar_url: string | null; setter1_id: string; setter2_id: string };
type TabId   = 'kanban' | 'metricas' | 'conversaciones' | 'ajustes' | 'tareas';

// ─── Kanban config (idéntica a /leads) ───────────────────────────────────────

const MACRO = [
  { id:'sin_contactar', label:'Sin Contactar', statuses:['NO_CONTACTADO','APERTURA_ENVIADA'],                                                                            dropStatus:'NO_CONTACTADO',        col:'border-zinc-700/60',   header:'text-zinc-300',   bar:'bg-zinc-500',   over:'ring-2 ring-zinc-400 bg-zinc-800/30',   badge:'bg-zinc-700 text-zinc-300' },
  { id:'contactado',    label:'Contactado',    statuses:['CONTACTADO','NO_RESPONDE'],                                                                                     dropStatus:'CONTACTADO',           col:'border-blue-800/50',   header:'text-blue-400',   bar:'bg-blue-500',   over:'ring-2 ring-blue-500 bg-blue-950/30',   badge:'bg-blue-900/60 text-blue-300' },
  { id:'respondio',     label:'Respondió',     statuses:['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO'],                       dropStatus:'RESPONDIO',            col:'border-blue-600/40',   header:'text-blue-300',   bar:'bg-blue-400',   over:'ring-2 ring-blue-400 bg-blue-900/20',   badge:'bg-blue-800/60 text-blue-200' },
  { id:'diagnostico',   label:'Diagnóstico',   statuses:['DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA'],                                              dropStatus:'DIAGNOSTICO_INICIADO', col:'border-yellow-700/50', header:'text-yellow-400', bar:'bg-yellow-400', over:'ring-2 ring-yellow-400 bg-yellow-950/20',badge:'bg-yellow-900/50 text-yellow-300' },
  { id:'reunion',       label:'Reunión ✓',     statuses:['REUNION_AGENDADA'],                                                                                             dropStatus:'REUNION_AGENDADA',     col:'border-emerald-700/50',header:'text-emerald-400',bar:'bg-emerald-400',over:'ring-2 ring-emerald-400 bg-emerald-950/20',badge:'bg-emerald-900/50 text-emerald-300' },
  { id:'no_avanza',     label:'No Avanza',     statuses:['SEGUIMIENTO_FUTURO','NO_CALIFICA'],                                                                             dropStatus:'NO_CALIFICA',          col:'border-zinc-800/60',   header:'text-zinc-600',   bar:'bg-zinc-700',   over:'ring-2 ring-red-600 bg-red-950/20',     badge:'bg-zinc-800 text-zinc-500' },
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function EquipoPage() {
  const [tab, setTab]             = useState<TabId>('kanban');
  const [team, setTeam]           = useState<Team | null>(null);
  const [leads, setLeads]         = useState<TeamLead[]>([]);
  const [members, setMembers]     = useState<Member[]>([]);
  const [loading, setLoading]     = useState(true);
  const [meId, setMeId]           = useState('');

  // Kanban state
  const [saving, setSaving]           = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [activeMacro, setActiveMacro] = useState<MacroId>('sin_contactar');
  const [noteModal, setNoteModal]     = useState<TeamLead | null>(null);
  const [noteDraft, setNoteDraft]     = useState('');
  const [moveTarget, setMoveTarget]   = useState<TeamLead | null>(null);
  const [dragging, setDragging]       = useState<TeamLead | null>(null);
  const [dragOver, setDragOver]       = useState<MacroId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/equipo').then(r => r.json()).catch(() => ({}));
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
    try {
      const res = await fetch(`/api/equipo/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l));
      }
    } catch { /* red o JSON mal formado — el state no se toca */ }
    setSaving(null);
    setMoveTarget(null);
    setDragging(null);
    setDragOver(null);
  }

  const memberName = (id: string | null) => members.find(m => m.id === id)?.full_name?.split(' ')[0] ?? null;

  const visible = useMemo(() => {
    const active = leads.filter(l => l.current_status !== 'NO_CALIFICA');
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter(l =>
      `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) || String(l.phone ?? '').includes(q)
    );
  }, [leads, search]);

  const byMacroTotal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of MACRO) map[m.id] = 0;
    for (const l of visible) { const m = getMacro(l.current_status); if (m) map[m.id]++; }
    return map;
  }, [visible]);

  const byMacro = useMemo(() => {
    const map: Record<string, TeamLead[]> = {};
    for (const m of MACRO) map[m.id] = [];
    for (const l of visible) { const m = getMacro(l.current_status); if (m) map[m.id].push(l); }
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

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'kanban',        label: 'Leads',           icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: 'tareas',        label: 'Tareas',          icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { id: 'metricas',      label: 'Métricas',        icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: 'conversaciones',label: 'Conversaciones',  icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'ajustes',       label: 'Ajustes',         icon: <Settings className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-screen min-h-0 bg-[#080808]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-0">
        <div className="flex items-center gap-3 mb-3">
          {team.avatar_url ? (
            <img src={team.avatar_url} alt={team.name} className="h-10 w-10 rounded-xl object-cover border border-zinc-700" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Users2 className="h-5 w-5 text-zinc-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{team.name}</p>
            <div className="flex gap-2 mt-0.5">
              {members.map(m => (
                <span key={m.id} className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  m.id === meId ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400')}>
                  {m.full_name?.split(' ')[0]}{m.id === meId && ' (vos)'}
                </span>
              ))}
            </div>
          </div>
          <button onClick={load} className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 -mx-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-xl transition-all border-b-2',
                tab === t.id
                  ? 'text-yellow-400 border-yellow-400 bg-zinc-900/40'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300')}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: KANBAN ── */}
      {tab === 'kanban' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search bar */}
          <div className="shrink-0 px-4 py-2 border-b border-zinc-800/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-10 pr-9 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-zinc-500" /></button>}
            </div>
          </div>

          {/* MOBILE */}
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
              return (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {(byMacro[col.id] ?? []).length === 0
                    ? <div className="h-32 rounded-2xl border-2 border-dashed border-zinc-800 flex items-center justify-center"><p className="text-xs text-zinc-700">Sin leads en esta etapa</p></div>
                    : (byMacro[col.id] ?? []).map(lead => (
                      <LeadCard key={lead.id} lead={lead} macroBar={col.bar} macroBadge={col.badge}
                        saving={saving === lead.id} handledBy={memberName(lead.handled_by)} meId={meId}
                        onMove={() => setMoveTarget(lead)}
                        onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
                        onClaim={() => patchLead(lead.id, { handled_by: lead.handled_by === meId ? null : meId })}
                        onDragStart={() => setDragging(lead)} onDragEnd={() => { setDragging(null); setDragOver(null); }} />
                    ))}
                </div>
              );
            })()}
          </div>

          {/* DESKTOP */}
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
                        <span className={cn('text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center', col.badge)}>{byMacroTotal[col.id] ?? 0}</span>
                      </div>
                      <div className={cn('h-0.5 rounded-full opacity-50', col.bar)} />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-4 space-y-2">
                      {colLeads.length === 0
                        ? <div className={cn('h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition-all', isOver ? 'border-white/30 bg-white/5' : 'border-zinc-800')}><p className="text-[10px] text-zinc-700">Soltar aquí</p></div>
                        : colLeads.map(lead => (
                          <LeadCard key={lead.id} lead={lead} macroBar={col.bar} macroBadge={col.badge}
                            saving={saving === lead.id} handledBy={memberName(lead.handled_by)} meId={meId}
                            onMove={() => setMoveTarget(lead)}
                            onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
                            onClaim={() => patchLead(lead.id, { handled_by: lead.handled_by === meId ? null : meId })}
                            onDragStart={() => setDragging(lead)} onDragEnd={() => { setDragging(null); setDragOver(null); }} />
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TAREAS ── */}
      {tab === 'tareas' && (
        <TareasTab teamId={team.id} meId={meId} />
      )}

      {/* ── TAB: MÉTRICAS ── */}
      {tab === 'metricas' && (
        <MetricasTab teamId={team.id} />
      )}

      {/* ── TAB: CONVERSACIONES ── */}
      {tab === 'conversaciones' && (
        <ConversacionesTab teamId={team.id} meId={meId} />
      )}

      {/* ── TAB: AJUSTES ── */}
      {tab === 'ajustes' && (
        <AjustesTab team={team} onSaved={(updated) => setTeam(prev => prev ? { ...prev, ...updated } : prev)} />
      )}

      {/* Modal notas */}
      {noteModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setNoteModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl p-5 pb-8">
            <p className="text-base font-bold text-white mb-1">{noteModal.first_name} {noteModal.last_name}</p>
            <p className="text-xs text-zinc-500 mb-3">Notas del equipo</p>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={5}
              placeholder="Notas del equipo..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setNoteModal(null)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400">Cancelar</button>
              <button onClick={async () => { await patchLead(noteModal.id, { notes: noteDraft }); setNoteModal(null); }}
                disabled={saving === noteModal.id}
                className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black disabled:opacity-50">
                {saving === noteModal.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet mover */}
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

// ─── LeadCard ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, macroBar, macroBadge, saving, handledBy, meId, onMove, onNote, onClaim, onDragStart, onDragEnd }: {
  lead: TeamLead; macroBar: string; macroBadge: string; saving: boolean;
  handledBy: string | null; meId: string;
  onMove: () => void; onNote: () => void; onClaim: () => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  const isMe = lead.handled_by === meId;
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
      <p className="text-[13px] font-bold text-white leading-snug">{lead.first_name} {lead.last_name ?? ''}</p>
      <a href={`https://wa.me/${String(lead.phone ?? '').replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
        className="text-[11px] text-blue-400 font-mono block hover:text-blue-300">{lead.phone}</a>
      {lead.notes && <p className="text-[10px] text-zinc-500 line-clamp-2 bg-zinc-900/60 rounded-lg px-2 py-1">{lead.notes}</p>}
      <div className="flex items-center justify-end gap-1">
        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onNote(); }}
          className={cn('p-1 rounded-lg border transition', lead.notes ? 'border-yellow-700/40 text-yellow-600 hover:text-yellow-400' : 'border-zinc-700 text-zinc-500 hover:text-zinc-200')}>
          <StickyNote className="h-3 w-3" />
        </button>
        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClaim(); }}
          className={cn('px-2 py-1 rounded-lg border text-[10px] font-semibold transition',
            isMe ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200')}>
          {isMe ? 'Yo llevo' : 'Tomar'}
        </button>
        <button disabled={saving} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMove(); }}
          className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition disabled:opacity-40">
          {saving ? '...' : <>Mover <ChevronRight className="h-3 w-3" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── MetricasTab ──────────────────────────────────────────────────────────────

function MetricasTab({ teamId }: { teamId: string }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/equipo/metrics').then(r => r.json()).then(d => { setMetrics(d); setLoading(false); }).catch(() => setLoading(false));
  }, [teamId]);

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" /></div>;
  if (!metrics) return <div className="flex flex-1 items-center justify-center text-zinc-600 text-sm">Sin datos disponibles</div>;

  const macroGroups = [
    { label: 'Sin Contactar', key: 'sin_contactar', statuses: ['NO_CONTACTADO','APERTURA_ENVIADA'], color: 'bg-zinc-500' },
    { label: 'Contactado',    key: 'contactado',    statuses: ['CONTACTADO','NO_RESPONDE'],         color: 'bg-blue-500' },
    { label: 'Respondió',     key: 'respondio',     statuses: ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO'], color: 'bg-blue-400' },
    { label: 'Diagnóstico',   key: 'diagnostico',   statuses: ['DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA'], color: 'bg-yellow-400' },
    { label: 'Reunión ✓',     key: 'reunion',       statuses: ['REUNION_AGENDADA'],                 color: 'bg-emerald-400' },
  ];

  function macroCount(byStatus: Record<string, number>, statuses: string[]) {
    return statuses.reduce((s, k) => s + (byStatus[k] ?? 0), 0);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Totales del equipo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total leads', value: metrics.total_leads, icon: <LayoutGrid className="h-4 w-4" />, color: 'text-white' },
          { label: 'Sin tomar',   value: metrics.sin_tomar,   icon: <AlertCircle className="h-4 w-4" />, color: 'text-amber-400' },
          { label: 'Conversaciones', value: metrics.conversaciones_analizadas, icon: <MessageSquare className="h-4 w-4" />, color: 'text-blue-400' },
          { label: 'Reuniones',   value: metrics.by_status?.['REUNION_AGENDADA'] ?? 0, icon: <Star className="h-4 w-4" />, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <div className={cn('mb-1', s.color)}>{s.icon}</div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Distribución por etapa */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Distribución por etapa</p>
        <div className="space-y-2">
          {macroGroups.map(g => {
            const count = macroCount(metrics.by_status ?? {}, g.statuses);
            const pct   = metrics.total_leads > 0 ? Math.round((count / metrics.total_leads) * 100) : 0;
            return (
              <div key={g.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">{g.label}</span>
                  <span className="text-zinc-500">{count} · {pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800">
                  <div className={cn('h-full rounded-full transition-all', g.color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por miembro */}
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rendimiento individual</p>
      {(metrics.members ?? []).map((m: any) => (
        <div key={m.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {m.avatar_url
              ? <img src={m.avatar_url} className="h-9 w-9 rounded-full object-cover" alt={m.full_name} />
              : <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">{m.full_name?.[0] ?? '?'}</div>
            }
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{m.full_name}</p>
              <p className="text-[11px] text-zinc-500">{m.points} puntos totales</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{m.leads_total}</p>
              <p className="text-[10px] text-zinc-600">leads</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Contactados', value: m.contactados, color: 'text-blue-400' },
              { label: 'Respondieron', value: m.respondieron, color: 'text-blue-300' },
              { label: 'Reuniones', value: m.reuniones, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-zinc-800/60 py-2">
                <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] text-zinc-600">{s.label}</p>
              </div>
            ))}
          </div>
          {m.leads_total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Tasa de respuesta</span>
                <span className="text-zinc-400 font-semibold">{m.tasa_respuesta}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${m.tasa_respuesta}%` }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ConversacionesTab ────────────────────────────────────────────────────────

type ConvAnalysis = {
  id: string; submitted_by: string; submitted_by_name: string | null;
  status: string; created_at: string; analysis: any; my_reflection: any | null;
};

const REFLECT_QUESTIONS = [
  { key: 'que_ocurrio',      label: '¿Qué ocurrió exactamente?' },
  { key: 'donde_se_rompio',  label: '¿Dónde se rompió la conversación?' },
  { key: 'que_hiciste_bien', label: '¿Qué hiciste bien?' },
  { key: 'que_hiciste_mal',  label: '¿Qué hiciste mal?' },
  { key: 'que_aprendiste',   label: '¿Qué aprendiste?' },
  { key: 'que_aplicaras',    label: '¿Qué aplicarás desde ahora?' },
];

function ConversacionesTab({ teamId, meId }: { teamId: string; meId: string }) {
  const [convs,    setConvs]    = useState<ConvAnalysis[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [rawText,  setRawText]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [selected, setSelected] = useState<ConvAnalysis | null>(null);
  const [answers,  setAnswers]  = useState<Record<string, string>>({});
  const [reflecting, setReflecting] = useState(false);
  const [reflResult, setReflResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch('/api/equipo/conversaciones').then(r => r.json()).catch(() => []);
    setConvs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!rawText.trim()) return;
    setSending(true);
    try {
      const res  = await fetch('/api/equipo/conversaciones', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ raw_text: rawText }) });
      const json = await res.json();
      if (res.ok) { setRawText(''); setShowNew(false); load(); }
      else alert(json.error);
    } catch { /* red */ }
    setSending(false);
  }

  async function openConv(c: ConvAnalysis) {
    const detail = await fetch(`/api/equipo/conversaciones/${c.id}`).then(r => r.json()).catch(() => c);
    setSelected(detail);
    setAnswers({});
    setReflResult(null);
  }

  async function submitReflection() {
    if (!selected) return;
    setReflecting(true);
    try {
      const res  = await fetch(`/api/equipo/conversaciones/${selected.id}/reflect`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (res.ok) { setReflResult(json); load(); }
      else alert(json.error);
    } catch { /* red */ }
    setReflecting(false);
  }

  if (selected) return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <button onClick={() => { setSelected(null); setReflResult(null); }} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition">
        ← Volver
      </button>

      {/* Análisis */}
      {selected.status === 'ready' && selected.analysis && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Análisis del Motor CAC</p>
          {selected.analysis.resultado_probable && <p className="text-sm text-zinc-300"><span className="text-zinc-500 text-xs">Resultado probable:</span> {selected.analysis.resultado_probable}</p>}
          {selected.analysis.donde_se_rompio && <p className="text-sm text-zinc-300"><span className="text-zinc-500 text-xs">Dónde se rompió:</span> {selected.analysis.donde_se_rompio}</p>}
          {selected.analysis.fortalezas?.length > 0 && (
            <div><p className="text-xs text-zinc-500 mb-1">Fortalezas</p>
              <ul className="space-y-1">{selected.analysis.fortalezas.map((f: string, i: number) => <li key={i} className="text-xs text-zinc-300 flex gap-2"><span className="text-emerald-400 shrink-0">+</span>{f}</li>)}</ul>
            </div>
          )}
          {selected.analysis.errores?.length > 0 && (
            <div><p className="text-xs text-zinc-500 mb-1">Errores</p>
              <ul className="space-y-1">{selected.analysis.errores.map((e: string, i: number) => <li key={i} className="text-xs text-zinc-300 flex gap-2"><span className="text-red-400 shrink-0">−</span>{e}</li>)}</ul>
            </div>
          )}
          {selected.analysis.que_haria_operador_cac && (
            <div className="rounded-xl border border-yellow-700/30 bg-yellow-500/5 p-3">
              <p className="text-xs text-yellow-400 font-semibold mb-1">¿Qué haría el operador CAC?</p>
              <p className="text-xs text-zinc-300">{selected.analysis.que_haria_operador_cac}</p>
            </div>
          )}
        </div>
      )}

      {/* Reflexión ya enviada */}
      {selected.my_reflection && !reflResult && (
        <div className={cn('rounded-2xl border p-4 space-y-2', selected.my_reflection.status === 'approved' ? 'border-emerald-700/40 bg-emerald-900/10' : 'border-red-700/40 bg-red-900/10')}>
          <div className="flex items-center gap-2">
            <Star className={cn('h-4 w-4', selected.my_reflection.status === 'approved' ? 'text-emerald-400' : 'text-red-400')} />
            <p className="text-sm font-bold text-white">
              {selected.my_reflection.status === 'approved' ? `Reflexión aprobada · +${selected.my_reflection.xp_earned} XP` : 'Reflexión rechazada'}
            </p>
          </div>
          {selected.my_reflection.evaluation?.feedback && <p className="text-xs text-zinc-400">{selected.my_reflection.evaluation.feedback}</p>}
        </div>
      )}

      {/* Resultado de reflexión recién enviada */}
      {reflResult && (
        <div className={cn('rounded-2xl border p-4 space-y-2', reflResult.status === 'approved' ? 'border-emerald-700/40 bg-emerald-900/10' : 'border-red-700/40 bg-red-900/10')}>
          <div className="flex items-center gap-2">
            <TrendingUp className={cn('h-4 w-4', reflResult.status === 'approved' ? 'text-emerald-400' : 'text-red-400')} />
            <p className="text-sm font-bold text-white">
              {reflResult.status === 'approved' ? `¡Reflexión aprobada! +${reflResult.xp_earned} XP sumados a tu perfil` : 'Reflexión rechazada'}
            </p>
          </div>
          {reflResult.evaluation?.feedback && <p className="text-xs text-zinc-400">{reflResult.evaluation.feedback}</p>}
          {reflResult.evaluation?.razon_rechazo && <p className="text-xs text-red-400">{reflResult.evaluation.razon_rechazo}</p>}
        </div>
      )}

      {/* Formulario reflexión */}
      {selected.status === 'ready' && !selected.my_reflection && !reflResult && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tu reflexión (suma XP a tu perfil)</p>
          {REFLECT_QUESTIONS.map(q => (
            <div key={q.key}>
              <label className="text-xs text-zinc-500 font-medium">{q.label}</label>
              <textarea
                value={answers[q.key] ?? ''} onChange={e => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                rows={2} placeholder="Mínimo 20 caracteres..."
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 resize-none" />
            </div>
          ))}
          <button onClick={submitReflection} disabled={reflecting}
            className="w-full rounded-xl bg-yellow-500 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50 flex items-center justify-center gap-2">
            {reflecting ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluando...</> : <><Send className="h-4 w-4" /> Enviar reflexión</>}
          </button>
        </div>
      )}

      {selected.status === 'analyzing' && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <Loader2 className="h-5 w-5 text-yellow-400 animate-spin shrink-0" />
          <p className="text-sm text-zinc-300">El Motor CAC está analizando la conversación...</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Nueva conversación */}
      <button onClick={() => setShowNew(v => !v)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 py-3 text-sm font-semibold text-zinc-400 hover:border-yellow-500/50 hover:text-yellow-400 transition">
        <MessageSquare className="h-4 w-4" />
        {showNew ? 'Cancelar' : 'Subir conversación para analizar'}
      </button>

      {showNew && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <p className="text-xs text-zinc-500">Pegá la conversación completa (máx. 30.000 caracteres). El Motor CAC la analizará y podrás reflexionar para sumar XP a tu perfil individual.</p>
          <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={8}
            placeholder="[Setter]: Hola, te contacto por...\n[Lead]: Sí, hola..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none resize-none font-mono" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-600">{rawText.length.toLocaleString()} / 30.000</span>
            <button onClick={submit} disabled={sending || !rawText.trim()}
              className="flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50">
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Analizando...</> : <><Send className="h-4 w-4" />Analizar</>}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" /></div>
      ) : convs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">Todavía no hay conversaciones analizadas en el equipo</p>
        </div>
      ) : convs.map(c => {
        const refl     = c.my_reflection;
        const isReady  = c.status === 'ready';
        const pending  = isReady && !refl;
        const approved = refl?.status === 'approved';
        return (
          <button key={c.id} onClick={() => openConv(c)}
            className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full shrink-0', c.status === 'ready' ? 'bg-emerald-400' : c.status === 'analyzing' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400')} />
                <p className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
              </div>
              {pending   && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Reflexión pendiente</span>}
              {approved  && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400">+{refl.xp_earned} XP</span>}
              {refl?.status === 'rejected' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">Rechazada</span>}
            </div>
            {c.submitted_by_name && <p className="text-xs text-zinc-500">Subida por <span className="text-zinc-300">{c.submitted_by_name}</span></p>}
            {c.analysis?.resultado_probable && <p className="text-sm text-zinc-300 line-clamp-2">{c.analysis.resultado_probable}</p>}
            <div className="flex items-center gap-1 text-xs text-zinc-600">Ver análisis completo <ChevronRight className="h-3 w-3" /></div>
          </button>
        );
      })}
    </div>
  );
}

// ─── TareasTab ────────────────────────────────────────────────────────────────

type TareaEstado = {
  team: any;
  estado: any;
  partner_estado: any;
  partner_profile: any;
  config: { aperturas_meta: number; contactados_meta: number; conv_meta: number };
  strikes: number;
  fecha: string;
  minutos_restantes: number;
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-zinc-800">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StrikeDots({ count }: { count: number }) {
  const dots = Array.from({ length: 3 }).map((_, i) => i < count);
  return (
    <div className="flex gap-1.5 items-center">
      {dots.map((active, i) => (
        <span key={i} className={cn('h-3 w-3 rounded-full border',
          active ? 'bg-red-500 border-red-400' : 'bg-zinc-800 border-zinc-700')} />
      ))}
      {count >= 3 && <span className="text-[10px] text-red-400 font-bold ml-1">BLOQUEADO</span>}
    </div>
  );
}

function formatMinutes(min: number): string {
  if (min <= 0) return '00:00';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function TareasTab({ teamId, meId }: { teamId: string; meId: string }) {
  const [data, setData] = useState<TareaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [mins, setMins] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/duplas/estado').then(r => r.json()).catch(() => null);
    setData(r);
    setMins(r?.minutos_restantes ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Countdown each minute
  useEffect(() => {
    const id = setInterval(() => setMins(m => Math.max(0, m - 1)), 60000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
    </div>
  );

  if (!data?.team) return (
    <div className="flex flex-1 items-center justify-center text-zinc-600 text-sm">Sin equipo activo</div>
  );

  const { estado, partner_estado, partner_profile, config, strikes, fecha } = data;

  const ap = estado?.aperturas_count   ?? 0;
  const co = estado?.contactados_count ?? 0;
  const cv = estado?.conv_count        ?? 0;

  const TASKS = [
    { label: 'Aperturas enviadas', count: ap, meta: config.aperturas_meta, ok: estado?.task_aperturas_ok,   color: 'bg-blue-500' },
    { label: 'Contactados',        count: co, meta: config.contactados_meta, ok: estado?.task_contactados_ok, color: 'bg-indigo-500' },
    { label: 'Conversaciones',     count: cv, meta: config.conv_meta,        ok: estado?.task_conv_ok,        color: 'bg-emerald-500' },
  ];

  const allOk = estado?.all_tasks_ok;
  const urgent = mins <= 60 && !allOk;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">

      {/* Header con fecha y countdown */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tareas del {fecha}</p>
          <p className={cn('text-[11px] mt-0.5', urgent ? 'text-red-400 font-bold' : 'text-zinc-600')}>
            {allOk ? '✅ Completadas' : `⏱ Quedan ${formatMinutes(mins)} para medianoche`}
          </p>
        </div>
        <button onClick={load}
          className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mis tareas */}
      <div className={cn('rounded-2xl border p-4 space-y-4',
        allOk ? 'border-emerald-700/30 bg-emerald-950/10' : urgent ? 'border-red-700/30 bg-red-950/10' : 'border-zinc-800 bg-zinc-900/30')}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Mis tareas de hoy</p>
          {allOk
            ? <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">✓ Completado</span>
            : <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
                urgent ? 'text-red-400 bg-red-500/15' : 'text-yellow-400 bg-yellow-500/15')}>
                Pendiente
              </span>
          }
        </div>

        {TASKS.map(t => (
          <div key={t.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {t.ok
                  ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  : <div className="h-3.5 w-3.5 rounded-full border border-zinc-600 shrink-0" />
                }
                <span className={t.ok ? 'text-zinc-400 line-through' : 'text-zinc-300'}>{t.label}</span>
              </div>
              <span className={cn('font-bold tabular-nums', t.ok ? 'text-emerald-400' : 'text-zinc-400')}>
                {t.count}/{t.meta}
              </span>
            </div>
            <ProgressBar value={t.count} max={t.meta} color={t.ok ? 'bg-emerald-500' : t.color} />
          </div>
        ))}
      </div>

      {/* Strikes */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-400">Mis strikes</p>
          <AlertTriangle className={cn('h-3.5 w-3.5', strikes > 0 ? 'text-red-400' : 'text-zinc-700')} />
        </div>
        <StrikeDots count={strikes} />
        {strikes === 0 && <p className="text-[11px] text-zinc-600 mt-1.5">Sin strikes ✓ Seguí así.</p>}
        {strikes === 1 && <p className="text-[11px] text-yellow-500/70 mt-1.5">1 strike acumulado. Podés tener hasta 2 más antes del bloqueo.</p>}
        {strikes === 2 && <p className="text-[11px] text-orange-400 mt-1.5 font-semibold">⚠ 2 strikes. Un strike más y tu cuenta será bloqueada.</p>}
        {strikes >= 3 && <p className="text-[11px] text-red-400 mt-1.5 font-bold">Tu cuenta está bloqueada. Hablá con coordinación.</p>}
      </div>

      {/* Estado del compañero */}
      {partner_profile && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {partner_profile.avatar_url
              ? <img src={partner_profile.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
              : <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">
                  {partner_profile.full_name?.[0] ?? '?'}
                </div>
            }
            <div>
              <p className="text-xs font-semibold text-white">{partner_profile.full_name}</p>
              <p className="text-[10px] text-zinc-600">Tu compañero/a de dupla</p>
            </div>
            {partner_estado?.all_tasks_ok
              ? <span className="ml-auto text-[11px] text-emerald-400 font-bold">✓ Completo</span>
              : <span className="ml-auto text-[11px] text-zinc-600">Pendiente</span>
            }
          </div>
          {partner_estado && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Aperturas',     value: partner_estado.aperturas_count,   meta: config.aperturas_meta },
                { label: 'Contactados',   value: partner_estado.contactados_count,  meta: config.contactados_meta },
                { label: 'Conversaciones', value: partner_estado.conv_count,        meta: config.conv_meta },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-zinc-800/50 py-2">
                  <p className="text-base font-bold text-white">{s.value}</p>
                  <p className="text-[9px] text-zinc-600">{s.label}</p>
                  <p className="text-[9px] text-zinc-700">/{s.meta}</p>
                </div>
              ))}
            </div>
          )}
          {!partner_estado && (
            <p className="text-xs text-zinc-600">Sin datos de hoy todavía</p>
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-700 text-center">
        Las tareas se detectan automáticamente cada 15 minutos.
      </p>
    </div>
  );
}

// ─── AjustesTab ───────────────────────────────────────────────────────────────

function AjustesTab({ team, onSaved }: { team: Team; onSaved: (t: Partial<Team>) => void }) {
  const [name,       setName]       = useState(team.name);
  const [avatarUrl,  setAvatarUrl]  = useState(team.avatar_url ?? '');
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [saved,      setSaved]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch('/api/equipo/upload-avatar', { method: 'POST', body: form });
      const json = await res.json();
      if (res.ok) { setAvatarUrl(json.avatar_url); onSaved({ avatar_url: json.avatar_url }); }
      else alert(json.error);
    } catch { /* red */ }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/equipo/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (res.ok) { onSaved({ name }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
      else alert(json.error);
    } catch { /* red */ }
    setSaving(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-md">
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ajustes del equipo</p>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} className="h-20 w-20 rounded-2xl object-cover border border-zinc-700" alt="Equipo" />
            : <div className="h-20 w-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center"><Users2 className="h-8 w-8 text-zinc-600" /></div>
          }
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-yellow-500 border-2 border-[#111] flex items-center justify-center hover:bg-yellow-400 transition disabled:opacity-50">
            {uploading ? <Loader2 className="h-3.5 w-3.5 text-black animate-spin" /> : <Camera className="h-3.5 w-3.5 text-black" />}
          </button>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{team.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Foto del equipo · máx 5 MB</p>
          <p className="text-xs text-zinc-600">JPG, PNG, WEBP o GIF</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
      </div>

      {/* Nombre */}
      <div>
        <label className="text-xs text-zinc-500 font-medium">Nombre del equipo</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
      </div>

      <button onClick={save} disabled={saving || !name.trim()}
        className={cn('w-full rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2',
          saved ? 'bg-emerald-500 text-white' : 'bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50')}>
        {saved ? <><Check className="h-4 w-4" /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-1.5 text-xs text-zinc-500">
        <p className="font-semibold text-zinc-400">Reglas del equipo</p>
        <p>• Los leads del equipo son exclusivos — no se mezclan con leads personales</p>
        <p>• Las conversaciones analizadas suman XP a tu perfil individual</p>
        <p>• El admin asigna los setters al equipo desde el panel de administración</p>
      </div>
    </div>
  );
}
