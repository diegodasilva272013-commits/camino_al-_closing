'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Plus, Trash2, RefreshCw, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

type Strike = {
  id: string;
  setter_id: string;
  issued_by: string | null;
  reason: string;
  category: string | null;
  severity: number;
  created_at: string;
};

type Profile = { id: string; full_name: string | null; email: string; role: string; avatar_url?: string | null };

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'puntualidad',  label: 'Puntualidad' },
  { key: 'conducta',     label: 'Conducta' },
  { key: 'rendimiento',  label: 'Rendimiento' },
  { key: 'comunicacion', label: 'Comunicación' },
  { key: 'otro',         label: 'Otro' },
];

const SEV: Record<number, { label: string; cls: string }> = {
  1: { label: 'Aviso',          cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-600/40' },
  2: { label: 'Advertencia',    cls: 'bg-orange-500/15 text-orange-400 border-orange-600/40' },
  3: { label: 'Strike Grave',   cls: 'bg-red-500/15    text-red-400    border-red-600/40' },
};

export default function AdminStrikesPage() {
  const [strikes,       setStrikes]       = useState<Strike[]>([]);
  const [profiles,      setProfiles]      = useState<Profile[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterSetter,  setFilterSetter]  = useState('');
  const [filterCat,     setFilterCat]     = useState('');
  const [filterSev,     setFilterSev]     = useState('');
  const [deleting,      setDeleting]      = useState<string | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [form, setForm] = useState({ setter_id: '', reason: '', category: 'otro', severity: '1' });
  const [saving, setSaving]  = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/strikes').then(r => r.json()).catch(() => ({}));
    setStrikes(r.strikes  ?? []);
    setProfiles(r.profiles ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const setterProfiles = useMemo(() => profiles.filter(p => p.role === 'setter'), [profiles]);

  const bySetterTotal = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of strikes) m[s.setter_id] = (m[s.setter_id] ?? 0) + 1;
    return m;
  }, [strikes]);

  const filtered = useMemo(() => strikes.filter(s => {
    if (filterSetter && s.setter_id !== filterSetter) return false;
    if (filterCat && s.category !== filterCat) return false;
    if (filterSev && String(s.severity) !== filterSev) return false;
    return true;
  }), [strikes, filterSetter, filterCat, filterSev]);

  async function addStrike() {
    if (!form.setter_id || !form.reason.trim()) { setFormErr('Seleccioná el setter y escribí el motivo.'); return; }
    setSaving(true); setFormErr('');
    const res = await fetch('/api/admin/strikes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, severity: parseInt(form.severity) }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setStrikes(prev => [json, ...prev]);
      setShowForm(false);
      setForm({ setter_id: '', reason: '', category: 'otro', severity: '1' });
    } else setFormErr(json.error ?? 'Error');
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar este strike? Esta acción no se puede deshacer.')) return;
    setDeleting(id);
    await fetch(`/api/admin/strikes/${id}`, { method: 'DELETE' });
    setStrikes(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Control de Strikes
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {strikes.length} strikes registrados · {setterProfiles.length} setters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-gold px-3 py-2 text-xs font-bold text-black hover:bg-yellow-400 transition">
            <Plus className="h-3.5 w-3.5" />
            Emitir strike
          </button>
        </div>
      </div>

      {/* Scoreboard compacto — top 5 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...setterProfiles]
          .sort((a, b) => (bySetterTotal[b.id] ?? 0) - (bySetterTotal[a.id] ?? 0))
          .slice(0, 4)
          .map(p => {
            const n = bySetterTotal[p.id] ?? 0;
            return (
              <button key={p.id} onClick={() => setFilterSetter(filterSetter === p.id ? '' : p.id)}
                className={cn('flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                  filterSetter === p.id ? 'border-yellow-600/50 bg-yellow-950/20' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700')}>
                <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                  {p.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    : (p.full_name?.charAt(0) ?? '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{p.full_name ?? p.email}</p>
                  <p className={cn('text-[11px] font-bold', n === 0 ? 'text-zinc-600' : n >= 3 ? 'text-red-400' : 'text-yellow-400')}>
                    {n} {n === 1 ? 'strike' : 'strikes'}
                  </p>
                </div>
              </button>
            );
          })}
      </div>

      {/* Formulario nuevo strike */}
      {showForm && (
        <div className="rounded-2xl border border-yellow-700/40 bg-yellow-950/15 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-yellow-400">Nuevo Strike</p>
            <button onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-zinc-400"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Setter</label>
              <select value={form.setter_id} onChange={e => setForm(f => ({ ...f, setter_id: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
                <option value="">— Elegir setter —</option>
                {setterProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Categoría</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Severidad</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none">
                <option value="1">⚠ Aviso</option>
                <option value="2">⚠⚠ Advertencia</option>
                <option value="3">⛔ Strike Grave</option>
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Motivo (visible para todo el equipo)</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                rows={3} placeholder="Describí qué regla del reglamento se violó y el contexto..."
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none resize-none" />
            </div>
          </div>
          {formErr && <p className="text-xs text-red-400">{formErr}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={addStrike} disabled={saving}
              className="px-4 py-2 rounded-xl bg-yellow-500 text-xs font-bold text-black hover:bg-yellow-400 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Emitir strike'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-zinc-600" />
        <select value={filterSetter} onChange={e => setFilterSetter(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 focus:outline-none">
          <option value="">Todos los setters</option>
          {setterProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 focus:outline-none">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 focus:outline-none">
          <option value="">Todas las severidades</option>
          <option value="1">Aviso</option>
          <option value="2">Advertencia</option>
          <option value="3">Strike Grave</option>
        </select>
        {(filterSetter || filterCat || filterSev) && (
          <button onClick={() => { setFilterSetter(''); setFilterCat(''); setFilterSev(''); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
            <X className="h-3 w-3" />Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-600">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabla de strikes */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 py-16 text-center text-zinc-600 text-sm">
          Sin strikes con los filtros actuales.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-2.5 text-left text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Setter</th>
                <th className="px-4 py-2.5 text-left text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Motivo</th>
                <th className="px-4 py-2.5 text-left text-[10px] text-zinc-500 font-semibold uppercase tracking-wider hidden lg:table-cell">Categoría</th>
                <th className="px-4 py-2.5 text-left text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Severidad</th>
                <th className="px-4 py-2.5 text-left text-[10px] text-zinc-500 font-semibold uppercase tracking-wider hidden md:table-cell">Fecha</th>
                <th className="px-4 py-2.5 text-left text-[10px] text-zinc-500 font-semibold uppercase tracking-wider hidden md:table-cell">Emitido por</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map(strike => {
                const setter = profileMap.get(strike.setter_id);
                const issuer = strike.issued_by ? profileMap.get(strike.issued_by) : null;
                const sev    = SEV[strike.severity] ?? SEV[1];
                return (
                  <tr key={strike.id} className="hover:bg-zinc-900/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-400">
                          {setter?.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={setter.avatar_url} alt="" className="h-full w-full object-cover" />
                            : (setter?.full_name?.charAt(0) ?? '?').toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-white whitespace-nowrap">{setter?.full_name ?? setter?.email ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-xs text-zinc-300 line-clamp-2">{strike.reason}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[11px] text-zinc-500">{CATEGORIES.find(c => c.key === strike.category)?.label ?? strike.category ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap', sev.cls)}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                        {new Date(strike.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[11px] text-zinc-500">{issuer?.full_name ?? issuer?.email ?? 'Sistema'}</span>
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => del(strike.id)} disabled={deleting === strike.id}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-800 text-zinc-600 hover:border-red-700/50 hover:text-red-400 transition disabled:opacity-40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
