'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Zap, Brain, ChevronRight, X,
  Search, Loader2, ChevronDown, ChevronUp, FileText, Star,
  AlertTriangle, CheckCircle, Target, ArrowUp, ArrowDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
type CapLevel = 'alta' | 'media' | 'baja' | 'no_mostrada';

type Analysis = {
  resultado_probable: string;
  fortalezas: string[];
  errores: string[];
  capacidades_impactadas: Record<string, CapLevel>;
  donde_se_rompio: string;
};

type Row = {
  id: string; user_id: string; status: string; created_at: string;
  analysis: Analysis | null;
  profile: { full_name: string | null; email: string | null } | null;
  reflection: { status: string; xp_earned: number; evaluation: any | null; answers: Record<string, string> } | null;
};

type Evolution = {
  user_name: string;
  total_conversations: number;
  approved_reflections: number;
  tendencia_semanal: 'mejorando' | 'estable' | 'empeorando';
  tendencia_mensual: 'mejorando' | 'estable' | 'empeorando';
  strongest_caps: string[];
  weakest_caps: string[];
  cap_scores: Record<string, number>;
  resumen: string;
  capacidades: { fuertes: string[]; debiles: string[]; en_crecimiento: string[]; en_riesgo: string[] };
  patrones: { activos: string[]; corregidos: string[]; emergentes: string[] };
  aprendizajes: { principales_descubrimientos: string[]; mejoras_observadas: string[]; errores_repetidos: string[] };
  recomendaciones: { que_entrenar: string; clase_recomendada: string; mentoria_sugerida: string };
};

type UserStat = {
  user_id: string; name: string;
  total: number; approved: number; pending: number;
  total_xp: number; rows: Row[];
};

// ── Helpers ────────────────────────────────────────────────────────
const CAP_LABELS: Record<string, string> = {
  intencion: 'Intención', rapport: 'Rapport', empatia_profesional: 'Empatía profesional',
  diagnostico: 'Diagnóstico', generacion_interes: 'Generación de interés',
  seguimiento: 'Seguimiento', profesionalismo: 'Profesionalismo', criterio: 'Criterio',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TendIcon({ t }: { t: 'mejorando' | 'estable' | 'empeorando' }) {
  if (t === 'mejorando')   return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (t === 'empeorando')  return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-zinc-500" />;
}

function TendBadge({ label, t }: { label: string; t: 'mejorando' | 'estable' | 'empeorando' }) {
  const colors = t === 'mejorando' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/15'
    : t === 'empeorando' ? 'text-red-400 border-red-500/20 bg-red-900/15'
    : 'text-zinc-400 border-zinc-700 bg-zinc-800/40';
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${colors}`}>
      <TendIcon t={t} />{label}: {t}
    </span>
  );
}

// ── Evidence Panel (conversations at the bottom) ───────────────────
function EvidencePanel({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);

  const REFL_LABELS: Record<string, string> = {
    que_ocurrio: '¿Qué ocurrió?', donde_se_rompio: '¿Dónde se rompió?',
    que_hiciste_bien: '¿Qué hiciste bien?', que_hiciste_mal: '¿Qué hiciste mal?',
    que_aprendiste: '¿Qué aprendiste?', que_aplicaras: '¿Qué aplicarás?',
  };

  return (
    <div className="border-t border-[rgba(212,175,55,0.1)] pt-4">
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-brand-muted hover:text-brand-text">
        <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Evidencia — {rows.length} conversaciones</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {rows.map(r => (
            <button key={r.id} onClick={() => setDetail(r)}
              className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#0d0d0d] px-4 py-3 text-left hover:bg-[#111] transition">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-brand-text truncate">{r.analysis?.resultado_probable ?? 'Analizando...'}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">{fmtDate(r.created_at)}</p>
              </div>
              {!r.reflection ? (
                <span className="text-[10px] text-amber-400 shrink-0">sin reflexión</span>
              ) : r.reflection.status === 'approved' ? (
                <span className="text-[10px] text-emerald-400 shrink-0 flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />+{r.reflection.xp_earned}</span>
              ) : (
                <span className="text-[10px] text-red-400 shrink-0">rechazada</span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-brand-muted shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Quick conversation detail */}
      {detail && (
        <div className="fixed inset-0 z-60 flex justify-end">
          <button onClick={() => setDetail(null)} className="absolute inset-0 bg-black/60" />
          <div className="relative flex h-full w-full max-w-md flex-col bg-[#090909] border-l border-[rgba(212,175,55,0.15)] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[rgba(212,175,55,0.1)] px-5 py-4 shrink-0">
              <p className="flex-1 text-sm font-bold text-brand-text truncate">{detail.analysis?.resultado_probable ?? '—'}</p>
              <p className="text-xs text-brand-muted">{fmtDate(detail.created_at)}</p>
              <button onClick={() => setDetail(null)}><X className="h-4 w-4 text-brand-muted" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {detail.analysis && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-900/10 p-3">
                      <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Fortalezas</p>
                      {detail.analysis.fortalezas?.map((f, i) => <p key={i} className="text-[11px] text-brand-text">• {f}</p>)}
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-3">
                      <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Errores</p>
                      {detail.analysis.errores?.map((e, i) => <p key={i} className="text-[11px] text-brand-text">• {e}</p>)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-[#0d0d0d] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-brand-muted mb-1">Quiebre</p>
                    <p className="text-xs text-brand-text">{detail.analysis.donde_se_rompio}</p>
                  </div>
                </div>
              )}
              {detail.reflection?.answers && (
                <div className="border-t border-[rgba(212,175,55,0.1)] pt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Reflexión del setter</p>
                  {Object.entries(detail.reflection.answers).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-zinc-800 bg-[#0d0d0d] px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-brand-gold/60 mb-0.5">{REFL_LABELS[k] ?? k}</p>
                      <p className="text-xs text-brand-text whitespace-pre-wrap leading-relaxed">{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Evolution Panel ───────────────────────────────────────────
function UserPanel({ stat, onClose }: { stat: UserStat; onClose: () => void }) {
  const [evo, setEvo] = useState<Evolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadEvo() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/conversations/evolution?user_id=${stat.user_id}`);
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setEvo(d);
    } catch (e: any) {
      setError(e?.message ?? 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvo(); }, []);

  const capScoreColor = (score: number) =>
    score >= 2.5 ? 'bg-emerald-500' : score >= 1.7 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-[#090909] border-l border-[rgba(212,175,55,0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.1)] px-5 py-4 shrink-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-sm font-bold text-brand-gold">
            {stat.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-brand-text truncate">{stat.name}</p>
            <p className="text-xs text-brand-muted">{stat.total} conversaciones · {stat.total_xp} XP ganado</p>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-brand-muted" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
              <p className="text-sm text-brand-muted">Motor CAC sintetizando evolución...</p>
            </div>
          )}

          {error && <p className="text-sm text-red-400 py-4 text-center">{error}</p>}

          {evo && (
            <>
              {/* 1. RESUMEN DE EVOLUCIÓN */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold/60 mb-3">Resumen de evolución</p>
                <p className="text-sm text-brand-text leading-relaxed mb-4">{evo.resumen}</p>
                <div className="flex flex-wrap gap-2">
                  <TendBadge label="Esta semana" t={evo.tendencia_semanal} />
                  <TendBadge label="Este mes" t={evo.tendencia_mensual} />
                </div>
              </div>

              {/* 2. CAPACIDADES */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold/60 mb-3">Capacidades</p>

                {/* Cap scores bar chart */}
                <div className="space-y-2 mb-4">
                  {Object.entries(evo.cap_scores ?? {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([k, score]) => (
                      <div key={k} className="flex items-center gap-3">
                        <p className="text-[11px] text-brand-muted w-32 shrink-0 truncate">{CAP_LABELS[k] ?? k}</p>
                        <div className="flex-1 h-2 rounded-full bg-zinc-800">
                          <div className={`h-2 rounded-full ${capScoreColor(score)} transition-all`}
                            style={{ width: `${(score / 3) * 100}%` }} />
                        </div>
                        <p className="text-[11px] font-bold text-brand-muted w-8 text-right">
                          {score >= 2.5 ? 'Alta' : score >= 1.7 ? 'Media' : 'Baja'}
                        </p>
                      </div>
                    ))
                  }
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Capacidades fuertes', items: evo.capacidades?.fuertes, color: 'emerald', icon: <ArrowUp className="h-3 w-3" /> },
                    { label: 'Capacidades débiles', items: evo.capacidades?.debiles, color: 'red', icon: <ArrowDown className="h-3 w-3" /> },
                    { label: 'En crecimiento', items: evo.capacidades?.en_crecimiento, color: 'sky', icon: <TrendingUp className="h-3 w-3" /> },
                    { label: 'En riesgo', items: evo.capacidades?.en_riesgo, color: 'amber', icon: <AlertTriangle className="h-3 w-3" /> },
                  ].map(sec => (sec.items?.length ?? 0) > 0 ? (
                    <div key={sec.label} className={`rounded-xl border p-3
                      ${sec.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-900/10'
                        : sec.color === 'red' ? 'border-red-500/20 bg-red-900/10'
                        : sec.color === 'sky' ? 'border-sky-500/20 bg-sky-900/10'
                        : 'border-amber-500/20 bg-amber-900/10'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1
                        ${sec.color === 'emerald' ? 'text-emerald-400' : sec.color === 'red' ? 'text-red-400' : sec.color === 'sky' ? 'text-sky-400' : 'text-amber-400'}`}>
                        {sec.icon}{sec.label}
                      </p>
                      {sec.items!.map((item, i) => (
                        <p key={i} className="text-[11px] text-brand-text">• {item}</p>
                      ))}
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* 3. PATRONES */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold/60 mb-3">Patrones detectados</p>
                <div className="space-y-2">
                  {[
                    { label: 'Patrones activos (sigue repitiendo)', items: evo.patrones?.activos, color: 'amber' },
                    { label: 'Patrones corregidos', items: evo.patrones?.corregidos, color: 'emerald' },
                    { label: 'Patrones emergentes', items: evo.patrones?.emergentes, color: 'sky' },
                  ].filter(s => (s.items?.length ?? 0) > 0).map(sec => (
                    <div key={sec.label} className={`rounded-xl border px-4 py-3
                      ${sec.color === 'amber' ? 'border-amber-500/20 bg-amber-900/10'
                        : sec.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-900/10'
                        : 'border-sky-500/20 bg-sky-900/10'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5
                        ${sec.color === 'amber' ? 'text-amber-400' : sec.color === 'emerald' ? 'text-emerald-400' : 'text-sky-400'}`}>
                        {sec.label}
                      </p>
                      {sec.items!.map((p, i) => <p key={i} className="text-xs text-brand-text">• {p}</p>)}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. APRENDIZAJES */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold/60 mb-3">Aprendizajes</p>
                <div className="space-y-2">
                  {[
                    { label: 'Principales descubrimientos', items: evo.aprendizajes?.principales_descubrimientos, color: 'brand-gold' },
                    { label: 'Mejoras observadas', items: evo.aprendizajes?.mejoras_observadas, color: 'emerald' },
                    { label: 'Errores que se repiten', items: evo.aprendizajes?.errores_repetidos, color: 'red' },
                  ].filter(s => (s.items?.length ?? 0) > 0).map(sec => (
                    <div key={sec.label} className={`rounded-xl border px-4 py-3
                      ${sec.color === 'brand-gold' ? 'border-brand-gold/20 bg-[rgba(212,175,55,0.04)]'
                        : sec.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-900/10'
                        : 'border-red-500/20 bg-red-900/10'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5
                        ${sec.color === 'brand-gold' ? 'text-brand-gold' : sec.color === 'emerald' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {sec.label}
                      </p>
                      {sec.items!.map((a, i) => <p key={i} className="text-xs text-brand-text">• {a}</p>)}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. RECOMENDACIONES */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold/60 mb-3">Recomendaciones</p>
                <div className="space-y-2">
                  {[
                    { label: 'Qué entrenar ahora', value: evo.recomendaciones?.que_entrenar, icon: <Target className="h-3.5 w-3.5" />, color: 'brand-gold' },
                    { label: 'Clase recomendada', value: evo.recomendaciones?.clase_recomendada, icon: <Star className="h-3.5 w-3.5" />, color: 'violet' },
                    { label: 'Mentoría sugerida', value: evo.recomendaciones?.mentoria_sugerida, icon: <Brain className="h-3.5 w-3.5" />, color: 'sky' },
                  ].map(r => (
                    <div key={r.label} className={`flex items-start gap-3 rounded-xl border px-4 py-3
                      ${r.color === 'brand-gold' ? 'border-brand-gold/20 bg-[rgba(212,175,55,0.05)]'
                        : r.color === 'violet' ? 'border-violet-500/20 bg-violet-900/10'
                        : 'border-sky-500/20 bg-sky-900/10'}`}>
                      <span className={`shrink-0 mt-0.5 ${r.color === 'brand-gold' ? 'text-brand-gold' : r.color === 'violet' ? 'text-violet-400' : 'text-sky-400'}`}>
                        {r.icon}
                      </span>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5
                          ${r.color === 'brand-gold' ? 'text-brand-gold' : r.color === 'violet' ? 'text-violet-400' : 'text-sky-400'}`}>
                          {r.label}
                        </p>
                        <p className="text-xs text-brand-text leading-relaxed">{r.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. EVIDENCIA */}
              <EvidencePanel rows={stat.rows} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AdminConversacionesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserStat | null>(null);

  useEffect(() => {
    fetch('/api/admin/conversations')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d); setLoading(false); });
  }, []);

  // Group by user
  const byUser = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  const userStats: UserStat[] = [...byUser.entries()].map(([uid, userRows]) => {
    const p = userRows[0]?.profile;
    return {
      user_id: uid,
      name: p?.full_name ?? p?.email ?? 'Usuario',
      total: userRows.length,
      approved: userRows.filter(r => r.reflection?.status === 'approved').length,
      pending: userRows.filter(r => !r.reflection).length,
      total_xp: userRows.reduce((a, r) => a + (r.reflection?.xp_earned ?? 0), 0),
      rows: userRows.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  }).sort((a, b) => b.approved - a.approved || b.total - a.total);

  const filtered = userStats.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      {selected && <UserPanel stat={selected} onClose={() => setSelected(null)} />}

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Sistema 1</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Evolución por setter</h1>
        <p className="text-sm text-brand-muted mt-0.5">Seleccioná un setter para ver su diagnóstico de evolución completo.</p>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar setter..."
          className="w-full rounded-lg border border-zinc-800 bg-[#111] pl-9 pr-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/30" />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
        </div>
      ) : !filtered.length ? (
        <p className="py-20 text-center text-sm text-brand-muted">Todavía no hay conversaciones analizadas.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <button key={u.user_id} onClick={() => setSelected(u)}
              className="w-full flex items-center gap-4 rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-4 text-left hover:bg-[#111] transition">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-sm font-bold text-brand-gold">
                {u.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-text truncate">{u.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-brand-muted">
                  <span>{u.total} conversaciones</span>
                  <span className="text-emerald-400">{u.approved} reflexiones aprobadas</span>
                  {u.pending > 0 && <span className="text-amber-400">{u.pending} sin reflexión</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-brand-gold">{u.total_xp} XP</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-brand-gold/40">
                <Brain className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 text-brand-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
