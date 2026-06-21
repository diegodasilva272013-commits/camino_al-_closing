'use client';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Lead = { id: string; first_name: string; last_name: string | null; phone: string; country: string | null; status: string };
type Setter = { id: string; full_name: string; email: string };
type ConvMessage = { direction: 'outbound' | 'inbound'; body: string; sent_at: string };
type Conversation = {
  id: string; lead_id: string; setter_id: string; status: string; last_message_at: string | null;
  leads: Lead; profiles: Setter;
  last_message: { direction: string; body: string; sent_at: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; color: string }> = {
  responded:        { label: 'Respondió',       dot: 'bg-emerald-400', color: 'text-emerald-400' },
  waiting_response: { label: 'Sin respuesta',   dot: 'bg-yellow-500',  color: 'text-yellow-400' },
  open:             { label: 'Abierta',          dot: 'bg-sky-400',     color: 'text-sky-400' },
  scheduled:        { label: 'Agendada',         dot: 'bg-violet-400',  color: 'text-violet-400' },
  closed:           { label: 'Cerrada',          dot: 'bg-zinc-600',    color: 'text-zinc-500' },
  lost:             { label: 'Perdida',          dot: 'bg-red-500',     color: 'text-red-400' },
};

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Ayer';
  if (diff < 7) return d.toLocaleDateString('es-AR', { weekday: 'short' });
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function AdminInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filterSetter, setFilterSetter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [setters, setSetters] = useState<{ id: string; full_name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSetter) params.set('setter_id', filterSetter);
      if (filterStatus) params.set('status', filterStatus);
      const r = await fetch(`/api/admin/inbox?${params}`);
      const d = await r.json();
      if (Array.isArray(d)) {
        setConversations(d);
        // Extract unique setters
        const seen = new Set<string>();
        const s: { id: string; full_name: string }[] = [];
        for (const c of d) {
          if (c.profiles && !seen.has(c.profiles.id)) {
            seen.add(c.profiles.id);
            s.push({ id: c.profiles.id, full_name: c.profiles.full_name ?? c.profiles.email });
          }
        }
        setSetters(s);
      }
    } catch {}
    setLoading(false);
  }, [filterSetter, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function openConversation(conv: Conversation) {
    setSelected(conv);
    setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/admin/inbox/${conv.id}/messages`);
      const d = await r.json();
      if (Array.isArray(d)) setMessages(d);
    } catch {}
    setLoadingMsgs(false);
  }

  const unread = conversations.filter(c => c.status === 'responded').length;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#080808]">
      {/* Left panel */}
      <div className={cn('flex flex-col border-r border-zinc-800/60 shrink-0',
        selected ? 'hidden md:flex md:w-80 lg:w-96' : 'w-full md:w-80 lg:w-96')}>

        <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin</p>
              <h1 className="text-xl font-bold text-brand-text">Inbox global</h1>
            </div>
            {unread > 0 && <span className="rounded-full bg-emerald-500 text-[10px] font-black text-black px-2 py-0.5">{unread} nuevas</span>}
          </div>

          <select value={filterSetter} onChange={e => setFilterSetter(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:outline-none">
            <option value="">Todos los setters</option>
            {setters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:outline-none">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <MessageSquare className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">Sin conversaciones.</p>
            </div>
          ) : (
            conversations.map(conv => {
              const cfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG['open'];
              const isSelected = selected?.id === conv.id;
              const isUnread = conv.status === 'responded';
              return (
                <button key={conv.id} onClick={() => openConversation(conv)}
                  className={cn('w-full text-left px-4 py-3.5 border-b border-zinc-800/40 transition hover:bg-zinc-900/60',
                    isSelected && 'bg-zinc-900 border-l-2 border-l-brand-gold')}>
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', cfg.dot, !isUnread && 'opacity-40')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-sm font-semibold truncate', isUnread ? 'text-white' : 'text-zinc-300')}>
                          {conv.leads.first_name} {conv.leads.last_name ?? ''}
                        </p>
                        <span className="text-[10px] text-zinc-600 shrink-0">{fmtTime(conv.last_message_at)}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Setter: {conv.profiles?.full_name ?? conv.profiles?.email ?? '—'}</p>
                      {conv.last_message && (
                        <p className={cn('text-xs mt-0.5 truncate', isUnread && conv.last_message.direction === 'inbound' ? 'text-emerald-300' : 'text-zinc-500')}>
                          {conv.last_message.direction === 'outbound' ? '↗ ' : '↙ '}{conv.last_message.body}
                        </p>
                      )}
                      <span className={cn('text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — read-only conversation view */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-bold text-brand-text">
                  {selected.leads.first_name} {selected.leads.last_name ?? ''}
                  <span className="ml-2 text-[10px] font-normal text-zinc-500">via {selected.profiles?.full_name}</span>
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">{selected.leads.phone} {selected.leads.country ? `· ${selected.leads.country}` : ''}</p>
              </div>
            </div>
            <span className={cn('text-xs font-semibold', STATUS_CONFIG[selected.status]?.color ?? 'text-zinc-400')}>
              {STATUS_CONFIG[selected.status]?.label ?? selected.status}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {loadingMsgs ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-brand-gold" /></div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-zinc-600 italic text-center py-8">Sin mensajes registrados en esta conversación.</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn('rounded-xl px-3 py-2 text-sm max-w-[80%]',
                  m.direction === 'outbound'
                    ? 'ml-auto bg-emerald-900/30 border border-emerald-700/25 text-emerald-100'
                    : 'bg-zinc-800/60 border border-zinc-700/30 text-zinc-200')}>
                  <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  <p className="text-[9px] text-zinc-600 mt-1">
                    {m.direction === 'outbound' ? 'Setter' : 'Lead'} · {new Date(m.sent_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Seleccioná una conversación para verla</p>
          </div>
        </div>
      )}
    </div>
  );
}
