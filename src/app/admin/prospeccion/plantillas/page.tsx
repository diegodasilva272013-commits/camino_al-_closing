'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Loader2, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Template = { id: string; title: string; category: string; body: string; tone: string; is_active: boolean; created_at: string };

const CATEGORIES = ['apertura', 'seguimiento', 'reactivacion', 'cierre', 'general'];
const TONES      = ['humano', 'directo', 'curioso', 'profesional', 'calido'];
const CAT_LABELS: Record<string, string> = { apertura: 'Apertura', seguimiento: 'Seguimiento', reactivacion: 'Reactivación', cierre: 'Cierre', general: 'General' };
const TONE_COLORS: Record<string, string> = { directo: 'text-sky-400', humano: 'text-emerald-400', curioso: 'text-yellow-400', profesional: 'text-violet-400', calido: 'text-rose-400' };

const EMPTY_FORM = { title: '', category: 'apertura', body: '', tone: 'humano' };

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/message-templates');
      const d = await r.json();
      if (Array.isArray(d)) setTemplates(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.title.trim() || !form.body.trim()) { setError('Título y cuerpo son requeridos'); return; }
    setSaving(true); setError('');
    try {
      const url = editing ? `/api/admin/message-templates/${editing.id}` : '/api/admin/message-templates';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Error'); return; }
      await load();
      setCreating(false); setEditing(null); setForm(EMPTY_FORM);
    } catch { setError('Error de red'); }
    setSaving(false);
  }

  async function toggleActive(t: Template) {
    await fetch(`/api/admin/message-templates/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !t.is_active }) });
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) return;
    await fetch(`/api/admin/message-templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  function openEdit(t: Template) {
    setEditing(t); setForm({ title: t.title, category: t.category, body: t.body, tone: t.tone }); setCreating(true); setError('');
  }

  function cancel() { setCreating(false); setEditing(null); setForm(EMPTY_FORM); setError(''); }

  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Prospección</p>
          <h1 className="text-2xl font-bold text-brand-text mt-1">Plantillas de mensajes</h1>
          <p className="text-sm text-brand-muted mt-0.5">Mensajes aprobados con variables {'{nombre}'} {'{pais}'} {'{setter_nombre}'}.</p>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-brand-gold/90 transition shrink-0">
          <Plus className="h-4 w-4" /> Nueva plantilla
        </button>
      </div>

      {/* Form modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-text">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
              <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-zinc-800 text-brand-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Título *</label>
                <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
                  placeholder="Ej: Apertura en frío — curiosidad" className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Categoría</label>
                  <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-[#111] px-3 py-2.5 text-sm text-brand-text focus:outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Tono</label>
                  <select value={form.tone} onChange={e => setForm(v => ({ ...v, tone: e.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-[#111] px-3 py-2.5 text-sm text-brand-text focus:outline-none">
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-brand-muted mb-1 block">Cuerpo del mensaje *</label>
                <textarea value={form.body} onChange={e => setForm(v => ({ ...v, body: e.target.value }))} rows={6}
                  placeholder={`Hola {nombre}! Vi que sos de {pais}...`}
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30 resize-none" />
                <p className="text-[10px] text-brand-muted mt-1">Variables disponibles: {'{nombre}'} {'{pais}'} {'{setter_nombre}'} {'{interes}'}</p>
              </div>

              {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={!form.title.trim() || !form.body.trim() || saving}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 font-bold text-black text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
              <button onClick={cancel} className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-brand-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0d0d0d] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-brand-text">Vista previa</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-brand-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/25 px-4 py-3">
              <p className="text-sm text-emerald-100 whitespace-pre-wrap leading-relaxed">{preview}</p>
            </div>
            <p className="text-[10px] text-brand-muted mt-2">Con datos de ejemplo: nombre=María, país=Argentina, setter=Diego</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <p className="text-brand-muted">Sin plantillas todavía.</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black"><Plus className="h-4 w-4" /> Crear primera plantilla</button>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.filter(c => grouped[c]?.length > 0).map(cat => (
            <div key={cat}>
              <p className="text-[10px] uppercase tracking-widest text-brand-gold/60 mb-2">{CAT_LABELS[cat]}</p>
              <div className="space-y-2">
                {(grouped[cat] ?? []).map(t => (
                  <div key={t.id} className={cn('rounded-xl border bg-[#0d0d0d] overflow-hidden transition', t.is_active ? 'border-zinc-800' : 'border-zinc-800 opacity-50')}>
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn('text-[10px] font-bold uppercase', TONE_COLORS[t.tone] ?? 'text-zinc-400')}>{t.tone}</span>
                          {!t.is_active && <span className="text-[10px] text-zinc-500 border border-zinc-700 px-1.5 rounded">Inactiva</span>}
                        </div>
                        <p className="text-sm font-semibold text-brand-text">{t.title}</p>
                        <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">{t.body}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => {
                          const preview = t.body.replace(/\{nombre\}/gi, 'María').replace(/\{pais\}/gi, 'Argentina').replace(/\{setter_nombre\}/gi, 'Diego').replace(/\{interes\}/gi, '');
                          setPreview(preview);
                        }} className="p-1.5 rounded-lg hover:bg-zinc-800 transition text-brand-muted" title="Vista previa"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition text-brand-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => toggleActive(t)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition text-brand-muted" title={t.is_active ? 'Desactivar' : 'Activar'}>
                          {t.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => del(t.id)} className="p-1.5 rounded-lg hover:bg-red-900/20 transition text-brand-muted hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
