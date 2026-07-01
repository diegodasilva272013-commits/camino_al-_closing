'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Strike = {
  id: string;
  setter_id: string;
  issued_by: string | null;
  reason: string;
  category: string | null;
  severity: number;
  created_at: string;
};

type Profile = { id: string; full_name: string | null; email: string; role: string; avatar_url?: string | null };

const CATEGORY_LABELS: Record<string, string> = {
  puntualidad:  'Puntualidad',
  conducta:     'Conducta',
  rendimiento:  'Rendimiento',
  comunicacion: 'Comunicación',
  otro:         'Otro',
};

const SEV: Record<number, { label: string; cls: string; dot: string }> = {
  1: { label: '⚠ Aviso',          cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-600/40', dot: 'bg-yellow-400' },
  2: { label: '⚠⚠ Advertencia',   cls: 'bg-orange-500/15 text-orange-400 border-orange-600/40', dot: 'bg-orange-400' },
  3: { label: '⛔ Strike Grave',   cls: 'bg-red-500/15    text-red-400    border-red-600/40',    dot: 'bg-red-500' },
};

function Avatar({ profile, size = 'md' }: { profile: Profile | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-xs';
  const letter = (profile?.full_name?.charAt(0) ?? '?').toUpperCase();
  return (
    <div className={cn('shrink-0 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center font-bold text-zinc-400', cls)}>
      {profile?.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        : letter}
    </div>
  );
}

export default function StrikesPage() {
  const [strikes,   setStrikes]  = useState<Strike[]>([]);
  const [profiles,  setProfiles] = useState<Profile[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [myId,      setMyId]     = useState('');
  const [expanded,  setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [dataRes, meRes] = await Promise.all([
      fetch('/api/strikes').then(r => r.json()).catch(() => ({})),
      fetch('/api/profile/me').then(r => r.json()).catch(() => ({})),
    ]);
    setStrikes(dataRes.strikes  ?? []);
    setProfiles(dataRes.profiles ?? []);
    setMyId(meRes.id ?? '');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const setterProfiles = useMemo(() => profiles.filter(p => p.role === 'setter'), [profiles]);

  const bySetterTotal = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of strikes) m[s.setter_id] = (m[s.setter_id] ?? 0) + 1;
    return m;
  }, [strikes]);

  const ranked = useMemo(() =>
    [...setterProfiles].sort((a, b) => (bySetterTotal[b.id] ?? 0) - (bySetterTotal[a.id] ?? 0)),
  [setterProfiles, bySetterTotal]);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Strikes del Equipo
          </h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">Registro de advertencias — visible para todos</p>
        </div>
        <button onClick={load} disabled={loading}
          className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Scoreboard con fotos */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Estado del equipo</span>
            </div>
            {ranked.length === 0
              ? <p className="text-xs text-zinc-600 text-center py-8">Sin setters aún</p>
              : ranked.map((setter, i) => {
                const total = bySetterTotal[setter.id] ?? 0;
                const isMe  = setter.id === myId;
                return (
                  <div key={setter.id}
                    className={cn('flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40 last:border-b-0',
                      isMe && 'bg-yellow-950/10')}>
                    <span className="text-[11px] text-zinc-600 font-bold w-5 shrink-0 text-right">{i + 1}</span>
                    <Avatar profile={setter} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold truncate', isMe ? 'text-brand-gold' : 'text-white')}>
                        {setter.full_name ?? setter.email}
                        {isMe && <span className="ml-1 text-[10px] text-brand-gold/60 font-normal">vos</span>}
                      </p>
                      {total > 0 ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: Math.min(total, 5) }).map((_, j) => (
                            <span key={j} className={cn('h-2 w-2 rounded-full',
                              total >= 3 ? 'bg-red-500' : total === 2 ? 'bg-orange-400' : 'bg-yellow-400')} />
                          ))}
                          {total > 5 && <span className="text-[10px] text-zinc-500">+{total-5}</span>}
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-600 mt-0.5">Sin strikes ✓</p>
                      )}
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold border',
                      total === 0 ? 'bg-zinc-800/50 text-zinc-600 border-zinc-700'
                        : total >= 3 ? 'bg-red-500/15 text-red-400 border-red-600/40'
                        : 'bg-yellow-500/15 text-yellow-400 border-yellow-600/40')}>
                      {total}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Historial */}
          <div>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Historial ({strikes.length})
            </p>

            {strikes.length === 0
              ? (
                <div className="rounded-2xl border border-zinc-800 flex flex-col items-center py-12 gap-2">
                  <Shield className="h-7 w-7 text-zinc-700" />
                  <p className="text-xs text-zinc-600">Equipo sin strikes. Sigan así 💪</p>
                </div>
              )
              : (
                <div className="space-y-2">
                  {strikes.map(strike => {
                    const setter = profileMap.get(strike.setter_id);
                    const issuer = strike.issued_by ? profileMap.get(strike.issued_by) : null;
                    const sev    = SEV[strike.severity] ?? SEV[1];
                    const open   = expanded === strike.id;
                    const isMe   = strike.setter_id === myId;
                    return (
                      <div key={strike.id}
                        className={cn('rounded-2xl border transition-all',
                          open ? 'border-zinc-700' : 'border-zinc-800/60',
                          isMe && 'border-yellow-700/30 bg-yellow-950/8')}>
                        <button onClick={() => setExpanded(open ? null : strike.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left">
                          <Avatar profile={setter} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-white">
                                {setter?.full_name ?? setter?.email ?? '—'}
                                {isMe && <span className="ml-1 text-[10px] text-brand-gold/70">(vos)</span>}
                              </span>
                              <span className={cn('text-[10px] font-semibold rounded-full px-1.5 py-0.5 border', sev.cls)}>
                                {sev.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{strike.reason}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                              {new Date(strike.created_at).toLocaleDateString('es-AR')}
                            </span>
                            {open ? <ChevronUp className="h-3.5 w-3.5 text-zinc-600" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />}
                          </div>
                        </button>
                        {open && (
                          <div className="border-t border-zinc-800 px-4 py-3 space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-zinc-600">Categoría</p>
                                <p className="text-zinc-300">{CATEGORY_LABELS[strike.category ?? 'otro'] ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-zinc-600">Fecha</p>
                                <p className="text-zinc-300">{new Date(strike.created_at).toLocaleString('es-AR')}</p>
                              </div>
                              <div>
                                <p className="text-zinc-600">Emitido por</p>
                                <p className="text-zinc-300">{issuer?.full_name ?? 'Coordinación CAC'}</p>
                              </div>
                            </div>
                            <p className="text-zinc-400 bg-zinc-900/60 rounded-xl px-3 py-2 leading-relaxed">
                              {strike.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}
