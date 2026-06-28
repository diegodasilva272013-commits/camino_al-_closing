'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Upload, RefreshCw, UserPlus, Filter, X, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useLeadsRealtime } from '@/hooks/useLeadsRealtime';
import { PageHeader } from '@/components/layout/page-header';
import { LeadStatusBadge } from '@/app/(private)/leads/_components/LeadStatusBadge';
import { LEAD_STATUSES, STATUS_LABELS } from '@/constants/leads';
import { cn } from '@/lib/utils';

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  country: string | null;
  source: string | null;
  current_status: string;
  batch_id: string | null;
  follow_up_count: number;
  assigned_at: string | null;
  is_closed: boolean;
  assignee?: { id: string; full_name: string | null; email: string } | null;
};

type Profile = { id: string; full_name: string | null; email: string };

function parseCSV(text: string) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={null}>
      <AdminLeadsPageInner />
    </Suspense>
  );
}

function AdminLeadsPageInner() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState(searchParams.get('user_id') ?? '');

  // Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Selección + asignación inline
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [assignSetter, setAssignSetter] = useState('');
  const [assigning, setAssigning]     = useState(false);
  const [assignMsg, setAssignMsg]     = useState('');

  // Inline status edit
  const [saving, setSaving]       = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  // Realtime — refleja en tiempo real los cambios de setters
  useLeadsRealtime({
    onUpdate: (updated) => {
      setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
      setLiveCount(n => n + 1);
      setTimeout(() => setLiveCount(n => Math.max(0, n - 1)), 3000);
    },
    onInsert: () => { load(); },
  });

  // Dedup
  const [deduping, setDeduping]       = useState(false);
  const [dedupResult, setDedupResult] = useState('');
  const [dupServerCount, setDupServerCount] = useState<number | null>(null);

  async function loadDupCount() {
    try {
      const res  = await fetch('/api/admin/leads/dedup');
      const data = await res.json();
      if (res.ok) setDupServerCount(data.duplicates ?? 0);
    } catch { /**/ }
  }

  async function runDedup() {
    if (!confirm('¿Eliminar leads duplicados? Se conserva el que tiene más actividad (seguimientos/notas). Esta acción no se puede deshacer.')) return;
    setDeduping(true);
    setDedupResult('');
    try {
      const res  = await fetch('/api/admin/leads/dedup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDedupResult(data.message ?? 'Listo');
        setDupServerCount(0);
        await load();
      } else {
        setDedupResult(`Error: ${data.error ?? 'desconocido'}`);
      }
    } catch {
      setDedupResult('Error de red');
    } finally {
      setDeduping(false);
    }
  }

  async function patchLead(id: string, body: Record<string, unknown>) {
    setSaving(id);
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l));
    }
    setSaving(null);
  }

  async function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterUser)   params.set('user_id', filterUser);
    params.set('page', String(p));
    params.set('per_page', '200');

    const res = await fetch(`/api/admin/leads?${params}`);
    const json = await res.json();
    // Soporta respuesta paginada { data, total, ... } o array legacy
    const leads = Array.isArray(json) ? json : (json.data ?? []);
    setLeads(leads);
    if (json.total_pages) setTotalPages(json.total_pages);
    if (json.total !== undefined) setTotalLeads(json.total);
    setPage(p);
    setLoading(false);
  }

  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/leads/metrics');
      const data = await res.json();
      setUsers((data?.ranking ?? []).map((u: { id: string; name: string }) => ({ id: u.id, full_name: u.name, email: '' })));
    } catch { /**/ }
  }

  useEffect(() => { load(1); loadUsers(); loadDupCount(); }, []);
  useEffect(() => { load(1); setSelected(new Set()); setAssignMsg(''); }, [filterStatus, filterUser]);

  function handleCSVFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setCsvRows(rows);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!csvRows.length) return;
    setImporting(true);
    setImportResult('');
    const rows = csvRows.map((r) => ({
      first_name: r.firstname || r.first_name || r.nombre || '',
      last_name:  r.lastname  || r.last_name  || r.apellido || '',
      phone:      r.phone || r.telefono || r.tel || '',
      country:    r.country || r.pais || '',
      source:     r.source || r.fuente || '',
    }));
    const res = await fetch('/api/admin/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    if (res.ok) {
      const skipMsg = data.skipped > 0 ? ` · ${data.skipped} omitidos (ya existían)` : '';
      setImportResult(`✅ ${data.imported} leads importados${skipMsg}. Lote: ${data.batch_id}`);
      setCsvRows([]);
      await load();
    } else {
      setImportResult(`❌ ${data.error}`);
    }
    setImporting(false);
  }

  async function doAssignSelected() {
    if (!assignSetter) { setAssignMsg('Elegí un setter primero.'); return; }
    if (!selected.size) { setAssignMsg('Seleccioná al menos un lead.'); return; }
    setAssigning(true);
    setAssignMsg('');
    const res = await fetch('/api/admin/leads/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: assignSetter, lead_ids: [...selected] }),
    });
    const data = await res.json();
    if (res.ok) {
      const warn = data.pending_warning ? ` · ⚠️ ${data.pending_warning}` : '';
      setAssignMsg(`✅ ${data.assigned} leads asignados.${warn}`);
      setSelected(new Set());
      await load();
    } else {
      setAssignMsg(`❌ ${data.error}`);
    }
    setAssigning(false);
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = leads.map(l => l.id);
    const allSelected = allIds.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); allIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); allIds.forEach(id => n.add(id)); return n; });
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  const unassigned = leads.filter((l) => !l.assignee).length;
  const dupCount   = dupServerCount ?? 0;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Admin · Leads"
        title="Gestión de Leads"
        description={`${totalLeads > 0 ? totalLeads.toLocaleString('es-AR') : leads.length} leads · ${unassigned} sin asignar${dupCount > 0 ? ` · ⚠️ ${dupCount} duplicados` : ''}`}
      />

      {/* Panel de duplicados — siempre visible, conteo real del servidor */}
      <div className={cn(
        'mt-4 flex items-center gap-3 rounded-xl border px-4 py-3',
        dupCount > 0
          ? 'border-red-700/30 bg-red-950/20'
          : 'border-zinc-800 bg-zinc-900/30'
      )}>
        <Trash2 className={cn('h-4 w-4 shrink-0', dupCount > 0 ? 'text-red-400' : 'text-zinc-600')} />
        <p className="flex-1 text-sm">
          {dupServerCount === null ? (
            <span className="text-zinc-500">Contando duplicados...</span>
          ) : dupCount > 0 ? (
            <span className="text-red-300"><span className="font-semibold">{dupCount} leads duplicados</span> (mismo teléfono + mismo setter)</span>
          ) : (
            <span className="text-zinc-500">Sin duplicados detectados</span>
          )}
        </p>
        <button
          onClick={runDedup}
          disabled={deduping || dupCount === 0}
          className={cn(
            'rounded-lg border px-4 py-1.5 text-sm font-semibold transition disabled:opacity-40',
            dupCount > 0
              ? 'border-red-700/50 bg-red-900/30 text-red-400 hover:bg-red-900/50'
              : 'border-zinc-700 bg-zinc-800 text-zinc-500 cursor-default'
          )}
        >
          {deduping ? 'Eliminando...' : 'Eliminar duplicados'}
        </button>
      </div>
      {dedupResult && (
        <p className={cn('mt-2 text-sm', dedupResult.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
          {dedupResult}
        </p>
      )}

      {/* Actions bar */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => { setImportOpen(true); setImportResult(''); setCsvRows([]); }}
          className="flex items-center gap-2 rounded-lg border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.08)] px-4 py-2 text-sm text-brand-gold hover:bg-[rgba(212,175,55,0.15)] transition"
        >
          <Upload className="h-4 w-4" />
          Importar CSV
        </button>
        <Link
          href="/admin/importar-leads"
          className="flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-900/15 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900/25 transition"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Importar Excel
        </Link>
        <button
          onClick={() => setFilterUser('unassigned')}
          className="flex items-center gap-2 rounded-lg border border-blue-700/40 bg-blue-900/20 px-4 py-2 text-sm text-blue-300 hover:bg-blue-900/30 transition"
        >
          <UserPlus className="h-4 w-4" />
          Ver sin asignar
        </button>
        <button onClick={() => load(page)} disabled={loading} className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-brand-muted hover:text-brand-text transition">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
        <div className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
          liveCount > 0
            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
            : 'border-emerald-800/40 bg-emerald-950/20 text-emerald-500'
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', liveCount > 0 ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse')} />
          {liveCount > 0 ? `${liveCount} cambio${liveCount > 1 ? 's' : ''}` : 'En vivo'}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-brand-muted" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#111] px-3 py-1.5 text-xs text-brand-muted focus:outline-none focus:border-brand-gold/30"
          >
            <option value="">Todos los estados</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          {filterStatus && (
            <button onClick={() => setFilterStatus('')} className="text-brand-muted hover:text-brand-text">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-brand-muted" />
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#111] px-3 py-1.5 text-xs text-brand-muted focus:outline-none focus:border-brand-gold/30"
          >
            <option value="">Todos los setters</option>
            <option value="unassigned">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
            ))}
          </select>
          {filterUser && (
            <button onClick={() => setFilterUser('')} className="text-brand-muted hover:text-brand-text">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-[rgba(212,175,55,0.08)] text-left">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-800 accent-yellow-400 cursor-pointer"
                    checked={leads.length > 0 && leads.every(l => selected.has(l.id))}
                    onChange={toggleAll}
                  />
                </th>
                {['Nombre', 'Teléfono', 'Estado', 'Seguim.', 'Asignado a', 'Asignado'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(212,175,55,0.05)]">
              {leads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-brand-muted">No hay leads todavía.</td></tr>
              ) : leads.map((lead) => {
                const isSel = selected.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => toggleOne(lead.id)}
                    className={cn(
                      'cursor-pointer transition',
                      isSel ? 'bg-yellow-500/5 border-yellow-500/10' : 'hover:bg-[rgba(212,175,55,0.02)]'
                    )}
                  >
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(lead.id)}
                        className="rounded border-zinc-600 bg-zinc-800 accent-yellow-400 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-text whitespace-nowrap">
                      {lead.first_name} {lead.last_name ?? ''}
                    </td>
                    <td className="px-4 py-3 text-brand-muted font-mono text-xs">{lead.phone}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <LeadStatusBadge
                        status={lead.current_status}
                        onChange={saving === lead.id ? undefined : (s) => patchLead(lead.id, { current_status: s })}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-muted text-center">{lead.follow_up_count}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">
                      {lead.assignee?.full_name ?? lead.assignee?.email ?? (
                        <span className="text-orange-400/70 italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(lead.assigned_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-brand-muted">
            Mostrando {leads.length} de <span className="text-brand-gold font-semibold">{totalLeads.toLocaleString('es-AR')}</span> leads
            · Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-brand-muted hover:text-brand-text disabled:opacity-30 transition"
            >
              ← Anterior
            </button>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-brand-muted hover:text-brand-text disabled:opacity-30 transition"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
      {totalLeads > 0 && totalPages === 1 && (
        <p className="mt-2 text-xs text-brand-muted">
          {totalLeads.toLocaleString('es-AR')} leads en total
        </p>
      )}

      {/* Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-brand-text">Importar Leads — CSV</h3>
              <button onClick={() => setImportOpen(false)} className="text-brand-muted hover:text-brand-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-brand-muted mb-3">
              El CSV debe tener columnas: <code className="text-brand-gold/80">firstName, lastName, phone, country, source</code>
            </p>

            <div
              className="border-2 border-dashed border-[rgba(212,175,55,0.2)] rounded-xl p-8 text-center cursor-pointer hover:border-brand-gold/30 transition"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleCSVFile(file);
              }}
            >
              <Upload className="h-8 w-8 text-brand-gold/30 mx-auto mb-2" />
              <p className="text-sm text-brand-muted">
                {csvRows.length > 0
                  ? <span className="text-brand-gold">{csvRows.length} filas cargadas</span>
                  : 'Arrastrá el CSV o hacé click para seleccionar'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }}
              />
            </div>

            {csvRows.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-[#111] p-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-brand-muted/60">Vista previa</p>
                {csvRows.slice(0, 5).map((r, i) => (
                  <p key={i} className="text-xs text-brand-muted">
                    {r.firstname || r.first_name} {r.lastname || r.last_name} · {r.phone || r.telefono} · {r.country || r.pais}
                  </p>
                ))}
                {csvRows.length > 5 && <p className="text-xs text-brand-muted/50">... y {csvRows.length - 5} más</p>}
              </div>
            )}

            {importResult && (
              <p className={cn('mt-3 text-sm whitespace-pre-line', importResult.startsWith('✅') ? 'text-green-400' : 'text-red-400')}>
                {importResult}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={doImport}
                disabled={!csvRows.length || importing}
                className="flex-1 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-40"
              >
                {importing ? 'Importando...' : `Importar ${csvRows.length} leads`}
              </button>
              <button
                onClick={() => setImportOpen(false)}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-brand-muted hover:text-brand-text transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de asignación — aparece cuando hay leads seleccionados ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-700/40 bg-[#0a0a14]/95 backdrop-blur-md px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-300">
            {selected.size} lead{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="flex-1 min-w-[180px]">
            <select
              value={assignSetter}
              onChange={e => { setAssignSetter(e.target.value); setAssignMsg(''); }}
              className="w-full rounded-lg border border-zinc-700 bg-[#111] px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-blue-500/50"
            >
              <option value="">— Elegir setter —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
              ))}
            </select>
          </div>
          <button
            onClick={doAssignSelected}
            disabled={assigning || !assignSetter}
            className="flex items-center gap-2 rounded-lg border border-blue-600/50 bg-blue-900/40 px-5 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-900/60 transition disabled:opacity-40"
          >
            <UserPlus className="h-4 w-4" />
            {assigning ? 'Asignando...' : 'Asignar'}
          </button>
          <button
            onClick={() => { setSelected(new Set()); setAssignMsg(''); }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            <X className="h-4 w-4" />
          </button>
          {assignMsg && (
            <span className={cn('text-xs', assignMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400')}>
              {assignMsg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
