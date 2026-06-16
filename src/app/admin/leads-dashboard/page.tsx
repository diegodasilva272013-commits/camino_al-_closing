'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, TrendingUp, Users2, Target, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type GlobalMetrics = {
  total: number;
  assignedToday: number;
  contacted: number;
  responded: number;
  interested: number;
  invitedToGroup: number;
  enteredGroup: number;
  diagnosisStarted: number;
  meetingProposed: number;
  meetingScheduled: number;
  noFit: number;
  futureFollowUp: number;
};

type UserRanking = {
  id: string;
  name: string;
  total: number;
  responded: number;
  interested: number;
  meetingProposed: number;
  meetingScheduled: number;
  pending: number;
  responseRate: number;
  interestRate: number;
};

function MetricCard({
  label, value, icon, accent = false,
}: {
  label: string; value: number; icon?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      accent
        ? 'border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.06)]'
        : 'border-[rgba(212,175,55,0.08)] bg-[#0d0d0d]'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-brand-muted">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold', accent ? 'text-brand-gold' : 'text-brand-text')}>
            {value}
          </p>
        </div>
        {icon && <div className="text-brand-gold/40">{icon}</div>}
      </div>
    </div>
  );
}

export default function LeadsDashboardPage() {
  const [global, setGlobal] = useState<GlobalMetrics | null>(null);
  const [ranking, setRanking] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/leads/metrics');
    const data = await res.json();
    setGlobal(data?.global ?? null);
    setRanking(data?.ranking ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Admin · Dashboard"
        title="Dashboard Leads"
        description={today}
      />

      <div className="mt-6 flex justify-end">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-brand-muted hover:text-brand-gold transition"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : global ? (
        <>
          {/* Global metrics */}
          <div className="mt-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50">Métricas globales</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricCard label="Total leads"       value={global.total}           icon={<Users2 className="h-5 w-5" />} />
              <MetricCard label="Asignados hoy"     value={global.assignedToday}   icon={<Calendar className="h-5 w-5" />} />
              <MetricCard label="Contactados"        value={global.contacted} />
              <MetricCard label="Respondieron"       value={global.responded} />
              <MetricCard label="Interesados"        value={global.interested}      accent />
              <MetricCard label="Inv. al grupo"      value={global.invitedToGroup} />
              <MetricCard label="Ing. al grupo"      value={global.enteredGroup} />
              <MetricCard label="Diagnóstico inic."  value={global.diagnosisStarted} />
              <MetricCard label="Reuniones prop."    value={global.meetingProposed} accent />
              <MetricCard label="Reuniones agend."   value={global.meetingScheduled} accent icon={<Target className="h-5 w-5" />} />
              <MetricCard label="No califica"        value={global.noFit} />
              <MetricCard label="Seg. futuro"        value={global.futureFollowUp} />
            </div>
          </div>

          {/* Ranking */}
          <div className="mt-8">
            <p className="mb-3 text-xs uppercase tracking-widest text-brand-gold/50 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Ranking por usuario
            </p>
            <div className="rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-[rgba(212,175,55,0.08)]">
                    {['#', 'Usuario', 'Leads', 'Resp.', 'Interés %', 'Resp. %', 'Reun. prop.', 'Reun. agend.', 'Pendientes', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-brand-gold/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(212,175,55,0.05)]">
                  {ranking.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-brand-muted">Sin datos.</td></tr>
                  ) : ranking.map((u, i) => (
                    <tr key={u.id} className="hover:bg-[rgba(212,175,55,0.02)] transition">
                      <td className="px-4 py-3 text-brand-gold font-bold">#{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-brand-text">{u.name}</td>
                      <td className="px-4 py-3 text-brand-muted">{u.total}</td>
                      <td className="px-4 py-3 text-brand-muted">{u.responded}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-sm font-semibold', u.interestRate > 20 ? 'text-brand-gold' : 'text-brand-muted')}>
                          {u.interestRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-sm font-semibold', u.responseRate > 30 ? 'text-emerald-400' : 'text-brand-muted')}>
                          {u.responseRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">{u.meetingProposed}</td>
                      <td className="px-4 py-3">
                        <span className={cn('font-semibold', u.meetingScheduled > 0 ? 'text-brand-gold' : 'text-brand-muted')}>
                          {u.meetingScheduled}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">{u.pending}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/leads?user_id=${u.id}`}
                          className="text-xs text-brand-gold/80 hover:text-brand-gold underline"
                        >
                          Ver leads
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-16 text-center text-brand-muted">Sin datos disponibles.</div>
      )}
    </div>
  );
}
