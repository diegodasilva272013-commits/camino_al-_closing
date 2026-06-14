'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type Opening = {
  id: string;
  name: string;
  message: string;
  is_active: boolean;
  created_at: string;
};

export default function AperturasPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/opening-messages');
    const data = await res.json();
    setOpenings(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name.trim() || !form.message.trim()) {
      setError('Nombre y mensaje son requeridos.');
      return;
    }
    setSaving(true);
    setError('');
    if (editId) {
      const res = await fetch(`/api/opening-messages/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Error al guardar.');
      } else {
        await load();
        setEditId(null);
        setForm({ name: '', message: '' });
      }
    } else {
      const res = await fetch('/api/opening-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, is_active: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Error al crear.');
      } else {
        await load();
        setCreating(false);
        setForm({ name: '', message: '' });
      }
    }
    setSaving(false);
  }

  async function toggle(o: Opening) {
    await fetch(`/api/opening-messages/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !o.is_active }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    await fetch(`/api/opening-messages/${id}`, { method: 'DELETE' });
    await load();
  }

  function startEdit(o: Opening) {
    setEditId(o.id);
    setForm({ name: o.name, message: o.message });
    setCreating(false);
    setError('');
  }

  const activeCount = openings.filter((o) => o.is_active).length;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        title="Mensajes de Apertura"
        description={`${activeCount}/5 activos`}
        icon={<MessageCircle className="h-5 w-5 text-brand-gold" />}
      />

      <div className="mt-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-muted">
            Tus mensajes de apertura para seleccionar al contactar leads.
          </p>
          {!creating && !editId && (
            <button
              onClick={() => { setCreating(true); setEditId(null); setForm({ name: '', message: '' }); setError(''); }}
              disabled={activeCount >= 5}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition',
                activeCount >= 5
                  ? 'border-zinc-700 text-zinc-600 cursor-not-allowed'
                  : 'border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10'
              )}
            >
              <Plus className="h-4 w-4" />
              Nueva apertura
            </button>
          )}
        </div>

        {/* Form */}
        {(creating || editId) && (
          <div className="mt-4 rounded-xl border border-brand-gold/20 bg-[#0d0d0d] p-5">
            <h3 className="mb-4 text-sm font-semibold text-brand-text">
              {editId ? 'Editar apertura' : 'Nueva apertura'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Nombre del mensaje</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Apertura directa, Apertura con contexto..."
                  className="w-full rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#111] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Texto del mensaje</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder="Hola [nombre], vi tu perfil y me interesó..."
                  className="w-full rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#111] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-gold/40 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-brand-gold/20 border border-brand-gold/30 px-4 py-2 text-sm text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setCreating(false); setEditId(null); setForm({ name: '', message: '' }); setError(''); }}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-brand-muted hover:text-brand-text transition"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : openings.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <MessageCircle className="h-12 w-12 text-brand-gold/20" />
            <p className="text-brand-muted">No tenés aperturas creadas todavía.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {openings.map((o) => (
              <div
                key={o.id}
                className={cn(
                  'rounded-xl border p-4 transition',
                  o.is_active
                    ? 'border-[rgba(212,175,55,0.18)] bg-[#0d0d0d]'
                    : 'border-zinc-800/60 bg-[#0a0a0a] opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-brand-text">{o.name}</h4>
                      {o.is_active && (
                        <span className="rounded-full bg-green-900/40 border border-green-700/40 px-2 py-0.5 text-[10px] text-green-300">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-brand-muted/80 whitespace-pre-wrap leading-relaxed">
                      {o.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggle(o)}
                      title={o.is_active ? 'Desactivar' : 'Activar'}
                      className="rounded p-1.5 text-brand-muted hover:text-brand-gold transition"
                    >
                      {o.is_active
                        ? <ToggleRight className="h-4 w-4 text-brand-gold" />
                        : <ToggleLeft className="h-4 w-4" />
                      }
                    </button>
                    <button
                      onClick={() => startEdit(o)}
                      className="rounded p-1.5 text-brand-muted hover:text-brand-gold transition"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(o.id)}
                      className="rounded p-1.5 text-brand-muted hover:text-red-400 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
