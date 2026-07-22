'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, MessageSquare, Clock, CheckCheck, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationPanel } from '@/app/(private)/leads/_components/ConversationPanel';
import { ContactModal } from '@/app/(private)/leads/_components/ContactModal';

type Lead = { id: string; first_name: string; last_name: string | null; phone: string; country: string | null; status: string; notes: string | null };
type Conversation = {
  id: string; lead_id: string; status: string; last_message_at: string | null;
  leads: Lead;
  last_message: { direction: string; body: string; sent_at: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  responded:        { label: 'Respondió',       color: 'text-emerald-400', dot: 'bg-emerald-400' },
  waiting_response: { label: 'Sin respuesta',   color: 'text-yellow-400',  dot: 'bg-yellow-500' },
  open:             { label: 'Abierta',          color: 'text-sky-400',     dot: 'bg-sky-400' },
  scheduled:        { label: 'Reunión agendada', color: 'text-violet-400',  dot: 'bg-violet-400' },
  closed:           { label: 'Cerrada',          color: 'text-zinc-500',    dot: 'bg-zinc-600' },
  lost:             { label: 'Perdida',          color: 'text-red-400',     dot: 'bg-red-500' },
};

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return d.toLocaleDateString('es-AR', { weekday: 'short' });
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function InboxPageInner() {
  const searchParams = useSearchParams();
  const convIdParam = searchParams.get('conv');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [setterName, setSetterName] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/inbox/conversations');
      const d = await r.json();
      if (Array.isArray(d)) setConversations(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch('/api/profile/me').then(r => r.json()).then(d => setSetterName(d.full_name ?? d.email ?? ''));
  }, [load]);

  // Auto-select conversation from ?conv=id query param
  useEffect(() => {
    if (convIdParam && conversations.length > 0 && !selected) {
      const target = conversations.find(c => c.id === convIdParam);
      if (target) setSelected(target);
    }
  }, [convIdParam, conversations, selected]);

  const filtered = conversations.filter(c =>
    filter === 'all' ? true : c.status === filter
  );

  const unreadCount = conversations.filter(c => c.status === 'responded').length;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#080808]">
      {/* Left panel — conversation list */}
      <div className={cn(
        'flex flex-col border-r border-zinc-800/60 shrink-0',
        selected ? 'hidden md:flex md:w-80 lg:w-96' : 'w-full md:w-80 lg:w-96'
      )}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Setter</p>
              <h1 className="text-xl font-bold text-brand-text">Inbox</h1>
            </div>
            {unreadCount > 0 && (
              <span className="rounded-full bg-emerald-500 text-[10px] font-black text-black px-2 py-0.5">{unreadCount}</span>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'responded', label: 'Respondieron' },
              { key: 'waiting_response', label: 'Sin respuesta' },
              { key: 'open', label: 'Abiertas' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn('shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  filter === f.key ? 'bg-brand-gold text-black' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-gold" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2 px-4">
              <MessageSquare className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500 text-center">
                {filter === 'all' ? 'Sin conversaciones todavía.' : `Sin conversaciones con estado "${filter}".`}
              </p>
            </div>
          ) : (
            filtered.map(conv => {
              const cfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG['open'];
              const isSelected = selected?.id === conv.id;
              const isUnread = conv.status === 'responded';
              return (
                <button key={conv.id} onClick={() => setSelected(conv)}
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
                      <p className="text-[11px] text-zinc-500 font-mono">{conv.leads.phone}</p>
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

      {/* Right panel — conversation detail */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-bold text-brand-text">
                  {selected.leads.first_name} {selected.leads.last_name ?? ''}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">{selected.leads.phone} {selected.leads.country ? `· ${selected.leads.country}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setContactLead(selected.leads)}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25 px-3 py-1.5 text-xs font-bold text-yellow-400 hover:bg-yellow-500/20 transition">
                <MessageSquare className="h-3.5 w-3.5" /> Contactar
              </button>
              <a href={`https://wa.me/${String(selected.leads.phone ?? '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition">
                WhatsApp
              </a>
            </div>
          </div>

          {/* Conversation panel */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ConversationPanel leadId={selected.lead_id} />
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Seleccioná una conversación</p>
          </div>
        </div>
      )}

      {/* Contact modal */}
      {contactLead && (
        <ContactModal
          lead={contactLead}
          setterName={setterName}
          onClose={() => setContactLead(null)}
          onSent={() => { setContactLead(null); load(); }}
        />
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
      </div>
    }>
      <InboxPageInner />
    </Suspense>
  );
}
