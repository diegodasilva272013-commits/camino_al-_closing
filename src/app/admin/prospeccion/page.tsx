'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Loader2, MessageCircle, TrendingUp, Brain, Users2, LayoutTemplate, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type Global = {
  total_messages: number; leads_contacted: number; responses_received: number;
  response_rate: number; evaluations_count: number; avg_ai_score: number | null;
  templates_count: number; setters_active: number;
};
type SetterRow = {
  setter_id: string; name: string; leads_contacted: number; messages_sent: number;
  responses_received: number; response_rate: number; avg_ai_score: number | null; evals_count: number;
};

function Card({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="card-premium">
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-gold">{label}</p>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <p className="mt-3 text-3xl font-black text-brand-text">{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminProspectingPage() {
  const [global, setGlobal] = useState<Global | null>(null);
  const [ranking, setRanking] = useState<SetterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/prospecting/metrics');
      const d = await r.json();
      setGlobal(d.global ?? null);
      setRanking(d.ranking ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Setters</p>
          <h1 className="text-2xl font-bold text-brand-text mt-1">Sistema de Prospección CAC</h1>
          <p className="text-sm text-brand-muted mt-0.5">Mensajes, respuestas, evaluaciones IA y ranking del equipo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/prospeccion/plantillas"
            className="flex items-center gap-2 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.08)] px-4 py-2 text-sm text-brand-gold hover:bg-[rgba(212,175,55,0.15)] transition">
            <LayoutTemplate className="h-4 w-4" /> Plantillas
          </Link>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-brand-muted">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>
      ) : !global ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Target className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-text font-semibold">Sin datos todavía</p>
          <p className="text-sm text-brand-muted text-center max-w-sm">Corré la migración 0022, creá plantillas y los setters empiecen a contactar leads.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Mensajes enviados"  value={global.total_messages}    icon={MessageCircle} color="text-sky-400" />
            <Card label="Leads contactados"  value={global.leads_contacted}   icon={Users2}        color="text-emerald-400" />
            <Card label="Respondieron"       value={global.responses_received} sub={`${global.response_rate}% tasa`} icon={TrendingUp} color="text-yellow-400" />
            <Card label="Promedio IA equipo" value={global.avg_ai_score != null ? `${global.avg_ai_score}/10` : '—'} sub={`${global.evaluations_count} evaluaciones`} icon={Brain} color="text-violet-400" />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Setters activos', value: global.setters_active },
              { label: 'Plantillas', value: global.templates_count },
              { label: 'Evaluaciones', value: global.evaluations_count },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-3 text-center">
                <p className="text-xl font-black text-brand-text">{s.value}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Ranking */}
          {ranking.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-brand-text mb-3">Ranking de prospección</h2>
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {['#', 'Setter', 'Contactados', 'Mensajes', 'Respondieron', 'Tasa', 'Score IA', 'Evals'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-brand-muted font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((s, i) => (
                      <tr key={s.setter_id} className={cn('border-b border-zinc-800/50 hover:bg-zinc-900/30 transition', i === 0 && 'bg-[rgba(212,175,55,0.03)]')}>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-xs font-black', i === 0 ? 'text-brand-gold' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-700' : 'text-zinc-600')}>
                            #{i + 1}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/setters/${s.setter_id}`} className="font-semibold text-brand-text hover:text-brand-gold transition text-xs">
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-brand-text">{s.leads_contacted}</td>
                        <td className="px-3 py-2.5 text-xs text-brand-muted">{s.messages_sent}</td>
                        <td className="px-3 py-2.5 text-xs text-brand-text">{s.responses_received}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-xs font-bold', s.response_rate >= 15 ? 'text-emerald-400' : s.response_rate >= 8 ? 'text-yellow-400' : 'text-red-400')}>
                            {s.response_rate}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {s.avg_ai_score != null ? (
                            <span className={cn('text-xs font-bold', s.avg_ai_score >= 7 ? 'text-emerald-400' : s.avg_ai_score >= 5 ? 'text-yellow-400' : 'text-red-400')}>
                              {s.avg_ai_score}/10
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-brand-muted">{s.evals_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts */}
          {ranking.length > 0 && (() => {
            const alerts: { setter: string; msg: string; color: string }[] = [];
            for (const s of ranking) {
              if (s.leads_contacted === 0) alerts.push({ setter: s.name, msg: 'No contactó ningún lead todavía', color: 'text-zinc-400' });
              else if (s.response_rate < 5 && s.leads_contacted > 10) alerts.push({ setter: s.name, msg: `Tasa de respuesta muy baja (${s.response_rate}%) — revisar apertura`, color: 'text-red-400' });
              if (s.avg_ai_score != null && s.avg_ai_score < 5) alerts.push({ setter: s.name, msg: `Score IA bajo (${s.avg_ai_score}/10) — necesita refuerzo`, color: 'text-orange-400' });
            }
            if (!alerts.length) return null;
            return (
              <div>
                <h2 className="text-sm font-bold text-brand-text mb-3">Alertas del equipo</h2>
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-2.5">
                      <span className="text-xs font-bold text-brand-gold shrink-0">{a.setter}</span>
                      <span className={cn('text-xs', a.color)}>— {a.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
