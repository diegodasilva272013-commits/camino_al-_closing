'use client';

import { useEffect, useState } from 'react';

type Objetivo = {
  id:                   string;
  nombre:               string;
  nombre_display:       string;
  definicion:           string;
  meta_2030:            string;
  criterios_evaluacion: string;
  peso_relativo:        number;
  nivel_actual:         number | null;
  activo:               boolean;
  orden:                number;
};

type EditState = Partial<Objetivo>;

export default function ConfigPage() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [editing, setEditing]     = useState<Record<string, EditState>>({});
  const [saving, setSaving]       = useState<Record<string, boolean>>({});
  const [showNew, setShowNew]     = useState(false);
  const [newObj, setNewObj]       = useState<Partial<Objetivo>>({});
  const [creando, setCreando]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/d2030/objetivos');
      if (!r.ok) { const d = await r.json(); setError(d.error); return; }
      const d = await r.json();
      setObjetivos(d.objetivos ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(obj: Objetivo) {
    setEditing(prev => ({
      ...prev,
      [obj.id]: {
        nombre_display:       obj.nombre_display,
        definicion:           obj.definicion,
        meta_2030:            obj.meta_2030,
        criterios_evaluacion: obj.criterios_evaluacion,
        peso_relativo:        obj.peso_relativo,
        activo:               obj.activo,
      }
    }));
  }

  function cancelEdit(id: string) {
    setEditing(prev => { const n = {...prev}; delete n[id]; return n; });
  }

  async function saveEdit(id: string) {
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      const r = await fetch(`/api/d2030/objetivos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing[id]),
      });
      if (!r.ok) { const d = await r.json(); alert(d.error); return; }
      setEditing(prev => { const n = {...prev}; delete n[id]; return n; });
      await load();
    } finally {
      setSaving(prev => { const n = {...prev}; delete n[id]; return n; });
    }
  }

  async function toggleActivo(obj: Objetivo) {
    await fetch(`/api/d2030/objetivos/${obj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !obj.activo }),
    });
    await load();
  }

  async function crear() {
    if (!newObj.nombre_display?.trim() || !newObj.definicion?.trim() || !newObj.meta_2030?.trim() || !newObj.criterios_evaluacion?.trim()) {
      alert('Todos los campos son requeridos');
      return;
    }
    setCreando(true);
    try {
      const r = await fetch('/api/d2030/objetivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:               (newObj.nombre_display ?? '').toLowerCase().replace(/\s+/g, '_'),
          nombre_display:       newObj.nombre_display,
          definicion:           newObj.definicion,
          meta_2030:            newObj.meta_2030,
          criterios_evaluacion: newObj.criterios_evaluacion,
          orden:                objetivos.length + 1,
        }),
      });
      if (!r.ok) { const d = await r.json(); alert(d.error); return; }
      setShowNew(false);
      setNewObj({});
      await load();
    } finally {
      setCreando(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 px-4">
      <p className="text-red-400 text-sm">{error}</p>
      <p className="text-zinc-600 text-xs">¿Corriste la migración 0029 en Supabase?</p>
      <button onClick={load} className="text-xs border border-zinc-700 text-zinc-400 hover:text-white px-4 py-2 rounded-lg">Reintentar</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/admin/evolucion" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Diego 2030</a>
            <h1 className="text-xl font-bold text-white mt-2 tracking-tight">Objetivos de Crecimiento 2030</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Estas definiciones son el prompt del sistema. Lo que cambiás acá cambia cómo la IA te analiza.
            </p>
          </div>
        </div>

        {/* Lista de objetivos */}
        <div className="space-y-3">
          {objetivos.map((obj, i) => {
            const isEditing = !!editing[obj.id];
            const ed        = editing[obj.id] ?? {};
            const isSaving  = saving[obj.id];

            return (
              <div key={obj.id} className={`bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${
                obj.activo ? 'border-zinc-800' : 'border-zinc-800/40 opacity-50'
              }`}>
                {/* Header del objetivo */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-zinc-600 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-zinc-500"
                        value={ed.nombre_display ?? ''}
                        onChange={e => setEditing(prev => ({ ...prev, [obj.id]: { ...prev[obj.id], nombre_display: e.target.value } }))}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-zinc-100">{obj.nombre_display}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {obj.nivel_actual != null && (
                      <span className="text-xs text-zinc-500">{obj.nivel_actual}/10</span>
                    )}
                    <button
                      onClick={() => toggleActivo(obj)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        obj.activo
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {obj.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    {!isEditing ? (
                      <button
                        onClick={() => startEdit(obj)}
                        className="text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 px-3 py-1 rounded-lg transition-colors"
                      >
                        Editar
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(obj.id)}
                          disabled={isSaving}
                          className="text-xs bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 px-3 py-1 rounded-lg font-medium transition-colors"
                        >
                          {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => cancelEdit(obj.id)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cuerpo editable */}
                {isEditing ? (
                  <div className="px-4 pb-4 border-t border-zinc-800 space-y-3 pt-3">
                    <Field
                      label="Definición — qué significa esta capacidad"
                      value={ed.definicion ?? ''}
                      rows={2}
                      onChange={v => setEditing(prev => ({ ...prev, [obj.id]: { ...prev[obj.id], definicion: v } }))}
                    />
                    <Field
                      label="Meta 2030 — cómo se ve dominar esto"
                      value={ed.meta_2030 ?? ''}
                      rows={2}
                      onChange={v => setEditing(prev => ({ ...prev, [obj.id]: { ...prev[obj.id], meta_2030: v } }))}
                    />
                    <Field
                      label="Criterios de evaluación — qué busca la IA al analizar"
                      value={ed.criterios_evaluacion ?? ''}
                      rows={3}
                      onChange={v => setEditing(prev => ({ ...prev, [obj.id]: { ...prev[obj.id], criterios_evaluacion: v } }))}
                    />
                  </div>
                ) : (
                  <div className="px-4 pb-3 border-t border-zinc-800/50 space-y-1.5 pt-2.5">
                    <p className="text-xs text-zinc-400 leading-relaxed">{obj.definicion}</p>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      <span className="text-zinc-500">Meta: </span>{obj.meta_2030}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nueva capacidad */}
        {!showNew ? (
          <button
            onClick={() => setShowNew(true)}
            className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          >
            + Agregar capacidad
          </button>
        ) : (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
            <h3 className="text-xs text-zinc-400 uppercase tracking-wider">Nueva capacidad</h3>
            <Field
              label="Nombre *"
              value={newObj.nombre_display ?? ''}
              rows={1}
              onChange={v => setNewObj(p => ({ ...p, nombre_display: v }))}
            />
            <Field
              label="Definición *"
              value={newObj.definicion ?? ''}
              rows={2}
              onChange={v => setNewObj(p => ({ ...p, definicion: v }))}
            />
            <Field
              label="Meta 2030 *"
              value={newObj.meta_2030 ?? ''}
              rows={2}
              onChange={v => setNewObj(p => ({ ...p, meta_2030: v }))}
            />
            <Field
              label="Criterios de evaluación *"
              value={newObj.criterios_evaluacion ?? ''}
              rows={3}
              onChange={v => setNewObj(p => ({ ...p, criterios_evaluacion: v }))}
            />
            <div className="flex gap-3">
              <button
                onClick={crear}
                disabled={creando}
                className="bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                {creando ? 'Creando...' : 'Crear capacidad'}
              </button>
              <button
                onClick={() => { setShowNew(false); setNewObj({}); }}
                className="text-zinc-500 hover:text-zinc-300 px-4 py-2 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Nota */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-600 leading-relaxed">
            Cada cambio que guardes acá modifica el prompt de análisis. La próxima grabación que subas
            ya usa los criterios actualizados. Las grabaciones anteriores NO se re-analizan automáticamente.
          </p>
        </div>

      </div>
    </div>
  );
}

function Field({ label, value, rows, onChange }: {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      {rows === 1 ? (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      ) : (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-y"
        />
      )}
    </div>
  );
}
