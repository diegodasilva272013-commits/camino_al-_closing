'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Clock, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type Franja = {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activa: boolean;
};

export default function DisponibilidadPage() {
  const [franjas, setFranjas]     = useState<Franja[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState({ dia_semana: 1, hora_inicio: '09:00', hora_fin: '12:00' });
  const [showForm, setShowForm]   = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/agenda/disponibilidad');
    if (res.ok) setFranjas(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function agregarFranja() {
    if (form.hora_fin <= form.hora_inicio) {
      setError('La hora de fin debe ser posterior a la de inicio');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/agenda/disponibilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      await load();
    } else {
      const d = await res.json();
      setError(d.error ?? 'Error al guardar');
    }
    setSaving(false);
  }

  async function toggleActiva(f: Franja) {
    await fetch(`/api/agenda/disponibilidad/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activa: !f.activa }),
    });
    await load();
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta franja?')) return;
    await fetch(`/api/agenda/disponibilidad/${id}`, { method: 'DELETE' });
    await load();
  }

  // Agrupar por día
  const porDia = DIAS.map((dia, idx) => ({
    dia,
    idx,
    franjas: franjas.filter(f => f.dia_semana === idx),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Agenda"
        title="Mi Disponibilidad"
        description="Configurá tus franjas horarias semanales. Los setters verán estos horarios al agendar reuniones."
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-brand-muted">
          Zona horaria: <span className="text-brand-gold font-medium">America/Caracas (UTC-4)</span>
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-md bg-brand-gold px-3 py-1.5 text-sm font-medium text-black hover:bg-brand-gold/90 transition"
        >
          <Plus className="h-4 w-4" />
          Agregar franja
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-[rgba(212,175,55,0.25)] bg-[#111] p-4">
          <h3 className="mb-3 text-sm font-semibold text-brand-text">Nueva franja horaria</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-brand-muted">Día</label>
              <select
                value={form.dia_semana}
                onChange={e => setForm(f => ({ ...f, dia_semana: Number(e.target.value) }))}
                className="w-full rounded border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-sm text-brand-text"
              >
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-muted">Hora inicio</label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                className="w-full rounded border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-sm text-brand-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-muted">Hora fin</label>
              <input
                type="time"
                value={form.hora_fin}
                onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                className="w-full rounded border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-sm text-brand-text"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={agregarFranja}
              disabled={saving}
              className="rounded-md bg-brand-gold px-3 py-1.5 text-sm font-medium text-black disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-sm text-brand-muted hover:text-brand-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-brand-muted">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {porDia.map(({ dia, idx, franjas: fs }) => (
            <div key={idx} className="rounded-lg border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
              <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.08)] px-4 py-2.5">
                <span className="text-sm font-semibold text-brand-text">{dia}</span>
                <span className="text-xs text-brand-muted">{fs.length === 0 ? 'Sin horario' : `${fs.length} franja${fs.length > 1 ? 's' : ''}`}</span>
              </div>
              {fs.length > 0 && (
                <div className="divide-y divide-[rgba(212,175,55,0.05)]">
                  {fs.map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Clock className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <span className={`flex-1 text-sm font-medium ${f.activa ? 'text-brand-text' : 'text-brand-muted line-through'}`}>
                        {f.hora_inicio} – {f.hora_fin}
                      </span>
                      <button onClick={() => toggleActiva(f)} title={f.activa ? 'Desactivar' : 'Activar'}
                        className="text-brand-muted hover:text-brand-text transition">
                        {f.activa ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => eliminar(f.id)} title="Eliminar"
                        className="text-brand-muted hover:text-red-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview de cómo te ven los setters */}
      {!loading && franjas.some(f => f.activa) && (
        <div className="mt-6 rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-gold">
            Así te ven los setters
          </p>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((dia, i) => {
              const activas = franjas.filter(f => f.dia_semana === i && f.activa);
              if (activas.length === 0) return null;
              return (
                <div key={i} className="rounded border border-[rgba(212,175,55,0.2)] bg-[#111] px-3 py-1.5 text-xs">
                  <span className="font-semibold text-brand-gold">{dia.slice(0,3)}</span>{' '}
                  {activas.map(f => `${f.hora_inicio}–${f.hora_fin}`).join(', ')}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
