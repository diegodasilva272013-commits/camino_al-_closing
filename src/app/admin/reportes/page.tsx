'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type DailyReport = {
  id: string;
  date: string;
  user_id: string;
  total_assigned: number;
  total_contacted: number;
  total_responded: number;
  total_interested: number;
  total_meeting_proposed: number;
  total_meeting_scheduled: number;
  total_no_fit: number;
  pending_follow_ups: number;
  productivity_score: number;
  summary: string | null;
  user?: { full_name: string | null; email: string } | null;
};

export default function AdminReportesPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/daily-reports');
    const data = await res.json();
    setReports(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  const grouped = reports.reduce<Record<string, DailyReport[]>>((acc, r) => {
    acc[r.date] = acc[r.date] ?? [];
    acc[r.date].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Admin · Reportes"
        title="Reportes Diarios"
        description={`${reports.length} reportes`}
      />

      <div className="mt-6 flex justify-end">
        <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-brand-muted hover:text-brand-gold transition">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <FileText className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-muted">No hay reportes generados todavía.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4 max-w-4xl">
          {Object.entries(grouped)
            .sort(([a], [b]) => (b > a ? 1 : -1))
            .map(([date, dayReports]) => (
              <div key={date} className="rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === date ? null : date)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[rgba(212,175,55,0.02)] transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-brand-text capitalize">{fmtDate(date)}</span>
                    <span className="rounded-full bg-brand-gold/10 border border-brand-gold/20 px-2 py-0.5 text-[10px] text-brand-gold">
                      {dayReports.length} setter{dayReports.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {expanded === date
                    ? <ChevronUp className="h-4 w-4 text-brand-muted" />
                    : <ChevronDown className="h-4 w-4 text-brand-muted" />
                  }
                </button>

                {expanded === date && (
                  <div className="border-t border-[rgba(212,175,55,0.08)] divide-y divide-[rgba(212,175,55,0.05)]">
                    {dayReports.map((r) => (
                      <div key={r.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-brand-text">
                              {r.user?.full_name ?? r.user?.email ?? 'Usuario desconocido'}
                            </p>
                            {r.summary && (
                              <p className="mt-1.5 text-xs text-brand-muted/80 leading-relaxed">
                                {r.summary}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-bold text-brand-gold">{r.productivity_score}</p>
                            <p className="text-[10px] text-brand-muted">pts</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-brand-muted">
                          <span>Asignados: <strong className="text-brand-text">{r.total_assigned}</strong></span>
                          <span>Contactados: <strong className="text-brand-text">{r.total_contacted}</strong></span>
                          <span>Respondieron: <strong className="text-brand-text">{r.total_responded}</strong></span>
                          <span>Interesados: <strong className="text-brand-gold">{r.total_interested}</strong></span>
                          <span>Reun. prop.: <strong className="text-brand-text">{r.total_meeting_proposed}</strong></span>
                          <span>Reun. agend.: <strong className="text-emerald-400">{r.total_meeting_scheduled}</strong></span>
                          <span>NC: <strong className="text-brand-text">{r.total_no_fit}</strong></span>
                          <span>Pend.: <strong className="text-brand-text">{r.pending_follow_ups}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
