'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users2, Plus, Edit2, Check, X, RefreshCw,
  AlertTriangle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Target, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Profile  = { id: string; full_name: string | null; email: string; avatar_url: string | null; role: string };
type TDR      = { aperturas_count: number; contactados_count: number; conv_count: number; all_tasks_ok: boolean } | null;
type DuplaConfig = { aperturas_meta: number; contactados_meta: number; conv_meta: number } | null;

type Team = {
  id: string; name: string; activa: boolean; created_at: string;
  setter1_id: string | null; setter2_id: string | null;
  setter1: Profile | null; setter2: Profile | null;
  config: DuplaConfig;
  estado_hoy: { setter1: TDR; setter2: TDR };
  strikes_hoy: { setter1: number; setter2: number };
};

type PageData = { teams: Team[]; setters: Profile[]; fecha: string };

function Avatar({ p }: { p: Profile | null }) {
  if (!p) return (
    <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-600 shrink-0">?</div>
  );
  return (
    <div className="h-7 w-7 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">
      {p.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
        : (p.full_name?.[0] ?? p.email[0]).toUpperCase()}
    </div>
  );
}

function MiniBar({ value, max, ok }: { value: number; max: number; ok: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col items-center gap-0.5 w-10">
      <div className="h-1 w-full rounded-full bg-zinc-800">
        <div className={cn('h-full rounded-full', ok ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[9px] font-bold tabular-nums', ok ? 'text-emerald-400' : 'text-zinc-600')}>{value}/{max}</span>
    </div>
  );
}

function SetterRow({ profile, tdr, config, strikes }: { profile: Profile | null; tdr: TDR; config: DuplaConfig; strikes: number }) {
  const m = config ?? { aperturas_meta: 5, contactados_meta: 5, conv_meta: 10 };
  const name = profile?.full_name?.split(' ')[0] ?? profile?.email ?? '—';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Avatar p={profile} />
      <span className="text-xs text-zinc-300 w-20 truncate">{name}</span>
      {tdr ? (
        <div className="flex gap-2 flex-1">
          <MiniBar value={tdr.aperturas_count}  max={m.aperturas_meta}   ok={tdr.aperturas_count  >= m.aperturas_meta} />
          <MiniBar value={tdr.contactados_count} max={m.contactados_meta} ok={tdr.contactados_count >= m.contactados_meta} />
          <MiniBar value={tdr.conv_count}        max={m.conv_meta}        ok={tdr.conv_count        >= m.conv_meta} />
          {tdr.all_tasks_ok && <span className="text-[11px] text-emerald-400 font-bold ml-1">✓</span>}
        </div>
      ) : (
        <span className="text-[10px] text-zinc-700 flex-1">sin datos hoy</span>
      )}
      <div className="flex gap-1 shrink-0">
        {[0,1,2].map(i => (
          <span key={i} className={cn('h-2 w-2 rounded-full',
            i < strikes ? (strikes >= 3 ? 'bg-red-500' : strikes === 2 ? 'bg-orange-400' : 'bg-yellow-400') : 'bg-zinc-800')} />
        ))}
      </div>
    </div>
  );
}

export default function AdminDuplasPage() {
  const [data,    setData]    = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // New
  const [nName, setNName] = useState('');
  const [nS1,   setNS1]   = useState('');
  const [nS2,   setNS2]   = useState('');
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId,  setEditId]  = useState<string | null>(null);
  const [eName,   setEName]   = useState('');
  const [eS1,     setES1]     = useState('');
  const [eS2,     setES2]     = useState('');
  const [eAp,     setEAp]     = useState(5);
  const [eCo,     setECo]     = useState(5);
  const [eCv,     setECv]     = useState(10);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/equipos').then(r => r.json()).catch(() => null);
    setData(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!nName.trim()) return;
    setCreating(true);
    await fetch('/api/admin/equipos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nName.trim(), setter1_id: nS1 || null, setter2_id: nS2 || null }),
    });
    setNName(''); setNS1(''); setNS2('');
    setShowNew(false); setCreating(false);
    load();
  }

  function startEdit(t: Team) {
    setEditId(t.id); setEName(t.name);
    setES1(t.setter1_id ?? ''); setES2(t.setter2_id ?? '');
    setEAp(t.config?.aperturas_meta ?? 5);
    setECo(t.config?.contactados_meta ?? 5);
    setECv(t.config?.conv_meta ?? 10);
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    await fetch('/api/admin/equipos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId, name: eName, setter1_id: eS1 || null, setter2_id: eS2 || null,
        config: { aperturas_meta: eAp, contactados_meta: eCo, conv_meta: eCv },
      }),
    });
    setEditId(null); setSaving(false);
    load();
  }

  async function toggleActiva(t: Team) {
    await fetch('/api/admin/equipos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, activa: !t.activa }),
    });
    load();
  }

  async function runDetect() {
    await fetch('/api/cron/detect-tareas');
    load();
  }

  const setters = data?.setters ?? [];

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Users2 className="h-4 w-4 text-yellow-500" /> Tareas Duplas
          </h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            {data?.fecha ? `Hoy ${data.fecha} — Ap / Co / Cv` : 'Gestión de tareas diarias por dupla'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={runDetect} title="Recalcular tareas ahora"
            className="rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition">
            Detectar
          </button>
          <button onClick={load} disabled={loading}
            className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => setShowNew(v => !v)}
            className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition',
              showNew ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-yellow-500 text-black hover:bg-yellow-400')}>
            {showNew ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showNew ? 'Cancelar' : 'Nueva dupla'}
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-[10px] text-zinc-600 items-center">
        <span>Ap = Aperturas</span><span>Co = Contactados</span><span>Cv = Conversaciones</span>
        <span className="flex gap-1 ml-2 items-center">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> 1 strike
          <span className="h-2 w-2 rounded-full bg-orange-400 ml-1" /> 2
          <span className="h-2 w-2 rounded-full bg-red-500 ml-1" /> 3+
        </span>
      </div>

      {/* Form nueva dupla */}
      {showNew && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-400">Nueva dupla</p>
          <input value={nName} onChange={e => setNName(e.target.value)} placeholder="Nombre del equipo"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Setter 1', val: nS1, set: setNS1, other: nS2 },
              { label: 'Setter 2', val: nS2, set: setNS2, other: nS1 },
            ].map(f => (
              <div key={f.label}>
                <label className="text-[11px] text-zinc-500">{f.label}</label>
                <select value={f.val} onChange={e => f.set(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="">— ninguno —</option>
                  {setters.filter(s => s.id !== f.other).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button onClick={create} disabled={creating || !nName.trim()}
            className="w-full rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50 transition">
            {creating ? 'Creando...' : 'Crear dupla'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : (data?.teams ?? []).length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 py-16 flex flex-col items-center gap-3">
          <Users2 className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-600">No hay duplas configuradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.teams ?? []).map(team => {
            const isOpen = open === team.id;
            const isEdit = editId === team.id;
            const s1ok   = team.estado_hoy.setter1?.all_tasks_ok;
            const s2ok   = team.estado_hoy.setter2?.all_tasks_ok;
            const teamOk = s1ok && s2ok;

            return (
              <div key={team.id} className={cn('rounded-2xl border transition-all',
                !team.activa ? 'border-zinc-800/40 opacity-60'
                  : teamOk   ? 'border-emerald-700/30'
                  : 'border-zinc-800')}>

                {/* Row */}
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-bold text-white">{team.name}</p>
                      {!team.activa && <span className="text-[9px] border border-zinc-700 rounded px-1 text-zinc-600">inactiva</span>}
                      {teamOk && <span className="text-[10px] text-emerald-400 font-bold">✓ dupla ok</span>}
                    </div>
                    <SetterRow profile={team.setter1} tdr={team.estado_hoy.setter1} config={team.config} strikes={team.strikes_hoy.setter1} />
                    <SetterRow profile={team.setter2} tdr={team.estado_hoy.setter2} config={team.config} strikes={team.strikes_hoy.setter2} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-1">
                    <button onClick={() => toggleActiva(team)}
                      className="text-zinc-600 hover:text-zinc-400 transition p-1">
                      {team.activa
                        ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                        : <ToggleLeft className="h-4 w-4 text-zinc-600" />}
                    </button>
                    <button onClick={() => isEdit ? setEditId(null) : startEdit(team)}
                      className={cn('p-1.5 rounded-xl border transition',
                        isEdit ? 'border-yellow-500/40 text-yellow-400' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400')}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setOpen(isOpen ? null : team.id)}
                      className="p-1.5 rounded-xl border border-zinc-800 text-zinc-600 hover:text-zinc-400 transition">
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                {isEdit && (
                  <div className="border-t border-zinc-800 px-4 py-4 space-y-3 bg-zinc-900/40">
                    <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Editar dupla</p>
                    <input value={eName} onChange={e => setEName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none" />
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Setter 1', val: eS1, set: setES1, other: eS2 },
                        { label: 'Setter 2', val: eS2, set: setES2, other: eS1 },
                      ].map(f => (
                        <div key={f.label}>
                          <label className="text-[11px] text-zinc-500">{f.label}</label>
                          <select value={f.val} onChange={e => f.set(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white focus:outline-none">
                            <option value="">— ninguno —</option>
                            {setters.filter(s => s.id !== f.other).map(s => (
                              <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1">
                        <Target className="h-3 w-3" /> Metas diarias por setter
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Aperturas',   val: eAp, set: setEAp },
                          { label: 'Contactados', val: eCo, set: setECo },
                          { label: 'Conversaciones', val: eCv, set: setECv },
                        ].map(f => (
                          <div key={f.label}>
                            <label className="text-[10px] text-zinc-600">{f.label}</label>
                            <input type="number" min={1} max={50} value={f.val}
                              onChange={e => f.set(Number(e.target.value))}
                              className="mt-0.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white text-center focus:outline-none" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditId(null)}
                        className="flex-1 rounded-xl border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition">
                        Cancelar
                      </button>
                      <button onClick={saveEdit} disabled={saving}
                        className="flex-1 rounded-xl bg-yellow-500 py-2 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50 transition flex items-center justify-center gap-1">
                        {saving ? 'Guardando...' : <><Check className="h-3.5 w-3.5" /> Guardar</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded config summary */}
                {isOpen && !isEdit && (
                  <div className="border-t border-zinc-800 px-4 py-3 space-y-2 bg-zinc-900/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 flex items-center gap-1"><Target className="h-3 w-3" /> Metas</span>
                      <div className="flex gap-4 text-zinc-400">
                        <span>Ap: <b className="text-white">{team.config?.aperturas_meta ?? 5}</b></span>
                        <span>Co: <b className="text-white">{team.config?.contactados_meta ?? 5}</b></span>
                        <span>Cv: <b className="text-white">{team.config?.conv_meta ?? 10}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 flex items-center gap-1"><Shield className="h-3 w-3" /> Strikes acumulados</span>
                      <div className="flex gap-4 text-zinc-400">
                        <span>{team.setter1?.full_name?.split(' ')[0] ?? '—'}: <b className={team.strikes_hoy.setter1 >= 3 ? 'text-red-400' : team.strikes_hoy.setter1 > 0 ? 'text-yellow-400' : 'text-white'}>{team.strikes_hoy.setter1}</b></span>
                        <span>{team.setter2?.full_name?.split(' ')[0] ?? '—'}: <b className={team.strikes_hoy.setter2 >= 3 ? 'text-red-400' : team.strikes_hoy.setter2 > 0 ? 'text-yellow-400' : 'text-white'}>{team.strikes_hoy.setter2}</b></span>
                      </div>
                    </div>
                    {(team.strikes_hoy.setter1 >= 3 || team.strikes_hoy.setter2 >= 3) && (
                      <div className="flex items-center gap-2 text-[11px] text-red-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Setter bloqueado — ir a Strikes para gestionar
                      </div>
                    )}
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
