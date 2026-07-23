'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Clock, Plus, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type Franja = {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activa: boolean;
};

type AddState = {
  dia: number;
  hora_inicio: string;
  hora_fin: string;
};

export default function DisponibilidadPage() {
  const [franjas, setFranjas]   = useState<Franja[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [adding, setAdding]     = useState<AddState | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/agenda/disponibilidad');
    if (res.ok) setFranjas(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startAdd(dia: number) {
    setError(null);
    setAdding({ dia, hora_inicio: '09:00', hora_fin: '12:00' });
  }

  function cancelAdd() {
    setAdding(null);
    setError(null);
  }

  async function guardar() {
    if (!adding) return;
    if (adding.hora_fin <= adding.hora_inicio) {
      setError('La hora fin debe ser posterior a la de inicio');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/agenda/disponibilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dia_semana: adding.dia,
        hora_inicio: adding.hora_inicio,
        hora_fin: adding.hora_fin,
      }),
    });
    if (res.ok) {
      setAdding(null);
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

  const porDia = DIAS.map((dia, idx) => ({
    label: dia,
    idx,
    franjas: franjas
      .filter(f => f.dia_semana === idx)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Agenda"
        title="Mi Disponibilidad"
        description="Configurá tus franjas horarias semanales. Los setters verán estos horarios al agendar reuniones."
      />

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-brand-muted">
          Zona horaria:{' '}
          <span className="font-medium text-brand-gold">America/Caracas (UTC-4)</span>
        </p>
        <p className="text-xs text-brand-muted">
          Podés agregar múltiples franjas por día
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-brand-muted">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {porDia.map(({ label, idx, franjas: fs }) => {
            const isAdding = adding?.dia === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] overflow-hidden"
              >
                {/* Cabecera del día */}
                <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.08)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-text">{label}</span>
                    {fs.length > 0 && (
                      <span className="rounded-full bg-[rgba(212,175,55,0.12)] px-2 py-0.5 text-[10px] font-semibold text-brand-gold">
                        {fs.length} franja{fs.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {!isAdding && (
                    <button
                      onClick={() => startAdd(idx)}
                      className="flex items-center gap-1 rounded-md border border-[rgba(212,175,55,0.2)] px-2.5 py-1 text-xs text-brand-muted hover:border-brand-gold/50 hover:text-brand-gold transition"
                    >
                      <Plus className="h-3 w-3" />
                      Agregar franja
                    </button>
                  )}
                </div>

                {/* Franjas existentes */}
                {fs.length > 0 && (
                  <div className="divide-y divide-[rgba(212,175,55,0.05)]">
                    {fs.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                        <Clock className={`h-3.5 w-3.5 shrink-0 ${f.activa ? 'text-brand-gold' : 'text-brand-muted'}`} />
                        <span className={`flex-1 text-sm font-mono font-medium tabular-nums ${f.activa ? 'text-brand-text' : 'text-brand-muted line-through opacity-50'}`}>
                          {f.hora_inicio} – {f.hora_fin}
                        </span>
                        <button
                          onClick={() => toggleActiva(f)}
                          title={f.activa ? 'Desactivar temporalmente' : 'Activar'}
                          className={`transition ${f.activa ? 'text-brand-gold hover:text-brand-muted' : 'text-brand-muted hover:text-brand-gold'}`}
                        >
                          {f.activa ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => eliminar(f.id)}
                          title="Eliminar"
                          className="text-brand-muted hover:text-red-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sin franjas + hint */}
                {fs.length === 0 && !isAdding && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-brand-muted">Sin horario — hacé click en Agregar franja</p>
                  </div>
                )}

                {/* Formulario inline */}
                {isAdding && adding && (
                  <div className="border-t border-[rgba(212,175,55,0.1)] bg-[#111] px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-brand-muted">
                          Hora inicio
                        </label>
                        <input
                          type="time"
                          value={adding.hora_inicio}
                          onChange={e => setAdding(a => a ? { ...a, hora_inicio: e.target.value } : a)}
                          className="w-36 rounded-md border border-[rgba(212,175,55,0.25)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text focus:border-brand-gold/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-brand-muted">
                          Hora fin
                        </label>
                        <input
                          type="time"
                          value={adding.hora_fin}
                          onChange={e => setAdding(a => a ? { ...a, hora_fin: e.target.value } : a)}
                          className="w-36 rounded-md border border-[rgba(212,175,55,0.25)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text focus:border-brand-gold/50 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2 pb-0.5">
                        <button
                          onClick={guardar}
                          disabled={saving}
                          className="flex items-center gap-1.5 rounded-md bg-brand-gold px-3 py-2 text-sm font-semibold text-black hover:bg-brand-gold/90 disabled:opacity-60 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {saving ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          onClick={cancelAdd}
                          className="flex items-center gap-1.5 rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-2 text-sm text-brand-muted hover:text-brand-text transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                    {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen — cómo te ven los setters */}
      {!loading && franjas.some(f => f.activa) && (
        <div className="mt-6 rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-brand-gold">
            Vista del setter al agendar
          </p>
          <div className="space-y-1.5">
            {porDia.map(({ label, idx, franjas: fs }) => {
              const activas = fs.filter(f => f.activa);
              if (activas.length === 0) return null;
              return (
                <div key={idx} className="flex items-start gap-3">
                  <span className="w-20 shrink-0 text-xs font-semibold text-brand-gold">{label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activas.map(f => (
                      <span
                        key={f.id}
                        className="rounded-full border border-[rgba(212,175,55,0.25)] bg-[#111] px-2.5 py-0.5 font-mono text-[11px] text-brand-text tabular-nums"
                      >
                        {f.hora_inicio} – {f.hora_fin}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
