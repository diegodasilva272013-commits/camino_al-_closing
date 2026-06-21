'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Users2, ToggleLeft, ToggleRight, Loader2, Trash2, Edit3, Eye } from 'lucide-react';

type Form = {
  id: string; title: string; description: string | null; topic: string | null;
  is_active: boolean; created_at: string;
  reinforcement_questions: { count: number }[];
  reinforcement_submissions: { count: number }[];
};

export default function AdminFormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetch('/api/admin/forms').then(r => r.json()).then(d => { if (Array.isArray(d)) setForms(d); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!newTitle.trim()) return;
    setSaving(true);
    const r = await fetch('/api/admin/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, description: newDesc, topic: newTopic }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.id) router.push(`/admin/forms/${d.id}`);
  }

  async function toggle(id: string, current: boolean) {
    await fetch(`/api/admin/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    });
    setForms(prev => prev.map(f => f.id === id ? { ...f, is_active: !current } : f));
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar este formulario y todas sus respuestas?')) return;
    await fetch(`/api/admin/forms/${id}`, { method: 'DELETE' });
    setForms(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin</p>
          <h1 className="text-2xl font-bold text-brand-text mt-1">Formularios de refuerzo</h1>
          <p className="text-sm text-brand-muted mt-0.5">Creá formularios por clase o tema. Cada respuesta es analizada por el Motor CAC.</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-brand-gold/90 transition shrink-0">
          <Plus className="h-4 w-4" /> Nuevo formulario
        </button>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-6 space-y-4">
            <h2 className="text-lg font-bold text-brand-text">Nuevo formulario</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Título *</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej: Conexión Genuina y Cerebro Predictivo"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Descripción</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="Para qué sirve este formulario..."
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30 resize-none" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Tema / Clase asociada</label>
                <input value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="Ej: Módulo 2 — Clase 3"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={create} disabled={!newTitle.trim() || saving}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 font-bold text-black text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Crear y editar
              </button>
              <button onClick={() => setCreating(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-brand-muted hover:text-brand-text">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>
      ) : !forms.length ? (
        <div className="flex flex-col items-center py-20 text-center gap-4">
          <FileText className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-text font-semibold">Todavía no hay formularios</p>
          <p className="text-sm text-brand-muted">Creá el primero — el sistema de &ldquo;Conexión Genuina&rdquo; ya está listo para cargar.</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black">
            <Plus className="h-4 w-4" /> Crear primer formulario
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map(f => {
            const qCount = f.reinforcement_questions?.[0]?.count ?? 0;
            const sCount = f.reinforcement_submissions?.[0]?.count ?? 0;
            return (
              <div key={f.id} className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${f.is_active ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/20' : 'text-zinc-500 border-zinc-700 bg-zinc-800/40'}`}>
                        {f.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      {f.topic && <span className="text-[10px] text-brand-muted">{f.topic}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-brand-text">{f.title}</h3>
                    {f.description && <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">{f.description}</p>}
                    <div className="flex gap-3 mt-2 text-[11px] text-brand-muted">
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{qCount} preguntas</span>
                      <span className="flex items-center gap-1"><Users2 className="h-3 w-3" />{sCount} respuestas</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggle(f.id, f.is_active)} title={f.is_active ? 'Desactivar' : 'Activar'}
                      className="p-2 rounded-lg hover:bg-zinc-800 transition text-brand-muted hover:text-brand-text">
                      {f.is_active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => router.push(`/admin/forms/${f.id}`)} title="Editar"
                      className="p-2 rounded-lg hover:bg-zinc-800 transition text-brand-muted hover:text-brand-text">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => del(f.id)} title="Eliminar"
                      className="p-2 rounded-lg hover:bg-red-900/20 transition text-brand-muted hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
