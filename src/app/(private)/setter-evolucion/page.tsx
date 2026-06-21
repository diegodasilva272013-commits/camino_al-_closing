'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Users2, MessageSquare, Swords, ClipboardCheck, Target, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

const NIVEL_LABEL: Record<string, { l: string; c: string }> = {
  principiante: { l: 'Principiante', c: 'text-zinc-400 border-zinc-600 bg-zinc-800/40' },
  en_desarrollo: { l: 'En desarrollo', c: 'text-sky-400 border-sky-500/20 bg-sky-900/15' },
  intermedio:    { l: 'Intermedio',    c: 'text-amber-400 border-amber-500/20 bg-amber-900/15' },
  avanzado:      { l: 'Avanzado',      c: 'text-emerald-400 border-emerald-500/20 bg-emerald-900/15' },
};

type LeadsSummary = { total: number; contacted: number; responded: number; interested: number; meetings: number; no_fit: number; closed: number; contact_rate: number; response_rate: number; meeting_rate: number };
type ConvsSummary = { total: number; with_reflection: number; approved_reflections: number; total_xp_earned: number; cap_scores: Record<string, { label: string; avg: number }>; latest: { date: string; resultado: string; xp: number }[] };
type TrainerSummary = { total_sessions: number; completed_sessions: number; unique_scenarios: number; last_evaluation: string | null; groups_practiced: string[] };
type FormsSummary = { completed: number; avg_score: number | null; latest_nivel: string | null };

type EvolucionData = {
  leads_summary: LeadsSummary;
  conversations_summary: ConvsSummary;
  trainer_summary: TrainerSummary;
  forms_summary: FormsSummary;
};

function KpiCard({ label, value, sub, accent = false, icon }: { label: string; value: string | number; sub?: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border p-4', accent ? 'border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.06)]' : 'border-[rgba(212,175,55,0.08)] bg-[#0d0d0d]')}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-brand-muted">{label}</p>
        {icon && <span className="text-brand-gold/30">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-bold', accent ? 'text-brand-gold' : 'text-brand-text')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-brand-muted/60">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-brand-muted truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-brand-gold/60 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-xs text-brand-muted">{value}</span>
    </div>
  );
}

function RateCircle({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-3 text-center">
      <div className="relative mx-auto h-14 w-14">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#1a1a1a" strokeWidth="6" />
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
            strokeWidth="6" strokeDasharray={`${(value / 100) * 138} 138`}
            className={color} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-text">{value}%</span>
      </div>
      <p className="mt-1.5 text-[10px] text-brand-muted">{label}</p>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50 flex items-center gap-2">
      {icon}{label}
    </p>
  );
}

export default function SetterEvolucionPage() {
  const [data, setData] = useState<EvolucionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/setter/evolucion')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const { leads_summary: l, conversations_summary: c, trainer_summary: t, forms_summary: f } = data;
  const nivel = f.latest_nivel ? NIVEL_LABEL[f.latest_nivel] : null;

  const leadsDistrib = [
    { label: 'Contactados',  value: l.contacted },
    { label: 'Respondieron', value: l.responded },
    { label: 'Interesados',  value: l.interested },
    { label: 'Reuniones',    value: l.meetings },
    { label: 'No califica',  value: l.no_fit },
    { label: 'Cerrados',     value: l.closed },
  ];
  const maxLead = Math.max(...leadsDistrib.map(d => d.value), 1);

  const noActivity = l.total === 0 && c.total === 0 && t.total_sessions === 0 && f.completed === 0;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader eyebrow="Setter · Evolución" title="Mi Evolución" description="Todo tu progreso en un solo lugar" />

      {/* Resumen general */}
      <div className="mt-6 max-w-4xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <KpiCard label="Leads asignados"     value={l.total}               icon={<Users2 className="h-5 w-5" />} />
          <KpiCard label="Convos analizadas"   value={c.total}               icon={<MessageSquare className="h-5 w-5" />} />
          <KpiCard label="Sesiones trainer"    value={t.total_sessions}      icon={<Swords className="h-5 w-5" />} />
          <KpiCard label="Formularios"         value={f.completed}           icon={<ClipboardCheck className="h-5 w-5" />} accent />
        </div>

        {nivel && (
          <div className="mb-6 rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] p-4 flex items-center gap-3">
            <div>
              <p className="text-xs text-brand-muted">Tu nivel actual</p>
              <span className={`mt-1 inline-block text-sm font-bold px-2 py-0.5 rounded-full border ${nivel.c}`}>{nivel.l}</span>
            </div>
            {f.avg_score !== null && (
              <div className="ml-auto text-right">
                <p className={`text-3xl font-black ${f.avg_score >= 70 ? 'text-emerald-400' : f.avg_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{f.avg_score}</p>
                <p className="text-[10px] text-brand-muted">promedio formularios</p>
              </div>
            )}
          </div>
        )}

        {noActivity && (
          <div className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[rgba(212,175,55,0.03)] p-8 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-brand-gold/20 mb-3" />
            <p className="text-brand-muted text-sm">Todavía no tenés actividad registrada.</p>
            <p className="text-brand-muted/60 text-xs mt-1">Cargá conversaciones, hacé sesiones de trainer y completá formularios para ver tu evolución.</p>
          </div>
        )}

        {/* ── Leads ── */}
        {l.total > 0 && (
          <div className="mb-8">
            <SectionTitle icon={<Users2 className="h-3.5 w-3.5" />} label="Embudo de leads" />
            <div className="grid grid-cols-3 gap-3 mb-4">
              <RateCircle label="Contacto"  value={l.contact_rate}  color="text-blue-500/70" />
              <RateCircle label="Respuesta" value={l.response_rate} color="text-cyan-500/70" />
              <RateCircle label="Reunión"   value={l.meeting_rate}  color="text-brand-gold/70" />
            </div>
            <div className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-4 space-y-2.5">
              {leadsDistrib.map(d => <MiniBar key={d.label} label={d.label} value={d.value} max={maxLead} />)}
            </div>
          </div>
        )}

        {/* ── Conversaciones ── */}
        {c.total > 0 && (
          <div className="mb-8">
            <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} label="Conversaciones analizadas" />
            <div className="grid grid-cols-3 gap-3 mb-4">
              <KpiCard label="Analizadas"            value={c.total} />
              <KpiCard label="Reflexiones aprobadas" value={c.approved_reflections} />
              <KpiCard label="XP ganado"             value={`${c.total_xp_earned} XP`} accent />
            </div>

            {Object.keys(c.cap_scores).length > 0 && (
              <div className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-4 space-y-2.5">
                <p className="text-[10px] uppercase tracking-widest text-brand-gold/50 mb-3">Capacidades en conversaciones reales</p>
                {Object.entries(c.cap_scores).sort((a, b) => b[1].avg - a[1].avg).map(([k, v]) => {
                  const pct = Math.round((v.avg / 3) * 100);
                  const color = v.avg >= 2.5 ? 'bg-emerald-500' : v.avg >= 1.5 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-xs text-brand-muted truncate">{v.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-brand-muted w-12 text-right">
                        {v.avg >= 2.5 ? 'Alta' : v.avg >= 1.5 ? 'Media' : 'Baja'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {c.latest.length > 0 && (
              <div className="mt-3 rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-4">
                <p className="text-[10px] uppercase tracking-widest text-brand-gold/50 mb-3">Últimas conversaciones</p>
                {c.latest.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
                    <span className="text-[10px] text-brand-muted w-16 shrink-0">{new Date(item.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
                    <span className="flex-1 text-xs text-brand-text truncate">{item.resultado || '—'}</span>
                    {item.xp > 0 && <span className="text-[10px] text-brand-gold shrink-0">+{item.xp} XP</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Trainer ── */}
        {t.total_sessions > 0 && (
          <div className="mb-8">
            <SectionTitle icon={<Swords className="h-3.5 w-3.5" />} label="Entrenamiento" />
            <div className="grid grid-cols-3 gap-3 mb-3">
              <KpiCard label="Sesiones totales"   value={t.total_sessions} />
              <KpiCard label="Completadas"         value={t.completed_sessions} />
              <KpiCard label="Escenarios únicos"   value={t.unique_scenarios} accent />
            </div>

            {t.groups_practiced.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-widest text-brand-gold/50 mb-2">Grupos practicados</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.groups_practiced.map((g, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg border border-[rgba(212,175,55,0.15)] text-brand-muted">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {t.last_evaluation && (
              <div className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-3">
                <p className="text-[10px] uppercase text-brand-gold/50 mb-1">Última evaluación</p>
                <p className="text-xs text-brand-text leading-relaxed">{t.last_evaluation}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Formularios ── */}
        {f.completed > 0 && (
          <div className="mb-8">
            <SectionTitle icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Conocimiento CAC — Formularios" />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Completados"  value={f.completed} />
              <KpiCard label="Promedio"     value={f.avg_score !== null ? `${f.avg_score}/100` : '—'} accent />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
