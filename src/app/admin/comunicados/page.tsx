'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pin, PinOff, Trash2, Loader2, Eye, EyeOff,
  CheckCircle, XCircle, Users2, X, ChevronDown, ChevronUp,
  Bell, Zap, AlertTriangle, Calendar, ClipboardList, RefreshCw,
} from 'lucide-react';

type Ann = {
  id: string; title: string; body: string; type: string; target: string;
  deadline: string | null; is_pinned: boolean; is_active: boolean;
  created_at: string; reads: number; total_recipients: number;
};

type ReadData = { read: { user_id: string; name: string; email: string; read_at: string }[]; unread: { user_id: string; name: string; email: string }[] };

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  urgente:    { label: 'Urgente',    color: 'text-red-400 border-red-500/30 bg-red-900/20',          icon: <Zap className="h-3 w-3" /> },
  strike:     { label: 'Strike',     color: 'text-orange-400 border-orange-500/30 bg-orange-900/20', icon: <AlertTriangle className="h-3 w-3" /> },
  formulario: { label: 'Formulario', color: 'text-brand-gold border-brand-gold/30 bg-[rgba(212,175,55,0.1)]', icon: <ClipboardList className="h-3 w-3" /> },
  reunion:    { label: 'Reunión',    color: 'text-sky-400 border-sky-500/30 bg-sky-900/20',          icon: <Calendar className="h-3 w-3" /> },
  cambio:     { label: 'Cambio',     color: 'text-violet-400 border-violet-500/30 bg-violet-900/20', icon: <RefreshCw className="h-3 w-3" /> },
  comunicado: { label: 'Comunicado', color: 'text-zinc-300 border-zinc-600 bg-zinc-800/40',          icon: <Bell className="h-3 w-3" /> },
};

const TARGET_LABEL: Record<string, string> = {
  todos: 'Todos',
  equipo: 'Equipo',
  comunidad: 'Comunidad',
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.comunicado;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function DeadlineDisplay({ deadline }: { deadline: string }) {
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const past = diff < 0;
  const hours = Math.abs(Math.floor(diff / 3600000));
  const mins  = Math.abs(Math.floor((diff % 3600000) / 60000));
  const label = past
    ? `Venció hace ${hours}h ${mins}m`
    : hours < 24
    ? `Vence en ${hours}h ${mins}m`
    : `Vence el ${d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  return (
    <span className={`text-[10px] font-bold ${past ? 'text-zinc-500' : hours < 2 ? 'text-red-400' : 'text-amber-400'}`}>
      ⏰ {label}
    </span>
  );
}

function ReadsModal({ ann, onClose }: { ann: Ann; onClose: () => void }) {
  const [data, setData] = useState<ReadData | null>(null);

  useEffect(() => {
    fetch(`/api/admin/announcements/${ann.id}/reads`).then(r => r.json()).then(setData);
  }, [ann.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-5 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-brand-text">Confirmaciones de lectura</h3>
            <p className="text-xs text-brand-muted mt-0.5 line-clamp-1">{ann.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-brand-muted"><X className="h-4 w-4" /></button>
        </div>

        {!data ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-4 overflow-y-auto min-h-0 flex-1">
            {/* Leyeron */}
            <div>
              <p className="text-[10px] font-bold uppercase text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Leyeron ({data.read.length})
              </p>
              {data.read.length === 0
                ? <p className="text-xs text-brand-muted">Nadie todavía.</p>
                : data.read.map(r => (
                  <div key={r.user_id} className="mb-2">
                    <p className="text-xs font-semibold text-brand-text truncate">{r.name}</p>
                    <p className="text-[10px] text-brand-muted">{new Date(r.read_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))
              }
            </div>
            {/* No leyeron */}
            <div>
              <p className="text-[10px] font-bold uppercase text-red-400 mb-2 flex items-center gap-1">
                <XCircle className="h-3 w-3" /> No leyeron ({data.unread.length})
              </p>
              {data.unread.length === 0
                ? <p className="text-xs text-emerald-400">¡Todos lo vieron!</p>
                : data.unread.map(r => (
                  <div key={r.user_id} className="mb-2">
                    <p className="text-xs font-semibold text-brand-text truncate">{r.name}</p>
                    <p className="text-[10px] text-brand-muted truncate">{r.email}</p>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminComunicadosPage() {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [readsFor, setReadsFor] = useState<Ann | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', body: '', type: 'comunicado', target: 'todos', deadline: '', is_pinned: false,
  });

  const load = useCallback(() => {
    fetch('/api/admin/announcements').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAnns(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    setCreateError('');
    try {
      const r = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deadline: form.deadline || null }),
      });
      const d = await r.json();
      if (!r.ok || !d.id) {
        setCreateError(d.error ?? `Error ${r.status} al publicar.`);
        setSaving(false);
        return;
      }
      setAnns(prev => [{ ...d, reads: 0, total_recipients: 0 }, ...prev]);
      setCreating(false);
      setCreateError('');
      setForm({ title: '', body: '', type: 'comunicado', target: 'todos', deadline: '', is_pinned: false });
    } catch (e: any) {
      setCreateError(e?.message ?? 'Error de red al publicar.');
    }
    setSaving(false);
  }

  async function toggle(id: string, field: 'is_pinned' | 'is_active', current: boolean) {
    await fetch(`/api/admin/announcements/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    });
    setAnns(prev => prev.map(a => a.id === id ? { ...a, [field]: !current } : a));
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar este comunicado?')) return;
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    setAnns(prev => prev.filter(a => a.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin</p>
          <h1 className="text-2xl font-bold text-brand-text mt-1">Comunicados</h1>
          <p className="text-sm text-brand-muted mt-0.5">Avisos, strikes, reuniones y formularios con confirmación de lectura.</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-brand-gold/90 transition shrink-0">
          <Plus className="h-4 w-4" /> Nuevo comunicado
        </button>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-text">Nuevo comunicado</h2>
              <button onClick={() => setCreating(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-brand-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Título *</label>
                <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
                  placeholder="Ej: Reunión de equipo — viernes 20hs"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
              </div>

              <div>
                <label className="text-xs text-brand-muted mb-1 block">Mensaje *</label>
                <textarea value={form.body} onChange={e => setForm(v => ({ ...v, body: e.target.value }))} rows={4}
                  placeholder="Escribí el contenido del comunicado..."
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Tipo</label>
                  <select value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111] px-3 py-2.5 text-sm text-brand-text focus:outline-none">
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Para quién</label>
                  <select value={form.target} onChange={e => setForm(v => ({ ...v, target: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111] px-3 py-2.5 text-sm text-brand-text focus:outline-none">
                    <option value="todos">Todos</option>
                    <option value="equipo">Equipo (setters)</option>
                    <option value="comunidad">Comunidad</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-brand-muted mb-1 block">Fecha límite (opcional)</label>
                <input type="datetime-local" value={form.deadline} onChange={e => setForm(v => ({ ...v, deadline: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(v => ({ ...v, is_pinned: e.target.checked }))} className="accent-brand-gold h-4 w-4" />
                <span className="text-sm text-brand-text">Fijar arriba (pinned)</span>
              </label>
            </div>

            {createError && (
              <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3">
                <p className="text-xs font-semibold text-red-400">{createError}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={create} disabled={!form.title.trim() || !form.body.trim() || saving}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 font-bold text-black text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publicar
              </button>
              <button onClick={() => { setCreating(false); setCreateError(''); }} className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-brand-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Reads modal */}
      {readsFor && <ReadsModal ann={readsFor} onClose={() => setReadsFor(null)} />}

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>
      ) : anns.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <Bell className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-text font-semibold">Sin comunicados publicados</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black">
            <Plus className="h-4 w-4" /> Crear primer comunicado
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {anns.map(a => {
            const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.comunicado;
            const isOpen = expanded === a.id;
            const pct = a.total_recipients > 0 ? Math.round((a.reads / a.total_recipients) * 100) : 0;
            return (
              <div key={a.id} className={`rounded-xl border bg-[#0d0d0d] overflow-hidden transition
                ${a.is_pinned ? 'border-brand-gold/20' : 'border-zinc-800'}
                ${!a.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3 px-4 py-3.5">
                  {/* Pin indicator */}
                  {a.is_pinned && <Pin className="h-3.5 w-3.5 text-brand-gold shrink-0 mt-0.5" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <TypeBadge type={a.type} />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${a.target === 'equipo' ? 'text-sky-400 border-sky-500/20' : a.target === 'comunidad' ? 'text-violet-400 border-violet-500/20' : 'text-zinc-400 border-zinc-700'}`}>
                        {TARGET_LABEL[a.target]}
                      </span>
                      {!a.is_active && <span className="text-[10px] text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded">Inactivo</span>}
                    </div>
                    <p className="text-sm font-semibold text-brand-text">{a.title}</p>
                    {a.deadline && <DeadlineDisplay deadline={a.deadline} />}
                    <p className="text-[10px] text-brand-muted mt-0.5">{new Date(a.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {/* Read count */}
                  <button onClick={() => setReadsFor(a)}
                    className="shrink-0 text-right hover:opacity-80 transition">
                    <p className={`text-sm font-black ${pct === 100 ? 'text-emerald-400' : pct > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {a.reads}/{a.total_recipients}
                    </p>
                    <p className="text-[10px] text-brand-muted">vieron</p>
                    <div className="h-1 w-16 rounded-full bg-zinc-800 mt-1">
                      <div className={`h-1 rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0 ml-1">
                    <button onClick={() => toggle(a.id, 'is_pinned', a.is_pinned)} title={a.is_pinned ? 'Desfijar' : 'Fijar'}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 transition text-brand-muted hover:text-brand-text">
                      {a.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => toggle(a.id, 'is_active', a.is_active)} title={a.is_active ? 'Desactivar' : 'Activar'}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 transition text-brand-muted hover:text-brand-text">
                      {a.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => del(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-900/20 transition text-brand-muted hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button onClick={() => setExpanded(isOpen ? null : a.id)} className="shrink-0 ml-1 text-brand-muted">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-800 px-4 py-3">
                    <p className="text-sm text-brand-text whitespace-pre-wrap leading-relaxed">{a.body}</p>
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
