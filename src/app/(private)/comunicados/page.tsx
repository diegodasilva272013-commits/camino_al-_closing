'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, CheckCircle, Bell, Zap, AlertTriangle,
  Calendar, ClipboardList, RefreshCw, Pin, ChevronDown, ChevronUp,
} from 'lucide-react';

type Ann = {
  id: string; title: string; body: string; type: string; target: string;
  deadline: string | null; is_pinned: boolean; created_at: string; is_read: boolean;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; border: string }> = {
  urgente:    { label: 'Urgente',    color: 'text-red-400',        border: 'border-red-500/30 bg-red-900/10',        icon: <Zap className="h-3.5 w-3.5" /> },
  strike:     { label: 'Strike',     color: 'text-orange-400',     border: 'border-orange-500/30 bg-orange-900/10',  icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  formulario: { label: 'Formulario', color: 'text-brand-gold',     border: 'border-brand-gold/20 bg-[rgba(212,175,55,0.06)]', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  reunion:    { label: 'Reunión',    color: 'text-sky-400',        border: 'border-sky-500/20 bg-sky-900/10',        icon: <Calendar className="h-3.5 w-3.5" /> },
  cambio:     { label: 'Cambio',     color: 'text-violet-400',     border: 'border-violet-500/20 bg-violet-900/10', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  comunicado: { label: 'Comunicado', color: 'text-zinc-300',       border: 'border-zinc-800 bg-[#0d0d0d]',          icon: <Bell className="h-3.5 w-3.5" /> },
};

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3600000);
  const mins  = Math.floor((abs % 3600000) / 60000);

  const text = past
    ? `Venció hace ${hours > 0 ? `${hours}h ` : ''}${mins}m`
    : hours >= 24
    ? `Vence el ${d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}`
    : `Vence en ${hours > 0 ? `${hours}h ` : ''}${mins}m`;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1.5 w-fit
      ${past ? 'text-zinc-400 bg-zinc-800/50' : hours < 2 ? 'text-red-400 bg-red-900/20 border border-red-500/20' : 'text-amber-400 bg-amber-900/15 border border-amber-500/20'}`}>
      ⏰ {text}
    </div>
  );
}

export default function ComunicadosPage() {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/announcements').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAnns(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    if (marking === id) return;
    setMarking(id);
    await fetch(`/api/announcements/${id}/read`, { method: 'POST' });
    setAnns(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    setMarking(null);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const unreadCount = anns.filter(a => !a.is_read).length;
  const pinned  = anns.filter(a => a.is_pinned);
  const rest    = anns.filter(a => !a.is_pinned);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Centro de información</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Comunicados</h1>
        {unreadCount > 0
          ? <p className="text-sm text-amber-400 font-semibold mt-0.5">Tenés {unreadCount} sin leer</p>
          : <p className="text-sm text-brand-muted mt-0.5">Estás al día con todos los comunicados.</p>}
      </div>

      {anns.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <Bell className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-text font-semibold">Sin comunicados por ahora</p>
          <p className="text-sm text-brand-muted">Cuando haya avisos importantes, van a aparecer acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pinned, ...rest].map(a => {
            const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.comunicado;
            const isOpen = expanded.has(a.id);
            const shortBody = a.body.length > 120 ? a.body.slice(0, 120) + '...' : a.body;
            const needsExpand = a.body.length > 120;

            return (
              <div key={a.id}
                className={`rounded-2xl border transition ${cfg.border} ${!a.is_read ? 'ring-1 ring-brand-gold/10' : ''}`}>
                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start gap-2.5 mb-2">
                    {a.is_pinned && <Pin className="h-3.5 w-3.5 text-brand-gold shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className="text-[10px] text-brand-muted">
                          {new Date(a.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {a.is_read && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 ml-auto">
                            <CheckCircle className="h-3 w-3" /> Visto
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-brand-text leading-snug">{a.title}</h3>
                    </div>
                  </div>

                  {/* Deadline */}
                  {a.deadline && <div className="mb-2"><DeadlineCountdown deadline={a.deadline} /></div>}

                  {/* Body */}
                  <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-wrap">
                    {isOpen ? a.body : shortBody}
                  </p>

                  {/* Actions row */}
                  <div className="flex items-center gap-3 mt-3">
                    {needsExpand && (
                      <button onClick={() => toggleExpand(a.id)}
                        className="flex items-center gap-1 text-xs text-brand-muted hover:text-brand-text transition">
                        {isOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver más</>}
                      </button>
                    )}
                    {!a.is_read && (
                      <button onClick={() => markRead(a.id)} disabled={marking === a.id}
                        className="ml-auto flex items-center gap-1.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20 px-3 py-1.5 text-xs font-bold text-brand-gold hover:bg-brand-gold/20 transition disabled:opacity-40">
                        {marking === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Marcar como visto
                      </button>
                    )}
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
