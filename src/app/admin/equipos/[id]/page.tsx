'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, Search, X, ChevronRight, StickyNote,
  Users2, BarChart2, Settings, LayoutGrid, Loader2,
  Check, AlertCircle, Star,
} from 'lucide-react';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';
import { cn } from '@/lib/utils';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TLead = {
  id: string; team_id: string; first_name: string; last_name: string | null;
  phone: string; email: string | null; country: string | null;
  current_status: string; notes: string | null;
  is_closed: boolean; handled_by: string | null; updated_at: string;
};
type Member  = { id: string; full_name: string | null; avatar_url: string | null; points: number };
type Setter  = { id: string; full_name: string | null };
type Team    = { id: string; name: string; avatar_url: string | null; setter1_id: string | null; setter2_id: string | null };

type Tab = 'kanban' | 'metricas' | 'config';

// ─── Kanban ───────────────────────────────────────────────────────────────────

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

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminEquipoDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [tab, setTab] = useState<Tab>('kanban');

  const [team,    setTeam]    = useState<Team | null>(null);
  const [leads,   setLeads]   = useState<TLead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allSetters, setAllSetters] = useState<Setter[]>([]);
  const [loading, setLoading] = useState(true);

  // Kanban state
  const [saving,      setSaving]      = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [activeMacro, setActiveMacro] = useState<MacroId>('sin_contactar');
  const [noteModal,   setNoteModal]   = useState<TLead | null>(null);
  const [noteDraft,   setNoteDraft]   = useState('');
  const [moveTarget,  setMoveTarget]  = useState<TLead | null>(null);
  const [dragging,    setDragging]    = useState<TLead | null>(null);
  const [dragOver,    setDragOver]    = useState<MacroId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/team-view/${id}`).then(r => r.json()).catch(() => ({}));
    if (r.team) {
      setTeam(r.team);
      setLeads(r.leads ?? []);
      setMembers(r.members ?? []);
      setAllSetters(r.allSetters ?? []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patchLead(leadId: string, updates: Record<string, unknown>) {
    setSaving(leadId);
    const res = await fetch(`/api/admin/team-view/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, ...updates }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updated } : l));
    }
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
      `${l.first_name} ${l.last_name ?? ''}`.toLowerCase().includes(q) || (l.phone ?? '').includes(q)
    );
  }, [leads, search]);

  const byMacroTotal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of MACRO) map[m.id] = 0;
    for (const l of visible) { const m = getMacro(l.current_status); if (m) map[m.id]++; }
    return map;
  }, [visible]);

  const byMacro = useMemo(() => {
    const map: Record<string, TLead[]> = {};
    for (const m of MACRO) map[m.id] = [];
    for (const l of visible) { const m = getMacro(l.current_status); if (m) map[m.id].push(l); }
    return map;
  }, [visible]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#080808]">
      <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
    </div>
  );

  if (!team) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#080808]">
      <AlertCircle className="h-10 w-10 text-zinc-700" />
      <p className="text-zinc-400">Equipo no encontrado</p>
      <button onClick={() => router.push('/admin/equipos')} className="text-sm text-brand-gold hover:underline">← Volver</button>
    </div>
  );

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'kanban',   label: 'Leads',    icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: 'metricas', label: 'Métricas', icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: 'config',   label: 'Config',   icon: <Settings className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-screen min-h-0 bg-[#080808]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.push('/admin/equipos')} className="text-zinc-500 hover:text-zinc-300 transition">
            <ArrowLeft className="h-4 w-4" />
          </button>
          {team.avatar_url
            ? <img src={team.avatar_url} alt={team.name} className="h-10 w-10 rounded-xl object-cover border border-zinc-700" />
            : <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center"><Users2 className="h-5 w-5 text-zinc-600" /></div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{team.name}</p>
            <div className="flex gap-2 mt-0.5">
              {members.map(m => (
                <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{m.full_name?.split(' ')[0]}</span>
              ))}
              <span className="text-[10px] text-zinc-600">{leads.length} leads totales</span>
            </div>
          </div>
          <button onClick={load} className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1 -mx-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-xl transition-all border-b-2',
                tab === t.id ? 'text-brand-gold border-brand-gold bg-zinc-900/40' : 'text-zinc-500 border-transparent hover:text-zinc-300')}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KANBAN ── */}
      {tab === 'kanban' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="shrink-0 px-4 py-2 border-b border-zinc-800/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-10 pr-9 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-zinc-500" /></button>}
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="lg:hidden flex flex-col flex-1 min-h-0">
            <div className="shrink-0 flex overflow-x-auto gap-1 px-2 py-2 border-b border-zinc-800/60 scrollbar-none">
              {MACRO.map(col => (
                <button key={col.id} onClick={() => setActiveMacro(col.id)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all',
                    activeMacro === col.id ? cn('border text-white bg-zinc-800', col.col) : 'text-zinc-500 hover:text-zinc-300')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', col.bar)} />
                  {col.label}
                  <span className={cn('text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center', activeMacro === col.id ? col.badge : 'bg-zinc-800 text-zinc-500')}>
                    {byMacroTotal[col.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(byMacro[activeMacro] ?? []).map(lead => (
                <AdminLeadCard key={lead.id} lead={lead}
                  macroBadge={MACRO.find(m => m.id === activeMacro)!.badge}
                  macroBar={MACRO.find(m => m.id === activeMacro)!.bar}
                  saving={saving === lead.id} handledBy={memberName(lead.handled_by)}
                  onMove={() => setMoveTarget(lead)}
                  onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
                  onDragStart={() => setDragging(lead)} onDragEnd={() => { setDragging(null); setDragOver(null); }} />
              ))}
              {(byMacro[activeMacro] ?? []).length === 0 && <div className="h-32 rounded-2xl border-2 border-dashed border-zinc-800 flex items-center justify-center"><p className="text-xs text-zinc-700">Sin leads en esta etapa</p></div>}
            </div>
          </div>

          {/* Desktop kanban */}
          <div className="hidden lg:flex flex-1 overflow-hidden px-3 pt-3 pb-1">
            <div className="grid grid-cols-6 gap-2.5 h-full w-full">
              {MACRO.map(col => {
                const colLeads = byMacro[col.id] ?? [];
                const isOver   = dragOver === col.id;
                return (
                  <div key={col.id}
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
                        ? <div className={cn('h-20 rounded-xl border-2 border-dashed flex items-center justify-center', isOver ? 'border-white/30 bg-white/5' : 'border-zinc-800')}><p className="text-[10px] text-zinc-700">Soltar aquí</p></div>
                        : colLeads.map(lead => (
                          <AdminLeadCard key={lead.id} lead={lead}
                            macroBadge={col.badge} macroBar={col.bar}
                            saving={saving === lead.id} handledBy={memberName(lead.handled_by)}
                            onMove={() => setMoveTarget(lead)}
                            onNote={() => { setNoteModal(lead); setNoteDraft(lead.notes ?? ''); }}
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

      {/* ── MÉTRICAS ── */}
      {tab === 'metricas' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total leads', value: leads.length, color: 'text-white' },
              { label: 'Sin tomar', value: leads.filter(l => !l.handled_by).length, color: 'text-amber-400' },
              { label: 'Reuniones', value: leads.filter(l => l.current_status === 'REUNION_AGENDADA').length, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {members.map(m => {
            const myLeads = leads.filter(l => l.handled_by === m.id);
            const contactados  = myLeads.filter(l => l.current_status !== 'NO_CONTACTADO').length;
            const respondieron = myLeads.filter(l => ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
            const reuniones    = myLeads.filter(l => l.current_status === 'REUNION_AGENDADA').length;
            const tasa         = contactados > 0 ? Math.round((respondieron / contactados) * 100) : 0;
            return (
              <div key={m.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {m.avatar_url
                    ? <img src={m.avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" />
                    : <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">{m.full_name?.[0] ?? '?'}</div>
                  }
                  <div className="flex-1"><p className="text-sm font-bold text-white">{m.full_name}</p><p className="text-[11px] text-zinc-500">{m.points} puntos</p></div>
                  <div className="text-right"><p className="text-lg font-bold text-white">{myLeads.length}</p><p className="text-[10px] text-zinc-600">leads</p></div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Contactados', value: contactados, color: 'text-blue-400' },
                    { label: 'Respondieron', value: respondieron, color: 'text-blue-300' },
                    { label: 'Reuniones', value: reuniones, color: 'text-emerald-400' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-zinc-800/60 py-2">
                      <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
                      <p className="text-[10px] text-zinc-600">{s.label}</p>
                    </div>
                  ))}
                </div>
                {myLeads.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-600"><span>Tasa de respuesta</span><span className="text-zinc-400 font-semibold">{tasa}%</span></div>
                    <div className="h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-yellow-500" style={{ width: `${tasa}%` }} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CONFIG ── */}
      {tab === 'config' && (
        <TeamConfigTab team={team} allSetters={allSetters} onSaved={(t) => setTeam(prev => prev ? { ...prev, ...t } : prev)} teamId={id} />
      )}

      {/* Modal notas */}
      {noteModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/75" onClick={() => setNoteModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-zinc-800 rounded-t-3xl p-5 pb-8">
            <p className="text-base font-bold text-white mb-1">{noteModal.first_name} {noteModal.last_name}</p>
            <p className="text-xs text-zinc-500 mb-3">Notas del admin</p>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={5}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setNoteModal(null)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400">Cancelar</button>
              <button onClick={async () => { await patchLead(noteModal.id, { notes: noteDraft }); setNoteModal(null); }}
                disabled={saving === noteModal.id}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-black disabled:opacity-50">
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
              <p className="text-xs text-zinc-500 mt-0.5">Estado actual: <span className="text-zinc-300">{STATUS_LABELS[moveTarget.current_status as LeadStatus] ?? moveTarget.current_status}</span></p>
            </div>
            <div className="overflow-y-auto max-h-[52vh] px-3 pb-8 space-y-1">
              {ALL_STATUSES.map(key => {
                const isCurrent = moveTarget.current_status === key;
                const macro = getMacro(key);
                return (
                  <button key={key} onClick={() => patchLead(moveTarget.id, { current_status: key })} disabled={isCurrent}
                    className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium transition text-left',
                      isCurrent ? 'border-brand-gold/40 bg-brand-gold/10 text-brand-gold cursor-default' : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200')}>
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', macro?.bar ?? 'bg-zinc-600')} />
                    <span className="flex-1">{STATUS_LABELS[key as LeadStatus] ?? key}</span>
                    {isCurrent && <span className="text-[10px] text-brand-gold/60">actual</span>}
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

// ─── AdminLeadCard ─────────────────────────────────────────────────────────────

function AdminLeadCard({ lead, macroBar, macroBadge, saving, handledBy, onMove, onNote, onDragStart, onDragEnd }: {
  lead: TLead; macroBar: string; macroBadge: string; saving: boolean;
  handledBy: string | null;
  onMove: () => void; onNote: () => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing select-none hover:border-zinc-700 transition-all">
      <div className="flex items-center justify-between gap-1">
        <span className={cn('text-[9px] font-semibold rounded-full px-1.5 py-0.5 truncate max-w-[120px]', macroBadge)}>
          {STATUS_LABELS[lead.current_status as LeadStatus] ?? lead.current_status}
        </span>
        {handledBy && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {handledBy}
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
        <button disabled={saving} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMove(); }}
          className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition disabled:opacity-40">
          {saving ? '...' : <>Mover <ChevronRight className="h-3 w-3" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── TeamConfigTab ─────────────────────────────────────────────────────────────

function TeamConfigTab({ team, allSetters, onSaved, teamId }: {
  team: Team; allSetters: Setter[]; onSaved: (t: Partial<Team>) => void; teamId: string;
}) {
  const [name,     setName]     = useState(team.name);
  const [s1,       setS1]       = useState(team.setter1_id ?? '');
  const [s2,       setS2]       = useState(team.setter2_id ?? '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  async function save() {
    if (!name.trim()) return;
    setSaving(true); setError('');
    const res  = await fetch(`/api/admin/team-view/${teamId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, setter1_id: s1 || null, setter2_id: s2 || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) { onSaved({ name, setter1_id: s1 || null, setter2_id: s2 || null }); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError(json.error ?? 'Error al guardar');
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-md">
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Configuración del equipo</p>

      {/* Nombre */}
      <div>
        <label className="text-xs text-zinc-500 font-medium">Nombre del equipo</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
      </div>

      {/* Setter 1 */}
      <div>
        <label className="text-xs text-zinc-500 font-medium">Setter 1</label>
        <select value={s1} onChange={e => setS1(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none">
          <option value="">— sin asignar —</option>
          {allSetters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      {/* Setter 2 */}
      <div>
        <label className="text-xs text-zinc-500 font-medium">Setter 2</label>
        <select value={s2} onChange={e => setS2(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none">
          <option value="">— sin asignar —</option>
          {allSetters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}

      <button onClick={save} disabled={saving || !name.trim()}
        className={cn('w-full rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2',
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-gold text-black hover:bg-yellow-400 disabled:opacity-50')}>
        {saved ? <><Check className="h-4 w-4" />Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-600 space-y-1">
        <p className="text-zinc-400 font-semibold mb-1">ID del equipo</p>
        <p className="font-mono break-all">{teamId}</p>
      </div>
    </div>
  );
}
