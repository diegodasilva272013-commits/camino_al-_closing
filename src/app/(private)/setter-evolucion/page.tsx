'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Target, Zap, Calendar, Award, BarChart2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type Report = {
  date: string;
  total_assigned: number;
  total_contacted: number;
  total_responded: number;
  total_interested: number;
  total_meeting_proposed: number;
  total_meeting_scheduled: number;
  total_no_fit: number;
  pending_follow_ups: number;
  productivity_score: number;
};

type Lead = {
  current_status: string;
  follow_up_count: number;
  is_closed: boolean;
};

function KpiCard({
  label, value, sub, accent = false, icon,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      accent
        ? 'border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.06)]'
        : 'border-[rgba(212,175,55,0.08)] bg-[#0d0d0d]'
    )}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-brand-muted">{label}</p>
        {icon && <span className="text-brand-gold/30">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-bold', accent ? 'text-brand-gold' : 'text-brand-text')}>
        {value}
      </p>
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
        <div
          className="h-full rounded-full bg-brand-gold/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs text-brand-muted">{value}</span>
    </div>
  );
}

export default function SetterEvolucionPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [rr, lr] = await Promise.all([
        fetch('/api/daily-report?all=1').then((r) => r.json()).catch(() => null),
        fetch('/api/leads').then((r) => r.json()).catch(() => []),
      ]);
      if (rr && !Array.isArray(rr)) {
        // Single report for today
        setReports(rr ? [rr] : []);
      } else {
        setReports(Array.isArray(rr) ? rr : []);
      }
      setLeads(Array.isArray(lr) ? lr : []);
      setLoading(false);
    }
    load();
  }, []);

  // Aggregate from leads (always up to date)
  const totalAssigned   = leads.length;
  const totalContacted  = leads.filter((l) => ['CONTACTADO','RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
  const totalResponded  = leads.filter((l) => ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
  const totalInterested = leads.filter((l) => ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
  const totalMeetings   = leads.filter((l) => l.current_status === 'REUNION_AGENDADA').length;
  const totalNoFit      = leads.filter((l) => l.current_status === 'NO_CALIFICA').length;
  const totalClosed     = leads.filter((l) => l.is_closed).length;
  const pending         = leads.filter((l) => !l.is_closed).length;

  const contactRate  = totalAssigned > 0 ? Math.round((totalContacted / totalAssigned) * 100) : 0;
  const responseRate = totalContacted > 0 ? Math.round((totalResponded / totalContacted) * 100) : 0;
  const interestRate = totalResponded > 0 ? Math.round((totalInterested / totalResponded) * 100) : 0;
  const closeRate    = totalInterested > 0 ? Math.round((totalMeetings / totalInterested) * 100) : 0;

  // Best productivity score from reports
  const bestScore = reports.reduce((max, r) => Math.max(max, r.productivity_score), 0);
  const totalScore = reports.reduce((sum, r) => sum + r.productivity_score, 0);
  const avgScore = reports.length > 0 ? Math.round(totalScore / reports.length) : 0;

  const statusDistribution = [
    { label: 'No contactado',   value: leads.filter((l) => l.current_status === 'NO_CONTACTADO').length },
    { label: 'Apertura env.',   value: leads.filter((l) => l.current_status === 'APERTURA_ENVIADA').length },
    { label: 'Contactado',      value: totalContacted - totalResponded },
    { label: 'Respondió',       value: leads.filter((l) => l.current_status === 'RESPONDIO').length },
    { label: 'Interesado',      value: leads.filter((l) => l.current_status === 'INTERES_DETECTADO').length },
    { label: 'Diagnóstico',     value: leads.filter((l) => ['DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO'].includes(l.current_status)).length },
    { label: 'Reun. agendada',  value: totalMeetings },
    { label: 'No califica',     value: totalNoFit },
  ];
  const maxDist = Math.max(...statusDistribution.map((s) => s.value), 1);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Setter · Evolución"
        title="Mi Evolución"
        description="KPIs acumulados de tu gestión de leads"
      />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : (
        <div className="mt-6 max-w-4xl space-y-8">
          {/* Funnel KPIs */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50">
              Embudo de conversión
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <KpiCard label="Leads asignados"    value={totalAssigned}  icon={<Target className="h-5 w-5" />} />
              <KpiCard label="Contactados"         value={totalContacted} sub={`${contactRate}% del total`} />
              <KpiCard label="Respondieron"        value={totalResponded} sub={`${responseRate}% de contactados`} />
              <KpiCard label="Interesados"         value={totalInterested} sub={`${interestRate}% de respuestas`} accent />
              <KpiCard label="Reuniones agendadas" value={totalMeetings}   sub={`${closeRate}% de interesados`} accent icon={<Calendar className="h-5 w-5" />} />
              <KpiCard label="No califica"         value={totalNoFit} />
              <KpiCard label="Pendientes"          value={pending} />
              <KpiCard label="Cerrados"            value={totalClosed} />
            </div>
          </div>

          {/* Productivity */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" />
              Score de productividad
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard label="Mejor sesión"     value={`${bestScore} pts`} accent icon={<Award className="h-5 w-5" />} />
              <KpiCard label="Promedio por día" value={`${avgScore} pts`} />
              <KpiCard label="Reportes hechos"  value={reports.length} sub="días trabajados" icon={<BarChart2 className="h-5 w-5" />} />
            </div>
          </div>

          {/* Conversion funnel visual */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Distribución de leads por estado
            </p>
            <div className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-5 space-y-3">
              {statusDistribution.map((s) => (
                <MiniBar key={s.label} label={s.label} value={s.value} max={maxDist} />
              ))}
            </div>
          </div>

          {/* Tasa de conversión visual */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50">
              Tasas de conversión
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Contacto',   value: contactRate,  color: 'bg-blue-500/60' },
                { label: 'Respuesta',  value: responseRate, color: 'bg-cyan-500/60' },
                { label: 'Interés',    value: interestRate, color: 'bg-yellow-500/60' },
                { label: 'Cierre',     value: closeRate,    color: 'bg-brand-gold/70' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] p-4 text-center">
                  <div className="relative mx-auto h-16 w-16">
                    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="#1a1a1a" strokeWidth="6" />
                      <circle
                        cx="28" cy="28" r="22" fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeDasharray={`${(item.value / 100) * 138} 138`}
                        className={item.color.replace('bg-', 'text-')}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-text">
                      {item.value}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-brand-muted">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {totalAssigned === 0 && (
            <div className="rounded-xl border border-[rgba(212,175,55,0.1)] bg-[rgba(212,175,55,0.03)] p-8 text-center">
              <TrendingUp className="mx-auto h-10 w-10 text-brand-gold/20 mb-3" />
              <p className="text-brand-muted text-sm">Todavía no tenés leads asignados.</p>
              <p className="text-brand-muted/60 text-xs mt-1">
                Cuando el admin te asigne leads, tu evolución aparecerá acá.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
