'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Star, Clock, Users2, TrendingUp, ChevronRight, X, Search } from 'lucide-react';

type SessionRow = {
  id: string;
  user_id: string;
  scenario_name: string;
  scenario_group: string;
  scenario_tag: string;
  difficulty: number;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  evaluations_count: number;
  last_evaluation: string | null;
  status: string;
  profiles?: { full_name: string | null; email: string | null };
};

type SessionDetail = SessionRow & {
  trainer_messages: { id: string; role: string; content: string; is_evaluation: boolean; created_at: string }[];
};

function gColor(g: string) {
  if (g === 'FRÍA') return 'text-sky-400';
  if (g === 'TIBIA') return 'text-amber-400';
  return 'text-red-400';
}

function fmtDuration(start: string, end: string | null) {
  if (!end) return 'en curso';
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function DetailPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trainer/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-[#090909] border-l border-[rgba(212,175,55,0.15)] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.1)] px-5 py-4">
          <MessageSquare className="h-4 w-4 text-brand-gold shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-brand-text truncate">{data?.scenario_name ?? '...'}</p>
            <p className="text-xs text-brand-muted">{(data as any)?.profiles?.full_name ?? (data as any)?.profiles?.email ?? '...'}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-brand-muted hover:text-brand-text"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-muted mb-4">
              <span className={`font-bold ${gColor(data.scenario_group)}`}>{data.scenario_group}</span>
              <span>·</span><span>{data.scenario_tag}</span>
              <span>·</span><span>Dif. {data.difficulty}/10</span>
              <span>·</span><span>{new Date(data.started_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
              <span>·</span><span>{fmtDuration(data.started_at, data.ended_at)}</span>
              <span>·</span><span>{data.message_count} msgs</span>
              {data.evaluations_count > 0 && <><span>·</span><span className="text-brand-gold">{data.evaluations_count} evaluación{data.evaluations_count > 1 ? 'es' : ''}</span></>}
            </div>

            {(data.trainer_messages ?? []).map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'rounded-br-sm bg-brand-gold text-black'
                    : msg.is_evaluation
                      ? 'rounded-bl-sm border border-emerald-500/30 bg-emerald-900/20 text-emerald-300'
                      : 'rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] text-brand-text'
                  }`}>
                  {msg.is_evaluation && <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Evaluación</p>}
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-brand-muted">No se pudo cargar.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminTrainerHistorial() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/trainer/sessions')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSessions(d); setLoading(false); });
  }, []);

  const filtered = sessions.filter(s => {
    const name = ((s as any).profiles?.full_name ?? (s as any).profiles?.email ?? '').toLowerCase();
    const scenario = s.scenario_name.toLowerCase();
    const q = search.toLowerCase();
    return (!q || name.includes(q) || scenario.includes(q))
      && (!filterGroup || s.scenario_group === filterGroup);
  });

  const totalSessions  = sessions.length;
  const totalMessages  = sessions.reduce((a, s) => a + s.message_count, 0);
  const totalEvals     = sessions.reduce((a, s) => a + s.evaluations_count, 0);
  const uniqueUsers    = new Set(sessions.map(s => s.user_id)).size;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      {detailId && <DetailPanel sessionId={detailId} onClose={() => setDetailId(null)} />}

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Trainer</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Historial de entrenamientos</h1>
        <p className="text-sm text-brand-muted mt-0.5">Todas las sesiones del equipo — conversaciones completas</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <TrendingUp className="h-4 w-4" />, label: 'Sesiones', value: totalSessions },
          { icon: <Users2 className="h-4 w-4" />, label: 'Usuarios activos', value: uniqueUsers },
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por usuario o escenario..."
            className="w-full rounded-lg border border-zinc-800 bg-[#111] pl-9 pr-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/30" />
        </div>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-[#111] px-3 py-2 text-sm text-brand-muted focus:outline-none focus:border-brand-gold/30">
          <option value="">Todos los grupos</option>
          <option value="FRÍA">Prospección Fría</option>
          <option value="TIBIA">Prospección Tibia</option>
          <option value="CALIENTE">Prospección Caliente</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-brand-muted">No hay sesiones todavía.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <button key={s.id} onClick={() => setDetailId(s.id)}
              className="w-full flex items-center gap-4 rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 text-left hover:bg-[#111] transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-brand-text">
                    {(s as any).profiles?.full_name ?? (s as any).profiles?.email ?? 'Usuario'}
                  </span>
                  <span className={`text-xs font-bold ${gColor(s.scenario_group)}`}>{s.scenario_group}</span>
                  <span className="text-[10px] text-brand-muted/60 border border-[rgba(212,175,55,0.15)] rounded px-1.5">{s.scenario_tag}</span>
                </div>
                <p className="text-sm text-brand-muted truncate">{s.scenario_name} — Dif. {s.difficulty}/10</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-brand-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(s.started_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                  <span>{fmtDuration(s.started_at, s.ended_at)}</span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {s.message_count}
                  </span>
                  {s.evaluations_count > 0 && (
                    <span className="flex items-center gap-1 text-brand-gold">
                      <Star className="h-3 w-3" /> {s.evaluations_count}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-brand-muted shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
