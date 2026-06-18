'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Star, Clock, Users2, TrendingUp, ChevronRight, X, Search, Brain, Flame, Zap, Target, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
type SessionRow = {
  id: string; user_id: string; scenario_name: string; scenario_group: string;
  scenario_tag: string; difficulty: number; started_at: string; ended_at: string | null;
  message_count: number; evaluations_count: number; last_evaluation: string | null;
  status: string; profiles?: { full_name: string | null; email: string | null };
};

type SessionDetail = SessionRow & {
  trainer_messages: { id: string; role: string; content: string; is_evaluation: boolean; created_at: string }[];
};

type UserStat = {
  user_id: string; name: string; total_sessions: number; total_xp: number;
  week_sessions: number; week_xp: number; streak: number; max_difficulty: number;
  groups: Record<string, number>; sessions: SessionRow[];
};

type Analysis = {
  resumen: string; fortalezas: string[]; areas_mejora: string[];
  patrones_detectados: string[]; cuellos_botella: string[];
  proximo_nivel: string; escenario_recomendado: string;
};

// ── Helpers ────────────────────────────────────────────────────────
function xp(s: SessionRow) {
  let p = s.difficulty * 5;
  if (s.evaluations_count > 0) p += 5;
  if (s.message_count >= 8) p += 5;
  return p;
}

function streak(sessions: SessionRow[]): number {
  const dates = [...new Set(sessions.map(s => s.started_at.slice(0, 10)))].sort().reverse();
  if (!dates.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dates[0] !== today && dates[0] !== yest) return 0;
  let n = 1;
  for (let i = 1; i < dates.length; i++) {
    if ((new Date(dates[i-1]).getTime() - new Date(dates[i]).getTime()) / 86_400_000 === 1) n++;
    else break;
  }
  return n;
}

function gColor(g: string) {
  return g === 'FRÍA' ? 'text-sky-400' : g === 'TIBIA' ? 'text-amber-400' : 'text-red-400';
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ── Detail panel ──────────────────────────────────────────────────
function SessionDetailPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData] = useState<SessionDetail | null>(null);
  useEffect(() => {
    fetch(`/api/trainer/sessions/${sessionId}`).then(r => r.json()).then(setData);
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-[#090909] border-l border-[rgba(212,175,55,0.15)] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.1)] px-5 py-4">
          <MessageSquare className="h-4 w-4 text-brand-gold shrink-0" />
          <p className="flex-1 font-semibold text-brand-text truncate">{data?.scenario_name ?? '...'}</p>
          <button onClick={onClose}><X className="h-4 w-4 text-brand-muted" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {data ? (
            <>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-muted mb-4">
                <span className={`font-bold ${gColor(data.scenario_group)}`}>{data.scenario_group}</span>
                <span>· {data.scenario_tag} · Dif. {data.difficulty}/10</span>
                <span>· {fmt(data.started_at)}</span>
                <span>· {data.message_count} msgs</span>
                {data.evaluations_count > 0 && <span className="text-brand-gold">· {data.evaluations_count} evaluación{data.evaluations_count > 1 ? 'es' : ''}</span>}
              </div>
              {(data.trainer_messages ?? []).map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                    ${m.role === 'user' ? 'rounded-br-sm bg-brand-gold text-black'
                      : m.is_evaluation ? 'rounded-bl-sm border border-emerald-500/30 bg-emerald-900/20 text-emerald-300'
                      : 'rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] text-brand-text'}`}>
                    {m.is_evaluation && <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Evaluación</p>}
                    {m.content}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-gold" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── User panel ─────────────────────────────────────────────────────
function UserPanel({ stat, onClose }: { stat: UserStat; onClose: () => void }) {
  const [detail, setDetail] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function runAnalysis() {
    setAnalyzing(true); setAnalyzeError('');
    try {
      const r = await fetch('/api/admin/trainer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: stat.user_id }),
      });
      const d = await r.json();
      if (d.error) setAnalyzeError(d.error);
      else setAnalysis(d.analysis);
    } catch (e: any) {
      setAnalyzeError(e?.message ?? 'Error de red');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <>
      {detail && <SessionDetailPanel sessionId={detail} onClose={() => setDetail(null)} />}

      <div className="fixed inset-0 z-40 flex justify-end">
        <button onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative flex h-full w-full max-w-xl flex-col bg-[#090909] border-l border-[rgba(212,175,55,0.15)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.1)] px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-sm font-bold text-brand-gold">
              {stat.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-brand-text truncate">{stat.name}</p>
              <p className="text-xs text-brand-muted">{stat.total_sessions} sesiones · {stat.total_xp} XP total</p>
            </div>
            <button onClick={onClose}><X className="h-4 w-4 text-brand-muted" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, label: 'XP semana', value: stat.week_xp },
                { icon: <Target className="h-3.5 w-3.5" />, label: 'Sesiones', value: stat.total_sessions },
                { icon: <Flame className="h-3.5 w-3.5" />, label: 'Racha', value: `${stat.streak}d` },
                { icon: <Star className="h-3.5 w-3.5" />, label: 'Max dif.', value: `${stat.max_difficulty}/10` },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-3 text-center">
                  <div className="flex justify-center mb-1 text-brand-gold/40">{s.icon}</div>
                  <p className="text-lg font-bold text-brand-gold">{s.value}</p>
                  <p className="text-[10px] text-brand-muted">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Análisis IA */}
            <div className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.03)]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-brand-gold" />
                  <p className="text-sm font-semibold text-brand-text">Análisis IA con cerebro CAC</p>
                </div>
                {!analysis ? (
                  <button onClick={runAnalysis} disabled={analyzing}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-brand-gold/90 disabled:opacity-60 transition">
                    {analyzing ? <><Loader2 className="h-3 w-3 animate-spin" /> Analizando...</> : 'Analizar'}
                  </button>
                ) : (
                  <button onClick={() => setAnalysis(null)} className="text-xs text-brand-muted hover:text-brand-text">Borrar</button>
                )}
              </div>

              {analyzeError && <p className="px-4 pb-3 text-xs text-red-400">{analyzeError}</p>}

              {analysis && (
                <div className="px-4 pb-4 space-y-4 border-t border-[rgba(212,175,55,0.1)]">
                  <p className="text-sm text-brand-text leading-relaxed pt-3">{analysis.resumen}</p>

                  {[
                    { label: 'Fortalezas', items: analysis.fortalezas, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/20' },
                    { label: 'Áreas a mejorar', items: analysis.areas_mejora, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-500/20' },
                    { label: 'Patrones detectados', items: analysis.patrones_detectados, color: 'text-sky-400', bg: 'bg-sky-900/20 border-sky-500/20' },
                    { label: 'Cuellos de botella', items: analysis.cuellos_botella, color: 'text-red-400', bg: 'bg-red-900/20 border-red-500/20' },
                  ].map(sec => (
                    <div key={sec.label}>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${sec.color} mb-2`}>{sec.label}</p>
                      <ul className="space-y-1">
                        {(sec.items ?? []).map((item, i) => (
                          <li key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${sec.bg} text-brand-text`}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div className="rounded-lg border border-brand-gold/20 bg-[rgba(212,175,55,0.05)] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gold mb-1">Próximo nivel</p>
                    <p className="text-sm text-brand-text leading-relaxed">{analysis.proximo_nivel}</p>
                  </div>

                  <div className="rounded-lg border border-violet-500/20 bg-violet-900/10 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-1">Escenario recomendado</p>
                    <p className="text-sm text-brand-text">{analysis.escenario_recomendado}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sesiones */}
            <div>
              <button onClick={() => setExpanded(v => !v)}
                className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-brand-muted hover:text-brand-text">
                <span>Historial de sesiones ({stat.sessions.length})</span>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {expanded && (
                <div className="space-y-2 mt-2">
                  {stat.sessions.map(s => (
                    <button key={s.id} onClick={() => setDetail(s.id)}
                      className="w-full flex items-center gap-3 rounded-xl border border-[rgba(212,175,55,0.08)] bg-[#0d0d0d] px-4 py-3 text-left hover:bg-[#111] transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-bold ${gColor(s.scenario_group)}`}>{s.scenario_group}</span>
                          <span className="text-[10px] text-brand-muted/60">{s.scenario_tag} · Dif. {s.difficulty}</span>
                        </div>
                        <p className="text-sm text-brand-text truncate">{s.scenario_name}</p>
                        <div className="flex gap-3 mt-0.5 text-[11px] text-brand-muted">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(s.started_at)}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{s.message_count}</span>
                          {s.evaluations_count > 0 && <span className="flex items-center gap-1 text-brand-gold"><Star className="h-3 w-3" />{s.evaluations_count}</span>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-brand-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Página principal ───────────────────────────────────────────────
export default function AdminTrainerHistorial() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserStat | null>(null);

  useEffect(() => {
    fetch('/api/admin/trainer/sessions')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSessions(d); setLoading(false); });
  }, []);

  // Agrupar por usuario
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const byUser = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  const userStats: UserStat[] = [...byUser.entries()].map(([uid, userSessions]) => {
    const p = userSessions[0]?.profiles;
    const name = p?.full_name ?? p?.email ?? 'Usuario';
    const totalXP = userSessions.reduce((a, s) => a + xp(s), 0);
    const weekSessions = userSessions.filter(s => s.started_at >= weekAgo);
    const weekXP = weekSessions.reduce((a, s) => a + xp(s), 0);
    const maxDiff = Math.max(...userSessions.map(s => s.difficulty));
    const groups: Record<string, number> = { FRÍA: 0, TIBIA: 0, CALIENTE: 0 };
    for (const s of userSessions) if (s.scenario_group in groups) groups[s.scenario_group]++;
    return { user_id: uid, name, total_sessions: userSessions.length, total_xp: totalXP, week_sessions: weekSessions.length, week_xp: weekXP, streak: streak(userSessions), max_difficulty: maxDiff, groups, sessions: userSessions.sort((a, b) => b.started_at.localeCompare(a.started_at)) };
  }).sort((a, b) => b.week_xp - a.week_xp || b.total_xp - a.total_xp);

  const filtered = userStats.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((a, s) => a + s.message_count, 0);
  const totalEvals    = sessions.reduce((a, s) => a + s.evaluations_count, 0);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      {selectedUser && <UserPanel stat={selectedUser} onClose={() => setSelectedUser(null)} />}

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Trainer</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Historial de entrenamientos</h1>
        <p className="text-sm text-brand-muted mt-0.5">Métricas por usuario · Análisis IA con cerebro CAC</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <Users2 className="h-4 w-4" />, label: 'Usuarios activos', value: userStats.length },
          { icon: <TrendingUp className="h-4 w-4" />, label: 'Sesiones totales', value: totalSessions },
          { icon: <MessageSquare className="h-4 w-4" />, label: 'Mensajes totales', value: totalMessages },
          { icon: <Star className="h-4 w-4" />, label: 'Evaluaciones', value: totalEvals },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] p-4">
            <div className="flex items-center gap-2 mb-2 text-brand-gold/50">{s.icon}</div>
            <p className="text-2xl font-bold text-brand-gold">{s.value}</p>
            <p className="text-[11px] text-brand-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuario..."
          className="w-full rounded-lg border border-zinc-800 bg-[#111] pl-9 pr-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/30" />
      </div>

      {/* Lista por usuario */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
        </div>
      ) : !filtered.length ? (
        <p className="py-16 text-center text-sm text-brand-muted">No hay sesiones todavía.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u, i) => (
            <button key={u.user_id} onClick={() => setSelectedUser(u)}
              className="w-full flex items-center gap-4 rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-4 text-left hover:bg-[#111] transition">
              {/* Rank */}
              <span className={`w-8 shrink-0 text-center text-sm font-black ${i === 0 ? 'text-brand-gold' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-700' : 'text-brand-muted'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
              </span>
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-sm font-bold text-brand-gold">
                {u.name[0]?.toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-text truncate">{u.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-brand-muted">
                  <span>{u.total_sessions} sesiones</span>
                  <span>Max dif. {u.max_difficulty}/10</span>
                  {u.streak > 1 && <span className="flex items-center gap-0.5 text-orange-400"><Flame className="h-3 w-3" />{u.streak}d</span>}
                  <span className="text-xs text-brand-muted">
                    🧊{u.groups['FRÍA']} 🌡️{u.groups['TIBIA']} 🔥{u.groups['CALIENTE']}
                  </span>
                </div>
              </div>
              {/* XP */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-brand-gold">{u.week_xp} <span className="text-[10px] font-normal">XP/sem</span></p>
                <p className="text-[11px] text-brand-muted">{u.total_xp} XP total</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Brain className="h-3.5 w-3.5 text-brand-gold/40" />
                <ChevronRight className="h-4 w-4 text-brand-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
