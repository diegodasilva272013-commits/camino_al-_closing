'use client';

import { useState, useEffect } from 'react';
import { BarChart2, Zap, Copy, Check, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type DailyReport = {
  id: string;
  date: string;
  total_assigned: number;
  total_contacted: number;
  total_no_contacted: number;
  total_no_response: number;
  total_responded: number;
  total_interested: number;
  total_invited_to_group: number;
  total_entered_group: number;
  total_active_group: number;
  total_diagnosis_started: number;
  total_deep_diagnosis: number;
  total_meeting_proposed: number;
  total_meeting_scheduled: number;
  total_no_fit: number;
  total_future_follow_up: number;
  pending_follow_ups: number;
  completed_leads: number;
  productivity_score: number;
  summary: string | null;
};

function Metric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4 text-center',
      highlight
        ? 'border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.05)]'
        : 'border-[rgba(212,175,55,0.08)] bg-[#0d0d0d]'
    )}>
      <div className={cn('text-2xl font-bold', highlight ? 'text-brand-gold' : 'text-brand-text')}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-brand-muted">{label}</div>
    </div>
  );
}

export default function ReporteDiarioPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function loadReport() {
    setLoading(true);
    const res = await fetch(`/api/daily-report?date=${today}`);
    const data = await res.json();
    setReport(data ?? null);
    setLoading(false);
  }

  useEffect(() => { loadReport(); }, []);

  async function generate() {
    setGenerating(true);
    const res = await fetch('/api/daily-report', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setReport(data);
    }
    setGenerating(false);
  }

  async function copyReport() {
    if (!report?.summary) return;
    const text =
      `📊 REPORTE DIARIO — ${new Date(today).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\n` +
      report.summary + '\n\n' +
      `⚡ Score de productividad: ${report.productivity_score} pts\n\n` +
      `Desglose:\n` +
      `• Asignados: ${report.total_assigned}\n` +
      `• Contactados: ${report.total_contacted}\n` +
      `• No responden: ${report.total_no_response}\n` +
      `• Respondieron: ${report.total_responded}\n` +
      `• Interesados: ${report.total_interested}\n` +
      `• Reuniones propuestas: ${report.total_meeting_proposed}\n` +
      `• Reuniones agendadas: ${report.total_meeting_scheduled}\n` +
      `• No califica: ${report.total_no_fit}\n` +
      `• Seguimientos pendientes: ${report.pending_follow_ups}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const todayFmt = new Date(today + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        title="Reporte Diario"
        description={todayFmt}
        icon={<BarChart2 className="h-5 w-5 text-brand-gold" />}
      />

      <div className="mt-6 max-w-4xl">
        {/* Main CTA */}
        <div className="rounded-2xl border border-[rgba(212,175,55,0.2)] bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-text">
                {report ? '✅ Jornada cerrada' : 'Cerrar jornada y generar reporte'}
              </h2>
              <p className="mt-1 text-sm text-brand-muted">
                {report
                  ? `Generado hoy. Podés volver a generar para actualizar los datos.`
                  : 'Calculá automáticamente tus métricas del día.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 px-5 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-50"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {generating ? 'Generando...' : report ? 'Regenerar' : 'Cerrar jornada'}
              </button>
              {report && (
                <button
                  onClick={copyReport}
                  className="flex items-center gap-2 rounded-xl border border-[rgba(212,175,55,0.2)] px-4 py-2.5 text-sm text-brand-muted hover:text-brand-gold transition"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : report ? (
          <>
            {/* Score */}
            <div className="mt-6 rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.04)] p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-brand-gold/60">Score de productividad</p>
              <p className="mt-2 text-5xl font-bold text-brand-gold">{report.productivity_score}</p>
              <p className="mt-1 text-xs text-brand-muted">puntos</p>
            </div>

            {/* Metrics grid */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Metric label="Asignados"           value={report.total_assigned} />
              <Metric label="Contactados"          value={report.total_contacted} />
              <Metric label="No contactados"       value={report.total_no_contacted} />
              <Metric label="No responden"         value={report.total_no_response} />
              <Metric label="Respondieron"         value={report.total_responded} />
              <Metric label="Interesados"          value={report.total_interested} highlight />
              <Metric label="Invitados al grupo"   value={report.total_invited_to_group} />
              <Metric label="Ingresaron al grupo"  value={report.total_entered_group} />
              <Metric label="Diagnóstico iniciado" value={report.total_diagnosis_started} />
              <Metric label="Diagnóstico profundo" value={report.total_deep_diagnosis} />
              <Metric label="Reuniones propuestas" value={report.total_meeting_proposed} highlight />
              <Metric label="Reuniones agendadas"  value={report.total_meeting_scheduled} highlight />
              <Metric label="No califica"          value={report.total_no_fit} />
              <Metric label="Seg. futuro"          value={report.total_future_follow_up} />
              <Metric label="Pend. seguimiento"    value={report.pending_follow_ups} />
              <Metric label="Cerrados"             value={report.completed_leads} />
            </div>

            {/* Summary */}
            {report.summary && (
              <div className="mt-4 rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] p-5">
                <p className="mb-2 text-xs uppercase tracking-widest text-brand-gold/50">Resumen</p>
                <p className="text-sm text-brand-text/80 leading-relaxed">{report.summary}</p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <BarChart2 className="h-12 w-12 text-brand-gold/20" />
            <p className="text-brand-muted">No generaste tu reporte de hoy todavía.</p>
            <p className="text-xs text-brand-muted/60">
              Tocá &quot;Cerrar jornada&quot; para calcular tus métricas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
