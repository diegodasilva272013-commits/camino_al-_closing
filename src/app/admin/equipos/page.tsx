'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users2, Plus, Upload, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type TeamRow = {
  id: string; name: string;
  setter1_id: string | null; setter1_name: string | null;
  setter2_id: string | null; setter2_name: string | null;
  lead_count: number;
};
type SetterOption = { id: string; full_name: string | null };

export default function AdminEquiposPage() {
  const [teams,   setTeams]   = useState<TeamRow[]>([]);
  const [setters, setSetters] = useState<SetterOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form crear equipo
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newS1,      setNewS1]      = useState('');
  const [newS2,      setNewS2]      = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createOk,   setCreateOk]   = useState(false);

  // Form cargar leads
  const [uploadTeam,   setUploadTeam]   = useState<string | null>(null);
  const [rawLeads,     setRawLeads]     = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [teamsRes, settersRes] = await Promise.all([
      fetch('/api/admin/teams').then(r => r.json()),
      fetch('/api/admin/setters-list').then(r => r.json()).catch(() => []),
    ]);
    setTeams(Array.isArray(teamsRes) ? teamsRes : []);
    setSetters(Array.isArray(settersRes) ? settersRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  // Parsea el texto pegado: "Nombre Apellido | teléfono" o "Nombre,Apellido,Teléfono"
  function parseLeads(raw: string) {
    return raw.split('\n')
      .map(line => line.trim()).filter(Boolean)
      .map(line => {
        // soporte: "," o "|" o tab como separador
        const parts = line.split(/[,|\t]/).map(p => p.trim());
        if (parts.length >= 3) {
          return { first_name: parts[0], last_name: parts[1], phone: parts[2], email: parts[3] ?? null };
        }
        // si solo 2 partes: nombre + teléfono
        if (parts.length === 2) {
          const [namePart, phone] = parts;
          const words = namePart.split(' ');
          return { first_name: words[0], last_name: words.slice(1).join(' ') || null, phone };
        }
        return null;
      })
      .filter(Boolean) as { first_name: string; last_name: string | null; phone: string; email: string | null }[];
  }

  async function uploadLeads() {
    if (!uploadTeam || !rawLeads.trim()) return;
    const leads = parseLeads(rawLeads);
    if (!leads.length) { setUploadResult('No se pudo parsear ningún lead. Revisá el formato.'); return; }
    setUploading(true);
    const res = await fetch(`/api/admin/teams/${uploadTeam}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads }),
    });
    const json = await res.json();
    setUploading(false);
    if (res.ok) {
      setUploadResult(`✓ ${json.inserted} leads cargados correctamente`);
      setRawLeads('');
      load();
    } else {
      setUploadResult(`Error: ${json.error}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipos de Setters</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Parejas de setters con su propio pool de leads compartido</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 transition">
          <Plus className="h-4 w-4" />
          Nuevo equipo
        </button>
      </div>

      {/* Form crear equipo */}
      {showCreate && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
          <p className="text-sm font-bold text-yellow-400">Nuevo equipo</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Nombre del equipo</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ej: Equipo Alpha"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Setter 1</label>
              <select value={newS1} onChange={e => setNewS1(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none">
                <option value="">— Sin asignar —</option>
                {setters.filter(s => s.id !== newS2).map(s => (
                  <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Setter 2</label>
              <select value={newS2} onChange={e => setNewS2(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none">
                <option value="">— Sin asignar —</option>
                {setters.filter(s => s.id !== newS1).map(s => (
                  <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>
                ))}
              </select>
            </div>
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

      {/* Lista de equipos */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" /></div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-16 text-center">
          <Users2 className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500">No hay equipos creados todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white truncate">{team.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-zinc-400">{team.setter1_name ?? <span className="text-zinc-700">Sin setter 1</span>}</span>
                    <span className="text-zinc-700">+</span>
                    <span className="text-xs text-zinc-400">{team.setter2_name ?? <span className="text-zinc-700">Sin setter 2</span>}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-white">{team.lead_count}</p>
                  <p className="text-[10px] text-zinc-600">leads</p>
                </div>
                <button onClick={() => { setUploadTeam(uploadTeam === team.id ? null : team.id); setUploadResult(null); setRawLeads(''); }}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition">
                  <Upload className="h-3.5 w-3.5" />
                  Cargar leads
                  {uploadTeam === team.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Panel de carga de leads */}
              {uploadTeam === team.id && (
                <div className="border-t border-zinc-800 px-5 py-4 space-y-3 bg-zinc-950/40">
                  <p className="text-xs text-zinc-400 font-medium">
                    Pegá los leads — un lead por línea, con el formato:
                  </p>
                  <div className="text-[11px] text-zinc-600 space-y-0.5 font-mono bg-zinc-900/60 rounded-lg px-3 py-2">
                    <p>Nombre, Apellido, Teléfono</p>
                    <p>Nombre, Apellido, Teléfono, Email (opcional)</p>
                    <p className="text-zinc-700">— también acepta | o tabs como separador —</p>
                  </div>
                  <textarea value={rawLeads} onChange={e => setRawLeads(e.target.value)} rows={8}
                    placeholder={"Juan, Pérez, 5491112345678\nMaría, García, 5491198765432\n..."}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 resize-none font-mono" />
                  {uploadResult && (
                    <p className={cn('text-xs font-medium', uploadResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400')}>
                      {uploadResult}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setUploadTeam(null); setRawLeads(''); setUploadResult(null); }}
                      className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition">
                      Cancelar
                    </button>
                    <button onClick={uploadLeads} disabled={uploading || !rawLeads.trim()}
                      className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50 transition">
                      {uploading ? 'Cargando...' : `Cargar ${parseLeads(rawLeads).length || ''} leads`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
