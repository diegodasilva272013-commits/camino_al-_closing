'use client';

import { useState } from 'react';
import { X, User, Phone, Calendar, Clock, MessageSquare, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { APP_TIMEZONE } from '@/constants/timezone';

type ReunionFull = {
  id: string;
  inicio: string;
  duracion_min: number;
  estado: string;
  conversacion_whatsapp: string;
  notas: string | null;
  resultado: string | null;
  closer_id: string;
  setter_id: string;
  lead_id: string | null;
  team_lead_id: string | null;
  estado_lead_anterior: string | null;
  closer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  setter: { id: string; full_name: string | null; avatar_url: string | null } | null;
  lead: { id: string; first_name: string; last_name: string | null; phone: string; current_status: string } | null;
  team_lead: { id: string; first_name: string; last_name: string | null; phone: string; current_status: string } | null;
};

type Props = {
  reunion: ReunionFull;
  onClose: () => void;
  onUpdated: () => void;
  currentUserId?: string;
  currentRole?: string;
};

const ESTADO_COLORS: Record<string, string> = {
  agendada:     'text-[#d4af37] bg-[rgba(212,175,55,0.12)] border-[rgba(212,175,55,0.3)]',
  reprogramada: 'text-amber-300 bg-amber-900/20 border-amber-700/30',
  completada:   'text-green-300 bg-green-900/20 border-green-700/30',
  no_show:      'text-red-300 bg-red-900/20 border-red-700/30',
  cancelada:    'text-zinc-500 bg-zinc-800/40 border-zinc-700/30',
};

const ESTADO_LABELS: Record<string, string> = {
  agendada: 'Agendada', reprogramada: 'Reprogramada',
  completada: 'Completada', no_show: 'No Show', cancelada: 'Cancelada',
};

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt="" className="h-7 w-7 rounded-full object-cover" />;
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1a1a] text-xs font-semibold text-brand-gold">
      {(name ?? '?')[0]?.toUpperCase()}
    </div>
  );
}

export function ReunionModal({ reunion, onClose, onUpdated, currentUserId, currentRole }: Props) {
  const [saving, setSaving]       = useState(false);
  const [resultado, setResultado] = useState(reunion.resultado ?? '');
  const [nuevoInicio, setNuevo]   = useState('');
  const [showReprog, setShowReprog] = useState(false);

  const isSetter = currentUserId === reunion.setter_id;
  const isCloser = currentUserId === reunion.closer_id;
  const isAdmin  = currentRole === 'admin';
  const isActive = ['agendada', 'reprogramada'].includes(reunion.estado);

  const lead = reunion.lead ?? reunion.team_lead;
  const leadName = lead ? `${lead.first_name}${lead.last_name ? ' ' + lead.last_name : ''}` : 'Lead eliminado';

  async function patch(body: object) {
    setSaving(true);
    const res = await fetch(`/api/agenda/reuniones/${reunion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onUpdated();
    else {
      const d = await res.json();
      alert(d.error ?? 'Error al actualizar');
    }
  }

  const fechaCaracas = new Date(reunion.inicio).toLocaleString('es-VE', {
    timeZone: APP_TIMEZONE,
    weekday: 'long', day: '2-digit', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#0a0a0a] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] p-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ESTADO_COLORS[reunion.estado] ?? ''}`}>
                {ESTADO_LABELS[reunion.estado] ?? reunion.estado}
              </span>
            </div>
            <h2 className="text-lg font-bold text-brand-text">{leadName}</h2>
            <p className="text-xs text-brand-muted capitalize">{fechaCaracas} · {reunion.duracion_min} min</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Partes */}
          <div className="grid grid-cols-2 gap-3">
            {reunion.setter && (
              <div className="flex items-center gap-2 rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#111] px-3 py-2.5">
                <Avatar name={reunion.setter.full_name} url={reunion.setter.avatar_url} />
                <div>
                  <p className="text-[10px] text-brand-muted uppercase tracking-wide">Setter</p>
                  <p className="text-sm font-medium text-brand-text">{reunion.setter.full_name ?? '—'}</p>
                </div>
              </div>
            )}
            {reunion.closer && (
              <div className="flex items-center gap-2 rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#111] px-3 py-2.5">
                <Avatar name={reunion.closer.full_name} url={reunion.closer.avatar_url} />
                <div>
                  <p className="text-[10px] text-brand-muted uppercase tracking-wide">Closer</p>
                  <p className="text-sm font-medium text-brand-text">{reunion.closer.full_name ?? '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Lead info */}
          {lead && (
            <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-brand-gold" />
                <span className="text-sm font-semibold text-brand-text">{leadName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-brand-muted" />
                <span className="text-sm text-brand-muted">{lead.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-muted">Estado: <span className="text-brand-gold font-medium">{lead.current_status}</span></span>
              </div>
            </div>
          )}

          {/* Conversación WhatsApp */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-brand-gold" />
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Conversación WhatsApp</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-3 text-xs text-brand-text/90 font-mono leading-relaxed max-h-48 overflow-y-auto">
              {reunion.conversacion_whatsapp}
            </pre>
          </div>

          {/* Notas del setter */}
          {reunion.notas && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="h-3.5 w-3.5 text-brand-gold" />
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Notas del setter</span>
              </div>
              <p className="text-sm text-brand-text/80 leading-relaxed">{reunion.notas}</p>
            </div>
          )}

          {/* Resultado del closer */}
          {(reunion.estado === 'completada' || reunion.estado === 'no_show') && reunion.resultado ? (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Resultado</span>
              </div>
              <p className="text-sm text-brand-text/80 leading-relaxed">{reunion.resultado}</p>
            </div>
          ) : null}

          {/* Acciones del closer — completar / no-show con resultado */}
          {isActive && (isCloser || isAdmin) && (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Resultado / notas post-reunión (opcional)</label>
                <textarea
                  value={resultado}
                  onChange={e => setResultado(e.target.value)}
                  rows={2}
                  placeholder="¿Cómo fue la reunión? ¿Próximo paso?"
                  className="w-full rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#111] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted resize-none focus:outline-none focus:border-brand-gold/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  onClick={() => patch({ estado: 'completada', resultado: resultado || undefined })}
                  className="flex items-center gap-1.5 rounded-md bg-green-900/40 border border-green-700/40 px-3 py-1.5 text-sm text-green-300 hover:bg-green-900/60 transition disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" /> Completar
                </button>
                <button
                  disabled={saving}
                  onClick={() => patch({ estado: 'no_show', resultado: resultado || undefined })}
                  className="flex items-center gap-1.5 rounded-md bg-red-900/30 border border-red-700/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-900/50 transition disabled:opacity-60"
                >
                  <AlertTriangle className="h-4 w-4" /> No show
                </button>
              </div>
            </div>
          )}

          {/* Reprogramar */}
          {isActive && (isSetter || isCloser || isAdmin) && (
            <div>
              {!showReprog ? (
                <button
                  onClick={() => setShowReprog(true)}
                  className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-gold transition"
                >
                  <Calendar className="h-3.5 w-3.5" /> Reprogramar
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#111] p-3">
                  <label className="text-xs text-brand-muted">Nueva fecha y hora (Caracas)</label>
                  <input
                    type="datetime-local"
                    value={nuevoInicio}
                    onChange={e => setNuevo(e.target.value)}
                    className="w-full rounded border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] px-2 py-1.5 text-sm text-brand-text"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={saving || !nuevoInicio}
                      onClick={() => {
                        // Convertir datetime-local (Caracas) a UTC ISO
                        const localDate = new Date(nuevoInicio);
                        // datetime-local no tiene timezone — asumimos Caracas UTC-4
                        const utcMs = localDate.getTime() + 4 * 60 * 60 * 1000;
                        patch({ estado: 'reprogramada', inicio: new Date(utcMs).toISOString() });
                      }}
                      className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                    <button onClick={() => setShowReprog(false)} className="text-xs text-brand-muted hover:text-brand-text">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cancelar */}
          {isActive && (isSetter || isCloser || isAdmin) && (
            <button
              disabled={saving}
              onClick={() => {
                if (!confirm('¿Cancelar esta reunión? El lead volverá a su estado anterior.')) return;
                patch({ estado: 'cancelada' });
              }}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancelar reunión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
