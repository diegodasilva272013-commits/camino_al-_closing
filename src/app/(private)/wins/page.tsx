'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, Plus, Trash2, Upload, X, ImageIcon, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type TeamWin    = { id: string; title: string; description: string | null; image_url: string | null; posted_by: string | null; created_at: string };
type PersonalWin = { id: string; user_id: string; content: string; created_at: string };
type Profile    = { id: string; full_name: string | null; avatar_url: string | null; role: string };

function Avatar({ profile, size = 'md' }: { profile?: Profile; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';
  const letter = (profile?.full_name?.charAt(0) ?? '?').toUpperCase();
  return (
    <div className={cn('shrink-0 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center font-bold text-zinc-400', sz)}>
      {profile?.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        : letter}
    </div>
  );
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function WinsPage() {
  const [teamWins,     setTeamWins]     = useState<TeamWin[]>([]);
  const [personalWins, setPersonalWins] = useState<PersonalWin[]>([]);
  const [profiles,     setProfiles]     = useState<Profile[]>([]);
  const [myId,         setMyId]         = useState('');
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [loading,      setLoading]      = useState(true);

  // form personal win
  const [text,         setText]         = useState('');
  const [posting,      setPosting]      = useState(false);

  // form team win (admin)
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [twTitle,      setTwTitle]      = useState('');
  const [twDesc,       setTwDesc]       = useState('');
  const [twFile,       setTwFile]       = useState<File | null>(null);
  const [twPreview,    setTwPreview]    = useState<string | null>(null);
  const [twUploading,  setTwUploading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [winsRes, meRes] = await Promise.all([
      fetch('/api/wins').then(r => r.json()).catch(() => ({})),
      fetch('/api/profile/me').then(r => r.json()).catch(() => ({})),
    ]);
    setTeamWins(winsRes.teamWins     ?? []);
    setPersonalWins(winsRes.personalWins ?? []);
    setProfiles(winsRes.profiles      ?? []);
    setMyId(meRes.id   ?? '');
    setIsAdmin(meRes.role === 'admin');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  async function postPersonalWin() {
    if (!text.trim()) return;
    setPosting(true);
    await fetch('/api/wins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.trim() }),
    });
    setText('');
    setPosting(false);
    load();
  }

  async function deletePersonalWin(id: string) {
    await fetch('/api/wins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setPersonalWins(prev => prev.filter(w => w.id !== id));
  }

  async function postTeamWin() {
    if (!twTitle.trim()) return;
    setTwUploading(true);
    let image_url: string | null = null;

    if (twFile) {
      const fd = new FormData();
      fd.append('file', twFile);
      const res = await fetch('/api/admin/wins/upload', { method: 'POST', body: fd }).then(r => r.json());
      image_url = res.url ?? null;
    }

    await fetch('/api/admin/wins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: twTitle.trim(), description: twDesc.trim() || null, image_url }),
    });

    setTwTitle(''); setTwDesc(''); setTwFile(null); setTwPreview(null);
    setShowTeamForm(false);
    setTwUploading(false);
    load();
  }

  async function deleteTeamWin(id: string) {
    await fetch('/api/admin/wins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setTeamWins(prev => prev.filter(w => w.id !== id));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setTwFile(f);
    setTwPreview(URL.createObjectURL(f));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" /> Muro de Wins
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Logros del equipo y personales</p>
        </div>
        <button onClick={load} disabled={loading}
          className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:text-zinc-300 transition">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── WINS DEL EQUIPO ─────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-yellow-400 flex items-center gap-1.5">
                  🏆 Wins del Equipo
                </p>
                <p className="text-[11px] text-zinc-600">Comprobantes de pago — publicados por coordinación</p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowTeamForm(v => !v)}
                  className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition',
                    showTeamForm
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-yellow-500 text-black hover:bg-yellow-400')}>
                  {showTeamForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {showTeamForm ? 'Cancelar' : 'Publicar win'}
                </button>
              )}
            </div>

            {/* Form admin */}
            {isAdmin && showTeamForm && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
                <input value={twTitle} onChange={e => setTwTitle(e.target.value)}
                  placeholder="Título del win — ej: Cynthia cerró su primer cliente 🎉"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600" />
                <textarea value={twDesc} onChange={e => setTwDesc(e.target.value)} rows={2}
                  placeholder="Descripción opcional..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none" />

                {/* Upload imagen */}
                <div>
                  {twPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-zinc-700">
                      <img src={twPreview} alt="" className="w-full max-h-64 object-contain bg-zinc-950" />
                      <button onClick={() => { setTwFile(null); setTwPreview(null); }}
                        className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full rounded-xl border border-dashed border-zinc-700 py-5 flex flex-col items-center gap-1.5 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-xs">Subir comprobante de pago</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>

                <button onClick={postTeamWin} disabled={twUploading || !twTitle.trim()}
                  className="w-full rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {twUploading ? <><Upload className="h-4 w-4 animate-bounce" /> Publicando...</> : '🏆 Publicar win del equipo'}
                </button>
              </div>
            )}

            {/* Feed team wins */}
            {teamWins.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 py-10 text-center">
                <p className="text-sm text-zinc-600">Pronto aparecerán los primeros wins del equipo 💪</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamWins.map(win => {
                  const poster = win.posted_by ? profileMap.get(win.posted_by) : undefined;
                  return (
                    <div key={win.id} className="rounded-2xl border border-yellow-500/15 bg-gradient-to-br from-yellow-950/20 to-zinc-900/40 overflow-hidden">
                      {win.image_url && (
                        <div className="relative w-full max-h-72 bg-zinc-950">
                          <img src={win.image_url} alt={win.title} className="w-full object-contain max-h-72" />
                        </div>
                      )}
                      <div className="px-4 py-3 space-y-2">
                        <p className="text-sm font-bold text-yellow-300">{win.title}</p>
                        {win.description && <p className="text-xs text-zinc-400 leading-relaxed">{win.description}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar profile={poster} size="sm" />
                            <span className="text-[11px] text-zinc-500">{poster?.full_name ?? 'Coordinación CAC'} · {timeAgo(win.created_at)}</span>
                          </div>
                          {isAdmin && (
                            <button onClick={() => deleteTeamWin(win.id)}
                              className="text-zinc-700 hover:text-red-400 transition p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── WINS PERSONALES ─────────────────────────────────────── */}
          <section className="space-y-3">
            <div>
              <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                ✨ Wins Personales
              </p>
              <p className="text-[11px] text-zinc-600">Compartí tu logro del día — cualquier tipo de win cuenta</p>
            </div>

            {/* Form cualquier usuario */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-2">
              <div className="flex items-start gap-2.5">
                <Avatar profile={profileMap.get(myId)} />
                <textarea value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postPersonalWin(); }}
                  placeholder="¿Cuál fue tu win de hoy? Puede ser cualquier logro personal, de mentalidad, de proceso..."
                  rows={2}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none" />
              </div>
              <div className="flex justify-end">
                <button onClick={postPersonalWin} disabled={posting || !text.trim()}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 transition">
                  {posting ? 'Publicando...' : 'Compartir win ✨'}
                </button>
              </div>
            </div>

            {/* Feed personal wins */}
            {personalWins.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 py-10 text-center">
                <p className="text-sm text-zinc-600">Sé el primero en compartir tu win del día 🚀</p>
              </div>
            ) : (
              <div className="space-y-2">
                {personalWins.map(win => {
                  const author  = profileMap.get(win.user_id);
                  const isOwn   = win.user_id === myId;
                  return (
                    <div key={win.id}
                      className={cn('rounded-2xl border px-4 py-3 flex items-start gap-3',
                        isOwn ? 'border-emerald-700/25 bg-emerald-950/15' : 'border-zinc-800/60 bg-zinc-900/20')}>
                      <Avatar profile={author} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-xs font-semibold', isOwn ? 'text-emerald-400' : 'text-white')}>
                            {author?.full_name ?? 'Usuario'}
                            {isOwn && <span className="ml-1 text-[10px] text-emerald-500/70 font-normal">(vos)</span>}
                          </span>
                          <span className="text-[10px] text-zinc-600">{timeAgo(win.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{win.content}</p>
                      </div>
                      {(isOwn || isAdmin) && (
                        <button onClick={() => deletePersonalWin(win.id)}
                          className="shrink-0 text-zinc-700 hover:text-red-400 transition p-1 mt-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
