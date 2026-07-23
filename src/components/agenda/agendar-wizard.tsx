'use client';

import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, User, Calendar, MessageSquare, CheckCircle } from 'lucide-react';
import { APP_TIMEZONE } from '@/constants/timezone';

type Closer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  closer_availability: { dia_semana: number; hora_inicio: string; hora_fin: string; activa: boolean }[];
};

type Slot = { inicio: string; fin: string };

type Props = {
  leadId?: string;
  teamLeadId?: string;
  leadName: string;
  onClose: () => void;
  onAgendado: () => void;
};

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a1a1a] text-sm font-bold text-brand-gold">
      {(name ?? '?')[0]?.toUpperCase()}
    </div>
  );
}

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function toCaracasDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

function formatSlot(iso: string) {
  return new Date(iso).toLocaleTimeString('es-VE', {
    timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit',
  });
}

function getDiaCaracas(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: APP_TIMEZONE }).format(d);
  const map: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return map[name] ?? 0;
}

export function AgendarWizard({ leadId, teamLeadId, leadName, onClose, onAgendado }: Props) {
  const [step, setStep]               = useState(1);
  const [closers, setClosers]         = useState<Closer[]>([]);
  const [closerSel, setCloserSel]     = useState<Closer | null>(null);
  const [calYear, setCalYear]         = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]       = useState(new Date().getMonth());
  const [diaSel, setDiaSel]           = useState<string | null>(null);
  const [slots, setSlots]             = useState<Slot[]>([]);
  const [slotSel, setSlotSel]         = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [conv, setConv]               = useState('');
  const [notas, setNotas]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agenda/closers').then(r => r.json()).then(d => setClosers(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!diaSel || !closerSel) return;
    setSlots([]);
    setSlotSel(null);
    setLoadingSlots(true);
    fetch(`/api/agenda/closers/${closerSel.id}/slots?fecha=${diaSel}`)
      .then(r => r.json())
      .then(d => setSlots(Array.isArray(d) ? d : []))
      .finally(() => setLoadingSlots(false));
  }, [diaSel, closerSel]);

  // Calendario mini
  const primerDia = new Date(calYear, calMonth, 1);
  const diasEnMes = new Date(calYear, calMonth + 1, 0).getDate();
  const inicioDow = primerDia.getDay();
  const celdas: (number | null)[] = [
    ...Array(inicioDow).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  // Días con disponibilidad del closer seleccionado
  const diasConDisponibilidad = new Set<number>(
    closerSel?.closer_availability
      .filter(f => f.activa)
      .map(f => f.dia_semana) ?? []
  );

  const HOY = toCaracasDate(new Date().toISOString());
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  function prevMes() { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }
  function nextMes() { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }

  async function confirmar() {
    if (!slotSel || !closerSel || !conv.trim()) {
      setErr('La conversación de WhatsApp es obligatoria');
      return;
    }
    setSubmitting(true);
    setErr(null);
    const res = await fetch('/api/agenda/reuniones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closer_id: closerSel.id,
        lead_id: leadId ?? undefined,
        team_lead_id: teamLeadId ?? undefined,
        inicio: slotSel.inicio,
        conversacion_whatsapp: conv.trim(),
        notas: notas.trim() || undefined,
      }),
    });
    if (res.ok) {
      onAgendado();
    } else {
      const d = await res.json();
      setErr(d.error ?? 'Error al agendar');
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#0a0a0a] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-5 py-4">
          <div>
            <p className="text-xs text-brand-muted">Agendar con closer</p>
            <h2 className="text-base font-bold text-brand-text">{leadName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1,2,3].map(s => (
                <div key={s} className={`h-1.5 w-5 rounded-full transition ${step >= s ? 'bg-brand-gold' : 'bg-[#222]'}`} />
              ))}
            </div>
            <button onClick={onClose} className="text-brand-muted hover:text-brand-text"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-5">
          {/* ── PASO 1: Elegir closer ─────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-brand-muted uppercase tracking-wide">
                Paso 1 — Elegir closer
              </h3>
              {closers.length === 0 ? (
                <p className="text-sm text-brand-muted">No hay closers con disponibilidad activa.</p>
              ) : (
                <div className="space-y-2">
                  {closers.map(c => {
                    const dias = [...new Set(
                      c.closer_availability.filter(f => f.activa).map(f => DIAS[f.dia_semana])
                    )].join(', ');
                    const sel = closerSel?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCloserSel(c)}
                        className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                          sel
                            ? 'border-brand-gold/50 bg-[rgba(212,175,55,0.08)]'
                            : 'border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] hover:border-[rgba(212,175,55,0.25)]'
                        }`}
                      >
                        <Avatar name={c.full_name} url={c.avatar_url} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-text">{c.full_name ?? 'Closer'}</p>
                          <p className="text-xs text-brand-muted truncate">Disponible: {dias || '—'}</p>
                        </div>
                        {sel && <CheckCircle className="h-4 w-4 text-brand-gold shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  disabled={!closerSel}
                  onClick={() => setStep(2)}
                  className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 2: Elegir día y slot ─────────────────────────────── */}
          {step === 2 && closerSel && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-brand-muted uppercase tracking-wide">
                Paso 2 — Elegir día y horario
              </h3>
              {/* Mini calendario */}
              <div className="mb-4 rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <button onClick={prevMes} className="text-brand-muted hover:text-brand-text"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-sm font-semibold text-brand-text">{MESES[calMonth]} {calYear}</span>
                  <button onClick={nextMes} className="text-brand-muted hover:text-brand-text"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {DIAS.map(d => <div key={d} className="py-1 text-center text-[10px] text-brand-muted font-semibold">{d}</div>)}
                  {celdas.map((dia, idx) => {
                    if (!dia) return <div key={idx} />;
                    const dk = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
                    const isPast = dk < HOY;
                    const dow = getDiaCaracas(dk);
                    const tieneDisp = diasConDisponibilidad.has(dow);
                    const sel = diaSel === dk;
                    return (
                      <button
                        key={idx}
                        disabled={isPast || !tieneDisp}
                        onClick={() => setDiaSel(dk)}
                        className={`rounded py-1 text-xs font-medium transition ${
                          sel
                            ? 'bg-brand-gold text-black'
                            : isPast || !tieneDisp
                              ? 'text-brand-muted/40 cursor-not-allowed'
                              : 'text-brand-text hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold'
                        } ${dk === HOY && !sel ? 'underline' : ''}`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slots */}
              {diaSel && (
                <div>
                  <p className="mb-2 text-xs text-brand-muted">Slots disponibles el {diaSel}</p>
                  {loadingSlots ? (
                    <p className="text-xs text-brand-muted">Cargando slots...</p>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-brand-muted">Sin slots disponibles ese día.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map(s => {
                        const sel = slotSel?.inicio === s.inicio;
                        return (
                          <button
                            key={s.inicio}
                            onClick={() => setSlotSel(s)}
                            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                              sel
                                ? 'border-brand-gold bg-[rgba(212,175,55,0.12)] text-brand-gold'
                                : 'border-[rgba(212,175,55,0.2)] text-brand-muted hover:border-brand-gold/40 hover:text-brand-text'
                            }`}
                          >
                            {formatSlot(s.inicio)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => { setStep(1); setDiaSel(null); setSlotSel(null); }}
                  className="text-sm text-brand-muted hover:text-brand-text">
                  ← Volver
                </button>
                <button
                  disabled={!slotSel}
                  onClick={() => setStep(3)}
                  className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 3: Contexto + confirmación ──────────────────────── */}
          {step === 3 && closerSel && slotSel && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-brand-muted uppercase tracking-wide">
                Paso 3 — Cargar contexto
              </h3>

              {/* Resumen */}
              <div className="mb-4 rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-4 py-3 space-y-1 text-sm">
                <div className="flex gap-2"><User className="h-4 w-4 text-brand-gold shrink-0" /><span className="text-brand-text">{leadName}</span></div>
                <div className="flex gap-2"><User className="h-4 w-4 text-brand-gold shrink-0" /><span className="text-brand-muted">Closer:</span><span className="text-brand-text">{closerSel.full_name}</span></div>
                <div className="flex gap-2"><Calendar className="h-4 w-4 text-brand-gold shrink-0" />
                  <span className="text-brand-text">
                    {new Date(slotSel.inicio).toLocaleString('es-VE', {
                      timeZone: APP_TIMEZONE, weekday: 'long',
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Conversación WhatsApp — OBLIGATORIA */}
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="h-3.5 w-3.5 text-brand-gold" />
                  <label className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    Conversación WhatsApp <span className="text-red-400">*</span>
                  </label>
                </div>
                <textarea
                  value={conv}
                  onChange={e => setConv(e.target.value)}
                  rows={5}
                  placeholder="Pegá acá la conversación de WhatsApp que tuviste con el lead..."
                  className="w-full rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#111] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted font-mono resize-none focus:outline-none focus:border-brand-gold/50"
                />
              </div>

              {/* Notas extra — opcional */}
              <div className="mb-4">
                <label className="mb-1 block text-xs text-brand-muted">Notas extra (opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Contexto adicional para el closer..."
                  className="w-full rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#111] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted resize-none focus:outline-none focus:border-brand-gold/50"
                />
              </div>

              {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

              <div className="flex items-center justify-between">
                <button onClick={() => setStep(2)} className="text-sm text-brand-muted hover:text-brand-text">← Volver</button>
                <button
                  disabled={submitting || !conv.trim()}
                  onClick={confirmar}
                  className="flex items-center gap-2 rounded-md bg-brand-gold px-5 py-2 text-sm font-bold text-black disabled:opacity-40 hover:bg-brand-gold/90 transition"
                >
                  {submitting ? 'Agendando...' : '✓ Confirmar reunión'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
