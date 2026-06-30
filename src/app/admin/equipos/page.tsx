'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users2, Plus, Upload, ChevronDown, ChevronUp, Check, Database, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, type LeadStatus } from '@/constants/leads';

type TeamRow = {
  id: string; name: string;
  setter1_id: string | null; setter1_name: string | null;
  setter2_id: string | null; setter2_name: string | null;
  lead_count: number;
};
type SetterOption = { id: string; full_name: string | null };
type PoolLead    = { id: string; first_name: string; last_name: string | null; phone: string; country: string | null };
type TeamLead    = { id: string; first_name: string; last_name: string | null; phone: string; current_status: string; handled_by: string | null };

const BLOQUES = [50, 100, 200] as const;

const STATUS_COLOR: Record<string, string> = {
  NO_CONTACTADO: 'bg-zinc-700 text-zinc-300',
  APERTURA_ENVIADA: 'bg-zinc-700 text-zinc-300',
  CONTACTADO: 'bg-blue-900/60 text-blue-300',
  NO_RESPONDE: 'bg-blue-900/60 text-blue-300',
  RESPONDIO: 'bg-blue-800/60 text-blue-200',
  INTERES_DETECTADO: 'bg-blue-800/60 text-blue-200',
  INVITADO_AL_GRUPO: 'bg-blue-800/60 text-blue-200',
  INGRESO_AL_GRUPO: 'bg-blue-800/60 text-blue-200',
  ACTIVO_EN_GRUPO: 'bg-blue-800/60 text-blue-200',
  DIAGNOSTICO_INICIADO: 'bg-yellow-900/50 text-yellow-300',
  DIAGNOSTICO_PROFUNDO: 'bg-yellow-900/50 text-yellow-300',
  REUNION_PROPUESTA: 'bg-yellow-900/50 text-yellow-300',
  REUNION_AGENDADA: 'bg-emerald-900/50 text-emerald-300',
  SEGUIMIENTO_FUTURO: 'bg-zinc-800 text-zinc-500',
  NO_CALIFICA: 'bg-zinc-800 text-zinc-500',
};

export default function AdminEquiposPage() {
  const [teams,      setTeams]      = useState<TeamRow[]>([]);
  const [setters,    setSetters]    = useState<SetterOption[]>([]);
  const [poolCount,  setPoolCount]  = useState<number | null>(null);
  const [poolLeads,  setPoolLeads]  = useState<PoolLead[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Panel expandido por equipo
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [teamLeads,  setTeamLeads]  = useState<Record<string, TeamLead[]>>({});
  const [leadsLoading, setLeadsLoading] = useState<string | null>(null);

  // Panel de carga
  const [uploadTeam,   setUploadTeam]   = useState<string | null>(null);
  const [uploadMode,   setUploadMode]   = useState<'pool' | 'paste'>('pool');
  const [rawLeads,     setRawLeads]     = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Confirmación
  const [confirm,      setConfirm]      = useState<{ teamId: string; teamName: string; cantidad: number } | null>(null);

  // Form crear equipo
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newS1,      setNewS1]      = useState('');
  const [newS2,      setNewS2]      = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createOk,   setCreateOk]   = useState(false);

  const loadPool = useCallback(async () => {
    const res = await fetch('/api/admin/leads/sin-asignar?preview=true').then(r => r.json()).catch(() => ({ count: 0, leads: [] }));
    setPoolCount(res.count ?? 0);
    setPoolLeads(res.leads ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [teamsRes, settersRes] = await Promise.all([
      fetch('/api/admin/teams').then(r => r.json()),
      fetch('/api/admin/setters-list').then(r => r.json()).catch(() => []),
    ]);
    setTeams(Array.isArray(teamsRes) ? teamsRes : []);
    setSetters(Array.isArray(settersRes) ? settersRes : []);
    await loadPool();
    setLoading(false);
  }, [loadPool]);

  useEffect(() => { load(); }, [load]);

  async function loadTeamLeads(teamId: string) {
    setLeadsLoading(teamId);
    const data = await fetch(`/api/admin/teams/${teamId}/leads`).then(r => r.json()).catch(() => []);
    setTeamLeads(prev => ({ ...prev, [teamId]: Array.isArray(data) ? data : [] }));
    setLeadsLoading(null);
  }

  function toggleExpand(teamId: string) {
    if (expanded === teamId) {
      setExpanded(null);
    } else {
      setExpanded(teamId);
      if (!teamLeads[teamId]) loadTeamLeads(teamId);
    }
  }

  function openUpload(teamId: string) {
    setUploadTeam(uploadTeam === teamId ? null : teamId);
    setUploadMode('pool');
    setRawLeads('');
    setUploadResult(null);
  }

  async function createTeam() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), setter1_id: newS1 || null, setter2_id: newS2 || null }),
    });
    setCreating(false);
    if (res.ok) {
      setCreateOk(true);
      setNewName(''); setNewS1(''); setNewS2('');
      setTimeout(() => { setCreateOk(false); setShowCreate(false); }, 1200);
      load();
    }
  }

  async function doImportFromPool() {
    if (!confirm) return;
    setConfirm(null);
    setUploading(true);
    setUploadResult(null);
    const res = await fetch(`/api/admin/teams/${confirm.teamId}/leads-pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: confirm.cantidad }),
    });
    const json = await res.json();
    setUploading(false);
    if (res.ok) {
      setUploadResult({ ok: true, msg: `✓ ${json.inserted} leads importados del pool` });
      // recargar todo
      load();
      loadTeamLeads(confirm.teamId);
    } else {
      setUploadResult({ ok: false, msg: `Error: ${json.error}` });
    }
  }

  function parseLeads(raw: string) {
    return raw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,|\t]/).map(p => p.trim());
      if (parts.length >= 3) return { first_name: parts[0], last_name: parts[1], phone: parts[2], email: parts[3] ?? null };
      if (parts.length === 2) {
        const words = parts[0].split(' ');
        return { first_name: words[0], last_name: words.slice(1).join(' ') || null, phone: parts[1] };
      }
      return null;
    }).filter(Boolean) as { first_name: string; last_name: string | null; phone: string; email: string | null }[];
  }

  async function uploadPasted() {
    if (!uploadTeam || !rawLeads.trim()) return;
    const leads = parseLeads(rawLeads);
    if (!leads.length) { setUploadResult({ ok: false, msg: 'No se pudo parsear ningún lead. Revisá el formato.' }); return; }
    setUploading(true);
    const res = await fetch(`/api/admin/teams/${uploadTeam}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads }),
    });
    const json = await res.json();
    setUploading(false);
    if (res.ok) {
      setUploadResult({ ok: true, msg: `✓ ${json.inserted} leads cargados correctamente` });
      setRawLeads('');
      load();
      loadTeamLeads(uploadTeam);
    } else {
      setUploadResult({ ok: false, msg: `Error: ${json.error}` });
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipos de Setters</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Parejas de setters con pool de leads compartido y separado</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 transition">
          <Plus className="h-4 w-4" /> Nuevo equipo
        </button>
      </div>

      {/* Banner pool */}
      {poolCount !== null && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-yellow-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                {poolCount.toLocaleString()} leads sin asignar disponibles
              </p>
              {poolLeads.length > 0 && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Próximos: {poolLeads.slice(0, 3).map(l => `${l.first_name} ${l.last_name ?? ''}`.trim()).join(' · ')}
                  {poolLeads.length > 3 && ` · +${poolLeads.length - 3} más`}
                </p>
              )}
            </div>
          </div>
          <button onClick={loadPool} className="p-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Form crear equipo */}
      {showCreate && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
          <p className="text-sm font-bold text-yellow-400">Nuevo equipo</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Nombre del equipo</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Equipo Alpha"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
            </div>
            {(['Setter 1', 'Setter 2'] as const).map((label, i) => {
              const val    = i === 0 ? newS1 : newS2;
              const other  = i === 0 ? newS2 : newS1;
              const setVal = i === 0 ? setNewS1 : setNewS2;
              return (
                <div key={label}>
                  <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{label}</label>
                  <select value={val} onChange={e => setVal(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none">
                    <option value="">— Sin asignar —</option>
                    {setters.filter(s => s.id !== other).map(s => (
                      <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>
                    ))}
                  </select>
                </div>
              );
            })}
            <div className="flex items-end">
              <button onClick={createTeam} disabled={creating || !newName.trim()}
                className={cn('w-full rounded-xl py-2.5 text-sm font-bold transition',
                  createOk ? 'bg-emerald-500 text-white' : 'bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50')}>
                {createOk ? <Check className="h-4 w-4 mx-auto" /> : creating ? 'Creando...' : 'Crear equipo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista equipos */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-16 text-center">
          <Users2 className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500">No hay equipos creados todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => {
            const isExpanded  = expanded === team.id;
            const isUploading = uploadTeam === team.id;
            const tLeads      = teamLeads[team.id] ?? [];
            const isLoadingTL = leadsLoading === team.id;

            return (
              <div key={team.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                {/* Header del equipo */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => toggleExpand(team.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-base font-bold text-white truncate">{team.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-zinc-400">{team.setter1_name ?? <span className="text-zinc-700">Sin setter 1</span>}</span>
                      <span className="text-zinc-700 text-xs">+</span>
                      <span className="text-xs text-zinc-400">{team.setter2_name ?? <span className="text-zinc-700">Sin setter 2</span>}</span>
                    </div>
                  </button>

                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-white">{team.lead_count}</p>
                    <p className="text-[10px] text-zinc-600">leads</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openUpload(team.id)}
                      className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                        isUploading ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white')}>
                      <Upload className="h-3.5 w-3.5" />
                      Cargar
                    </button>
                    <button onClick={() => toggleExpand(team.id)}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 hover:text-zinc-200 transition">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Panel cargar leads */}
                {isUploading && (
                  <div className="border-t border-zinc-800 bg-zinc-950/40">
                    {/* Tabs */}
                    <div className="flex border-b border-zinc-800">
                      {(['pool', 'paste'] as const).map(mode => (
                        <button key={mode} onClick={() => { setUploadMode(mode); setUploadResult(null); }}
                          className={cn('flex-1 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5',
                            uploadMode === mode ? 'text-yellow-400 border-b-2 border-yellow-400 -mb-px' : 'text-zinc-500 hover:text-zinc-300')}>
                          {mode === 'pool'
                            ? <><Database className="h-3.5 w-3.5" /> Desde pool sin asignar {poolCount !== null && <span className="ml-1 rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{poolCount.toLocaleString()}</span>}</>
                            : 'Pegar manualmente'}
                        </button>
                      ))}
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {uploadMode === 'pool' ? (
                        <>
                          {/* Preview del pool */}
                          {poolLeads.length > 0 && (
                            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                              <p className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-900/60 border-b border-zinc-800">
                                Próximos leads del pool (primeros {poolLeads.length})
                              </p>
                              <div className="divide-y divide-zinc-800/60 max-h-48 overflow-y-auto">
                                {poolLeads.map(l => (
                                  <div key={l.id} className="flex items-center gap-3 px-3 py-2">
                                    <p className="text-sm text-white font-medium flex-1 truncate">{l.first_name} {l.last_name ?? ''}</p>
                                    <p className="text-[11px] text-zinc-500 font-mono shrink-0">{l.phone}</p>
                                    {l.country && <p className="text-[10px] text-zinc-700 shrink-0">{l.country}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-zinc-400">Seleccioná cuántos leads importar al equipo <span className="text-white font-semibold">{team.name}</span>:</p>

                          {/* Botones de bloque */}
                          <div className="grid grid-cols-3 gap-3">
                            {BLOQUES.map(n => {
                              const disabled = uploading || (poolCount !== null && poolCount < n);
                              return (
                                <button key={n}
                                  onClick={() => !disabled && setConfirm({ teamId: team.id, teamName: team.name, cantidad: n })}
                                  disabled={disabled}
                                  className={cn('rounded-xl border py-4 text-center transition group',
                                    disabled ? 'border-zinc-800 opacity-40 cursor-not-allowed' : 'border-zinc-700 bg-zinc-900 hover:border-yellow-500/50 hover:bg-yellow-500/5 cursor-pointer')}>
                                  <p className={cn('text-2xl font-bold transition', disabled ? 'text-zinc-600' : 'text-white group-hover:text-yellow-400')}>{n}</p>
                                  <p className="text-[11px] text-zinc-500 mt-0.5">leads</p>
                                </button>
                              );
                            })}
                          </div>

                          {poolCount === 0 && (
                            <div className="flex items-center gap-2 text-amber-400 text-xs">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              No hay leads sin asignar disponibles en el pool.
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] text-zinc-600 font-mono bg-zinc-900/60 rounded-lg px-3 py-2 space-y-0.5">
                            <p>Nombre, Apellido, Teléfono</p>
                            <p>Nombre, Apellido, Teléfono, Email (opcional)</p>
                            <p className="text-zinc-700">— también acepta | o tabs —</p>
                          </div>
                          <textarea value={rawLeads} onChange={e => setRawLeads(e.target.value)} rows={7}
                            placeholder={"Juan, Pérez, 5491112345678\nMaría, García, 5491198765432\n..."}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 resize-none font-mono" />
                        </>
                      )}

                      {uploadResult && (
                        <p className={cn('text-xs font-medium', uploadResult.ok ? 'text-emerald-400' : 'text-red-400')}>
                          {uploadResult.msg}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => { setUploadTeam(null); setRawLeads(''); setUploadResult(null); }}
                          className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition">
                          Cerrar
                        </button>
                        {uploadMode === 'paste' && (
                          <button onClick={uploadPasted} disabled={uploading || !rawLeads.trim()}
                            className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50 transition">
                            {uploading ? 'Cargando...' : `Cargar ${parseLeads(rawLeads).length || ''} leads`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de leads del equipo */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/20">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Leads del equipo</p>
                      <button onClick={() => loadTeamLeads(team.id)} className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 transition">
                        <RefreshCw className={cn('h-3.5 w-3.5', isLoadingTL && 'animate-spin')} />
                      </button>
                    </div>

                    {isLoadingTL ? (
                      <div className="flex justify-center py-8">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
                      </div>
                    ) : tLeads.length === 0 ? (
                      <div className="py-10 text-center">
                        <p className="text-sm text-zinc-600">Este equipo no tiene leads cargados todavía</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/40 max-h-96 overflow-y-auto">
                        {/* Cabecera */}
                        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-5 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                          <span>Nombre</span>
                          <span>Teléfono</span>
                          <span>Estado</span>
                        </div>
                        {tLeads.map(l => (
                          <div key={l.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-5 py-2.5 hover:bg-zinc-800/20 transition">
                            <p className="text-sm text-white font-medium truncate">
                              {l.first_name} {l.last_name ?? ''}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">{l.phone}</p>
                            <span className={cn('text-[9px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap', STATUS_COLOR[l.current_status] ?? 'bg-zinc-800 text-zinc-500')}>
                              {STATUS_LABELS[l.current_status as LeadStatus] ?? l.current_status}
                            </span>
                          </div>
                        ))}
                        <div className="px-5 py-2.5 text-[11px] text-zinc-600">
                          {tLeads.length} leads cargados en total
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal confirmación */}
      {confirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/80" onClick={() => setConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-[#111] p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                  <Database className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Confirmar importación</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Vas a agregar <span className="text-white font-semibold">{confirm.cantidad} leads</span> al equipo{' '}
                    <span className="text-white font-semibold">{confirm.teamName}</span>.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400 space-y-1">
                <p>• Los leads se toman del pool sin asignar en orden de carga</p>
                <p>• Una vez importados, quedan fuera del pool y no se duplican</p>
                <p>• Solo los dos setters del equipo los verán en su vista</p>
                <p>• No se mezclan con los leads personales de ningún setter</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirm(null)}
                  className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition">
                  Cancelar
                </button>
                <button onClick={doImportFromPool}
                  className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 transition flex items-center justify-center gap-1.5">
                  <Check className="h-4 w-4" />
                  Importar {confirm.cantidad}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
