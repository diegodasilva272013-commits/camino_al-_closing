'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, X, Loader2, Play, Pause, BarChart2, Users, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Campaign = {
  id: string; name: string; description: string | null; channel: string; status: string;
  total_leads: number; sent_count: number; delivered_count: number; replied_count: number; failed_count: number;
  created_at: string; starts_at: string | null;
  message_templates: { id: string; title: string } | null;
  evolution_instances: { id: string; name: string; status: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Borrador',   color: 'text-zinc-400',    bg: 'bg-zinc-800' },
  active:    { label: 'Activa',     color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
  paused:    { label: 'Pausada',    color: 'text-yellow-400',  bg: 'bg-yellow-900/20' },
  completed: { label: 'Completada', color: 'text-sky-400',     bg: 'bg-sky-900/20' },
  cancelled: { label: 'Cancelada',  color: 'text-red-400',     bg: 'bg-red-900/20' },
};

const CHANNEL_LABELS: Record<string, string> = {
  manual: 'Manual (WhatsApp directo)', evolution: 'Evolution API', meta: 'Meta oficial',
};

const EMPTY_FORM = { name: '', description: '', channel: 'manual', template_id: '', send_rules: '{"max_per_hour":80,"pause_seconds":30}' };

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/campaigns');
      const d = await r.json();
      if (Array.isArray(d)) setCampaigns(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          channel: form.channel,
          template_id: form.template_id || null,
          send_rules: JSON.parse(form.send_rules),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Error'); return; }
      setCreating(false); setForm(EMPTY_FORM);
      await load();
    } catch { setError('Error de red'); }
    setSaving(false);
  }

  async function toggleStatus(c: Campaign) {
    const newStatus = c.status === 'active' ? 'paused' : c.status === 'paused' ? 'active' : null;
    if (!newStatus) return;
    await fetch(`/api/admin/campaigns/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
  }

  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    totalLeads: campaigns.reduce((s, c) => s + (c.total_leads ?? 0), 0),
    totalSent: campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0),
    totalReplied: campaigns.reduce((s, c) => s + (c.replied_count ?? 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Sistema CAC</p>
          <h1 className="text-2xl font-bold text-brand-text mt-1">Campañas</h1>
          <p className="text-sm text-brand-muted mt-0.5">Segmentá leads, elegí canal y controlá envíos en tiempo real.</p>
        </div>
        <button onClick={() => { setCreating(true); setError(''); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-brand-gold/90 transition shrink-0">
          <Plus className="h-4 w-4" /> Nueva campaña
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Campañas activas', value: stats.active, icon: Play },
          { label: 'Leads en campañas', value: stats.totalLeads.toLocaleString('es-AR'), icon: Users },
          { label: 'Mensajes enviados', value: stats.totalSent.toLocaleString('es-AR'), icon: MessageSquare },
          { label: 'Respuestas', value: stats.totalSent > 0 ? `${Math.round((stats.totalReplied / stats.totalSent) * 100)}%` : '—', icon: BarChart2 },
        ].map(s => (
          <div key={s.label} className="card-premium">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="h-3.5 w-3.5 text-brand-gold" />
              <p className="text-[10px] uppercase tracking-widest text-brand-gold/70">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-brand-text">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <BarChart2 className="h-10 w-10 text-zinc-700" />
          <p className="text-zinc-500">Sin campañas todavía.</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black">
            <Plus className="h-4 w-4" /> Crear primera campaña
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['draft'];
            const replyRate = c.sent_count > 0 ? Math.round((c.replied_count / c.sent_count) * 100) : null;
            return (
              <div key={c.id} className="rounded-2xl border border-zinc-800/60 bg-[#0d0d0d] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg', cfg.color, cfg.bg)}>{cfg.label}</span>
                      <span className="text-[10px] text-zinc-500 capitalize">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                    </div>
                    <h3 className="text-base font-semibold text-brand-text">{c.name}</h3>
                    {c.description && <p className="text-xs text-zinc-500 mt-0.5">{c.description}</p>}

                    <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                      <span className="text-xs text-zinc-400"><span className="font-bold text-brand-text">{c.total_leads}</span> leads</span>
                      <span className="text-xs text-zinc-400"><span className="font-bold text-emerald-400">{c.sent_count}</span> enviados</span>
                      {c.replied_count > 0 && <span className="text-xs text-zinc-400"><span className="font-bold text-sky-400">{c.replied_count}</span> respondieron {replyRate !== null ? `(${replyRate}%)` : ''}</span>}
                      {c.failed_count > 0 && <span className="text-xs text-zinc-400"><span className="font-bold text-red-400">{c.failed_count}</span> fallidos</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(c.status === 'active' || c.status === 'paused') && (
                      <button onClick={() => toggleStatus(c)}
                        className={cn('p-2 rounded-xl border transition',
                          c.status === 'active' ? 'border-yellow-500/25 text-yellow-400 hover:bg-yellow-500/10' : 'border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10')}>
                        {c.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                    <Link href={`/admin/campanas/${c.id}`}
                      className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition">
                      Ver detalle
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0d0d0d] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-text">Nueva campaña</h2>
              <button onClick={() => setCreating(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Nombre *</label>
                <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                  placeholder="Ej: Apertura Argentina — Junio"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Descripción</label>
                <input value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Canal de envío</label>
                <select value={form.channel} onChange={e => setForm(v => ({ ...v, channel: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-3 py-2.5 text-sm text-brand-text focus:outline-none">
                  <option value="manual">Manual (WhatsApp directo + registro)</option>
                  <option value="evolution">Evolution API (envío automático)</option>
                  <option value="meta">Meta oficial (próximamente)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Reglas de envío (JSON)</label>
                <input value={form.send_rules} onChange={e => setForm(v => ({ ...v, send_rules: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-xs text-zinc-400 font-mono focus:outline-none" />
                <p className="text-[10px] text-zinc-600 mt-0.5">max_per_hour · pause_seconds · auto_stop_fail_rate (0-1)</p>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={!form.name.trim() || saving}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 font-bold text-black text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear campaña
              </button>
              <button onClick={() => setCreating(false)} className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
