'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  Search,
  Plus,
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Video,
  File as FileIcon,
  Mic,
  X,
  ArrowLeft,
  MoreVertical,
  Users as UsersIcon,
  Megaphone,
  Reply,
  Trash2,
  Check,
  CheckCheck,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import {
  createDmAction,
  createGroupAction,
  deleteMessageAction,
  leaveConversationAction,
  markReadAction,
  searchUsersAction,
  sendMessageAction,
  uploadChatMediaAction,
} from '../actions';
import { GifPicker } from '@/app/(private)/community/_components/comment-extras';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type MediaKind = 'image' | 'video' | 'audio' | 'file' | 'gif';

type CurrentUser = { id: string; full_name: string | null; avatar_url: string | null };

type ConvSummary = {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name: string | null;
  avatar_url: string | null;
  last_message_at: string;
  last_message_preview: string;
  last_message_at_iso: string;
  unread: number;
  other_user_id: string | null; // para DM
  members_count: number;
  my_role: 'owner' | 'admin' | 'member';
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: MediaKind | null;
  media_name: string | null;
  reply_to_id: string | null;
  created_at: string;
  deleted_at: string | null;
  author: { full_name: string | null; avatar_url: string | null } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay)
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYest =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  if (isYest) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function previewOf(m: { content: string | null; media_type: MediaKind | null }): string {
  if (m.content && m.content.trim()) return m.content;
  if (m.media_type === 'image') return '📷 Foto';
  if (m.media_type === 'video') return '🎬 Video';
  if (m.media_type === 'audio') return '🎤 Audio';
  if (m.media_type === 'file') return '📎 Archivo';
  if (m.media_type === 'gif') return '🎞️ GIF';
  return '';
}

const COMMON_EMOJIS = [
  '😀','😂','😍','🥰','😎','🤩','🤔','😅','😭','😤','🔥','❤️','💪','🎯','💎','👑',
  '🚀','💯','👏','🙌','🤝','👍','👎','🙏','✨','⚡','🎉','💰','📈','🏆','👀','🤯',
];

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function ChatShell({
  currentUser,
  initialConvId,
}: {
  currentUser: CurrentUser;
  initialConvId: string | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [convs, setConvs] = useState<ConvSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConvId);
  const [showNew, setShowNew] = useState(false);
  const [searchConv, setSearchConv] = useState('');

  // Cargar conversaciones --------------------------------------------------
  const loadConvs = useCallback(async () => {
    // 1) mis membresías
    const { data: memberships } = await supabase
      .from('chat_members')
      .select('conversation_id, role, last_read_at, chat_conversations(id, type, name, avatar_url, last_message_at)')
      .eq('user_id', currentUser.id);

    const list = (memberships ?? []) as any[];
    if (list.length === 0) {
      setConvs([]);
      return;
    }

    const convIds = list.map((m) => m.conversation_id);

    // 2) últimos mensajes
    const { data: lastMsgs } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, content, media_type, created_at, user_id')
      .in('conversation_id', convIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    const lastByConv = new Map<string, any>();
    for (const m of (lastMsgs as any[]) ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }

    // 3) unread counts (mensajes posteriores a last_read_at, no míos)
    const unreadByConv = new Map<string, number>();
    for (const m of list) {
      const cnt = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', m.conversation_id)
        .gt('created_at', m.last_read_at)
        .neq('user_id', currentUser.id);
      unreadByConv.set(m.conversation_id, cnt.count ?? 0);
    }

    // 4) miembros para DMs (resolver "other user")
    const { data: members } = await supabase
      .from('chat_members')
      .select('conversation_id, user_id, profiles(id, full_name, avatar_url)')
      .in('conversation_id', convIds);

    const membersByConv = new Map<string, any[]>();
    for (const mm of (members as any[]) ?? []) {
      if (!membersByConv.has(mm.conversation_id))
        membersByConv.set(mm.conversation_id, []);
      membersByConv.get(mm.conversation_id)!.push(mm);
    }

    const summaries: ConvSummary[] = list.map((m) => {
      const conv = m.chat_conversations;
      const last = lastByConv.get(m.conversation_id);
      const ms = membersByConv.get(m.conversation_id) ?? [];
      let name = conv?.name as string | null;
      let avatar = conv?.avatar_url as string | null;
      let otherUserId: string | null = null;
      if (conv?.type === 'dm') {
        const other = ms.find((x) => x.user_id !== currentUser.id);
        otherUserId = other?.user_id ?? null;
        name = other?.profiles?.full_name ?? 'Miembro';
        avatar = other?.profiles?.avatar_url ?? null;
      }
      return {
        id: m.conversation_id,
        type: conv?.type ?? 'dm',
        name,
        avatar_url: avatar,
        last_message_at: conv?.last_message_at ?? new Date().toISOString(),
        last_message_at_iso: conv?.last_message_at ?? new Date().toISOString(),
        last_message_preview: last
          ? `${last.user_id === currentUser.id ? 'Vos: ' : ''}${previewOf(last)}`
          : 'Sin mensajes aún',
        unread: unreadByConv.get(m.conversation_id) ?? 0,
        other_user_id: otherUserId,
        members_count: ms.length,
        my_role: m.role,
      };
    });

    summaries.sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime()
    );
    setConvs(summaries);
  }, [supabase, currentUser.id]);

  useEffect(() => {
    void loadConvs();
  }, [loadConvs]);

  // Realtime: recargar lista al recibir cambios -----------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`chat-list-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          void loadConvs();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${currentUser.id}` },
        () => {
          void loadConvs();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.id, loadConvs]);

  const activeConv = convs.find((c) => c.id === activeId) ?? null;

  const filteredConvs = convs.filter((c) =>
    (c.name ?? '').toLowerCase().includes(searchConv.trim().toLowerCase())
  );

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0a0a]">
      {/* Sidebar de conversaciones */}
      <aside
        className={`${
          activeId ? 'hidden md:flex' : 'flex'
        } w-full flex-col border-r border-[rgba(212,175,55,0.15)] md:w-[340px] lg:w-[380px]`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[rgba(212,175,55,0.12)] bg-gradient-to-b from-[#141008] to-[#0c0c0c] px-4 py-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-text">Mensajes</h2>
            <p className="text-xs text-brand-muted">Chat de la comunidad</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-gold to-amber-600 text-black shadow-lg shadow-brand-gold/30 transition hover:scale-105"
            title="Nuevo chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[rgba(212,175,55,0.08)] px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted/60" />
            <input
              value={searchConv}
              onChange={(e) => setSearchConv(e.target.value)}
              placeholder="Buscar chats…"
              className="w-full rounded-full border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] py-1.5 pl-9 pr-3 text-xs text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 && (
            <div className="px-6 py-10 text-center text-xs text-brand-muted">
              {convs.length === 0 ? (
                <>
                  <p className="mb-3">Aún no tenés chats.</p>
                  <button
                    onClick={() => setShowNew(true)}
                    className="rounded-full bg-gradient-to-br from-brand-gold to-amber-600 px-4 py-1.5 text-xs font-medium text-black"
                  >
                    Iniciar chat
                  </button>
                </>
              ) : (
                'Sin resultados'
              )}
            </div>
          )}

          {filteredConvs.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveId(c.id);
                void markReadAction(c.id);
              }}
              className={`flex w-full items-center gap-3 border-b border-[rgba(212,175,55,0.06)] px-3 py-3 text-left transition hover:bg-[rgba(212,175,55,0.05)] ${
                activeId === c.id ? 'bg-[rgba(212,175,55,0.08)]' : ''
              }`}
            >
              <ConvAvatar conv={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    {c.type === 'group' && <UsersIcon className="h-3 w-3 shrink-0 text-brand-gold/70" />}
                    {c.type === 'channel' && <Megaphone className="h-3 w-3 shrink-0 text-brand-gold/70" />}
                    <span className="truncate text-sm font-medium text-brand-text">
                      {c.name ?? 'Sin nombre'}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] text-brand-muted">
                    {formatTime(c.last_message_at_iso)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-brand-muted">
                    {c.last_message_preview}
                  </p>
                  {c.unread > 0 && (
                    <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Vista del chat activo */}
      <main className={`${activeId ? 'flex' : 'hidden md:flex'} h-full flex-1 flex-col`}>
        {activeConv ? (
          <ConversationView
            key={activeConv.id}
            supabase={supabase}
            conv={activeConv}
            currentUser={currentUser}
            onBack={() => setActiveId(null)}
            onLeft={() => {
              setActiveId(null);
              void loadConvs();
            }}
          />
        ) : (
          <EmptyState onNew={() => setShowNew(true)} />
        )}
      </main>

      {showNew && (
        <NewChatDialog
          currentUserId={currentUser.id}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            setActiveId(id);
            void loadConvs();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar de conversación
// ---------------------------------------------------------------------------
function ConvAvatar({ conv }: { conv: ConvSummary }) {
  const initial = (conv.name?.trim()?.charAt(0) ?? '?').toUpperCase();
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(212,175,55,0.25)]">
      {conv.avatar_url ? (
        <Image src={conv.avatar_url} alt={conv.name ?? ''} fill sizes="44px" className="object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-700 to-amber-900 text-sm font-semibold text-brand-text">
          {initial}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.06),transparent_60%)] px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-gold/20 to-amber-900/10 ring-1 ring-brand-gold/30">
          <Send className="h-8 w-8 text-brand-gold" />
        </div>
        <h3 className="font-display text-xl font-semibold text-brand-text">Tus mensajes</h3>
        <p className="mt-2 text-sm text-brand-muted">
          Conectá con la comunidad. Iniciá un chat privado, armá grupos o creá canales para difundir.
        </p>
        <button
          onClick={onNew}
          className="mt-5 rounded-full bg-gradient-to-br from-brand-gold to-amber-600 px-5 py-2 text-sm font-medium text-black shadow-lg shadow-brand-gold/30 transition hover:scale-105"
        >
          Iniciar nuevo chat
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista de conversación
// ---------------------------------------------------------------------------
function ConversationView({
  supabase,
  conv,
  currentUser,
  onBack,
  onLeft,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  conv: ConvSummary;
  currentUser: CurrentUser;
  onBack: () => void;
  onLeft: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select(
        'id, conversation_id, user_id, content, media_url, media_type, media_name, reply_to_id, created_at, deleted_at, profiles(full_name, avatar_url)'
      )
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(200);
    const list: ChatMessage[] = ((data as any[]) ?? []).map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      user_id: m.user_id,
      content: m.content,
      media_url: m.media_url,
      media_type: m.media_type as MediaKind | null,
      media_name: m.media_name,
      reply_to_id: m.reply_to_id,
      created_at: m.created_at,
      deleted_at: m.deleted_at,
      author: m.profiles
        ? { full_name: m.profiles.full_name, avatar_url: m.profiles.avatar_url }
        : null,
    }));
    setMessages(list);
    scrollToBottom();
  }, [supabase, conv.id, scrollToBottom]);

  useEffect(() => {
    void loadMessages();
    void markReadAction(conv.id);
  }, [loadMessages, conv.id]);

  // Realtime: nuevos mensajes
  useEffect(() => {
    const channel = supabase
      .channel(`chat-conv-${conv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conv.id}`,
        },
        async (payload: any) => {
          const newMsg = payload.new;
          // Resolver autor
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMsg.user_id)
            .maybeSingle();
          setMessages((prev) =>
            prev.find((m) => m.id === newMsg.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: newMsg.id,
                    conversation_id: newMsg.conversation_id,
                    user_id: newMsg.user_id,
                    content: newMsg.content,
                    media_url: newMsg.media_url,
                    media_type: newMsg.media_type as MediaKind | null,
                    media_name: newMsg.media_name,
                    reply_to_id: newMsg.reply_to_id,
                    created_at: newMsg.created_at,
                    deleted_at: newMsg.deleted_at,
                    author: prof
                      ? {
                          full_name: (prof as any).full_name,
                          avatar_url: (prof as any).avatar_url,
                        }
                      : null,
                  },
                ]
          );
          scrollToBottom();
          if (newMsg.user_id !== currentUser.id) void markReadAction(conv.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conv.id}`,
        },
        (payload: any) => {
          const upd = payload.new;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === upd.id
                ? {
                    ...m,
                    content: upd.content,
                    media_url: upd.media_url,
                    deleted_at: upd.deleted_at,
                  }
                : m
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conv.id, currentUser.id, scrollToBottom]);

  const messagesById = useMemo(() => {
    const m = new Map<string, ChatMessage>();
    for (const x of messages) m.set(x.id, x);
    return m;
  }, [messages]);

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(212,175,55,0.15)] bg-gradient-to-b from-[#141008] to-[#0c0c0c] px-3 py-2.5 md:px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="grid h-8 w-8 place-items-center rounded-full text-brand-muted hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <ConvAvatar conv={conv} />
          <div>
            <div className="flex items-center gap-1.5">
              {conv.type === 'group' && <UsersIcon className="h-3 w-3 text-brand-gold/70" />}
              {conv.type === 'channel' && <Megaphone className="h-3 w-3 text-brand-gold/70" />}
              <h3 className="text-sm font-semibold text-brand-text">{conv.name ?? 'Sin nombre'}</h3>
            </div>
            <p className="text-[11px] text-brand-muted">
              {conv.type === 'dm'
                ? 'Chat privado'
                : `${conv.members_count} ${conv.members_count === 1 ? 'miembro' : 'miembros'}`}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu((s) => !s)}
            className="grid h-9 w-9 place-items-center rounded-full text-brand-muted hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] shadow-xl">
              <button
                onClick={async () => {
                  setShowMenu(false);
                  if (!confirm('¿Salir de este chat?')) return;
                  await leaveConversationAction(conv.id);
                  onLeft();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Salir del chat
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.04),transparent_60%)] px-3 py-4 md:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.length === 0 && (
            <p className="py-10 text-center text-xs text-brand-muted">
              Sé el primero en escribir. Saludá 👋
            </p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const isMine = m.user_id === currentUser.id;
            const groupedWithPrev =
              prev &&
              prev.user_id === m.user_id &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
            const reply = m.reply_to_id ? messagesById.get(m.reply_to_id) : null;
            return (
              <MessageBubble
                key={m.id}
                msg={m}
                isMine={isMine}
                showAvatar={!groupedWithPrev && !isMine && conv.type !== 'dm'}
                reply={reply ?? null}
                onReply={() => setReplyTo(m)}
              />
            );
          })}
        </div>
      </div>

      {/* Input */}
      <MessageInput
        conv={conv}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSent={() => {
          setReplyTo(null);
          scrollToBottom();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Burbuja de mensaje
// ---------------------------------------------------------------------------
function MessageBubble({
  msg,
  isMine,
  showAvatar,
  reply,
  onReply,
}: {
  msg: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
  reply: ChatMessage | null;
  onReply: () => void;
}) {
  const [hover, setHover] = useState(false);

  if (msg.deleted_at) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="rounded-2xl bg-[#1a1a1a] px-3 py-1.5 text-xs italic text-brand-muted">
          Mensaje eliminado
        </div>
      </div>
    );
  }

  const bubbleClasses = isMine
    ? 'bg-gradient-to-br from-amber-600/95 to-amber-700/95 text-black'
    : 'bg-[#16161a] text-brand-text';

  const tailClasses = isMine ? 'rounded-br-md' : 'rounded-bl-md';

  return (
    <div
      className={`group flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {showAvatar && (
        <div className="relative mb-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(212,175,55,0.2)]">
          {msg.author?.avatar_url ? (
            <Image src={msg.author.avatar_url} alt="" fill sizes="24px" className="object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-amber-900 text-[10px] font-bold text-brand-text">
              {(msg.author?.full_name?.charAt(0) ?? '?').toUpperCase()}
            </div>
          )}
        </div>
      )}
      {!showAvatar && !isMine && <div className="w-6" />}

      <div className="relative max-w-[78%]">
        <div className={`relative rounded-2xl ${tailClasses} ${bubbleClasses} px-3 py-1.5 shadow`}>
          {!isMine && showAvatar && msg.author?.full_name && (
            <p className="mb-0.5 text-[11px] font-semibold text-brand-gold">
              {msg.author.full_name}
            </p>
          )}
          {reply && (
            <div
              className={`mb-1 rounded-md border-l-2 ${
                isMine ? 'border-black/40 bg-black/10' : 'border-brand-gold/70 bg-black/20'
              } px-2 py-1 text-[11px] opacity-80`}
            >
              <p className="font-semibold">{reply.author?.full_name ?? 'Mensaje'}</p>
              <p className="truncate">{previewOf(reply)}</p>
            </div>
          )}

          {msg.media_type === 'image' && msg.media_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.media_url}
              alt={msg.media_name ?? 'imagen'}
              className="mb-1 max-h-[320px] w-full rounded-lg object-cover"
            />
          )}
          {msg.media_type === 'gif' && msg.media_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.media_url}
              alt="gif"
              className="mb-1 max-h-[260px] w-full rounded-lg object-cover"
            />
          )}
          {msg.media_type === 'video' && msg.media_url && (
            <video src={msg.media_url} controls className="mb-1 max-h-[320px] w-full rounded-lg" />
          )}
          {msg.media_type === 'audio' && msg.media_url && (
            <audio src={msg.media_url} controls className="mb-1 w-full" />
          )}
          {msg.media_type === 'file' && msg.media_url && (
            <a
              href={msg.media_url}
              download={msg.media_name ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                isMine ? 'bg-black/10 text-black' : 'bg-[rgba(212,175,55,0.1)] text-brand-text'
              }`}
            >
              <FileIcon className="h-4 w-4" />
              <span className="truncate">{msg.media_name ?? 'archivo'}</span>
            </a>
          )}

          {msg.content && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {msg.content}
            </p>
          )}
          <div
            className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
              isMine ? 'text-black/60' : 'text-brand-muted'
            }`}
          >
            <span>
              {new Date(msg.created_at).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isMine && <CheckCheck className="h-3 w-3" />}
          </div>
        </div>

        {/* acciones hover */}
        {hover && (
          <div
            className={`absolute ${isMine ? '-left-9' : '-right-9'} top-1 flex flex-col gap-1`}
          >
            <button
              onClick={onReply}
              className="grid h-7 w-7 place-items-center rounded-full bg-[#1a1a1a] text-brand-muted ring-1 ring-[rgba(212,175,55,0.2)] hover:text-brand-gold"
              title="Responder"
            >
              <Reply className="h-3 w-3" />
            </button>
            {isMine && (
              <button
                onClick={() => {
                  if (confirm('¿Borrar mensaje?')) void deleteMessageAction(msg.id);
                }}
                className="grid h-7 w-7 place-items-center rounded-full bg-[#1a1a1a] text-red-400 ring-1 ring-red-500/20 hover:text-red-300"
                title="Borrar"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input de mensaje
// ---------------------------------------------------------------------------
function MessageInput({
  conv,
  replyTo,
  onClearReply,
  onSent,
}: {
  conv: ConvSummary;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [pending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const recordStream = useRef<MediaStream | null>(null);
  const recordTimer = useRef<any>(null);

  const fileInputs = {
    image: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
    file: useRef<HTMLInputElement>(null),
  };

  // Solo owners/admins pueden escribir en canales
  const readOnly = conv.type === 'channel' && conv.my_role === 'member';

  async function doSendText() {
    const content = text.trim();
    if (!content) return;
    setText('');
    onClearReply();
    startTransition(async () => {
      await sendMessageAction({
        conversationId: conv.id,
        content,
        replyToId: replyTo?.id ?? null,
      });
      onSent();
    });
  }

  async function doSendFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    startTransition(async () => {
      const up = await uploadChatMediaAction(fd);
      if ('error' in up && up.error) {
        alert(up.error);
        return;
      }
      if (!('url' in up)) return;
      await sendMessageAction({
        conversationId: conv.id,
        content: text.trim() || null,
        mediaUrl: up.url,
        mediaType: up.media_type,
        mediaName: up.media_name,
        replyToId: replyTo?.id ?? null,
      });
      setText('');
      onClearReply();
      onSent();
    });
  }

  async function doSendGif(gif: { url: string; alt: string }) {
    setShowGif(false);
    startTransition(async () => {
      await sendMessageAction({
        conversationId: conv.id,
        mediaUrl: gif.url,
        mediaType: 'gif',
        replyToId: replyTo?.id ?? null,
      });
      onSent();
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStream.current = stream;
      const rec = new MediaRecorder(stream);
      recordChunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunks.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(recordChunks.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        recordStream.current?.getTracks().forEach((t) => t.stop());
        await doSendFile(file);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSecs(0);
      recordTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (e) {
      alert('No se pudo acceder al micrófono');
    }
  }

  function stopRecording(send: boolean) {
    clearInterval(recordTimer.current);
    if (recorderRef.current) {
      if (!send) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = () => {
          recordStream.current?.getTracks().forEach((t) => t.stop());
        };
      }
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  if (readOnly) {
    return (
      <div className="border-t border-[rgba(212,175,55,0.12)] bg-[#0c0c0c] px-4 py-4 text-center text-xs text-brand-muted">
        Solo los administradores pueden publicar en este canal.
      </div>
    );
  }

  return (
    <div className="relative border-t border-[rgba(212,175,55,0.12)] bg-[#0c0c0c] px-3 py-2.5 md:px-5">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border-l-2 border-brand-gold bg-[rgba(212,175,55,0.08)] px-2 py-1.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-brand-gold">
              Respondiendo a {replyTo.author?.full_name ?? 'Mensaje'}
            </p>
            <p className="truncate text-xs text-brand-muted">{previewOf(replyTo)}</p>
          </div>
          <button onClick={onClearReply} className="text-brand-muted hover:text-brand-gold">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {recording ? (
        <div className="flex items-center justify-between gap-3 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm text-brand-text">
              Grabando…{' '}
              {Math.floor(recordSecs / 60)
                .toString()
                .padStart(2, '0')}
              :{(recordSecs % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => stopRecording(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-brand-muted hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => stopRecording(true)}
              className="grid h-8 w-8 place-items-center rounded-full bg-brand-gold text-black"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Adjuntos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAttach((s) => !s);
                setShowEmoji(false);
                setShowGif(false);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-brand-muted hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold"
              title="Adjuntar"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {showAttach && (
              <div className="absolute bottom-12 left-0 z-30 w-44 overflow-hidden rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] shadow-xl">
                <AttachItem
                  icon={<ImageIcon className="h-4 w-4" />}
                  label="Foto"
                  onClick={() => {
                    setShowAttach(false);
                    fileInputs.image.current?.click();
                  }}
                />
                <AttachItem
                  icon={<Video className="h-4 w-4" />}
                  label="Video"
                  onClick={() => {
                    setShowAttach(false);
                    fileInputs.video.current?.click();
                  }}
                />
                <AttachItem
                  icon={<FileIcon className="h-4 w-4" />}
                  label="Documento"
                  onClick={() => {
                    setShowAttach(false);
                    fileInputs.file.current?.click();
                  }}
                />
                <input
                  ref={fileInputs.image}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) doSendFile(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileInputs.video}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) doSendFile(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileInputs.file}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) doSendFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>

          {/* Emoji */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowEmoji((s) => !s);
                setShowGif(false);
                setShowAttach(false);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-brand-muted hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold"
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 left-0 z-30 w-72 rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-2 shadow-xl">
                <div className="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setText((t) => t + e);
                        setShowEmoji(false);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-md text-lg hover:bg-[rgba(212,175,55,0.1)]"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GIF */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowGif((s) => !s);
                setShowEmoji(false);
                setShowAttach(false);
              }}
              className="grid h-9 px-2 place-items-center rounded-full text-[11px] font-bold text-brand-muted ring-1 ring-[rgba(212,175,55,0.2)] hover:text-brand-gold"
              title="GIF"
            >
              GIF
            </button>
            {showGif && <GifPicker onPick={doSendGif} onClose={() => setShowGif(false)} />}
          </div>

          {/* Texto */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void doSendText();
              }
            }}
            placeholder="Mensaje…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
          />

          {text.trim() ? (
            <button
              onClick={doSendText}
              disabled={pending}
              className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-gold to-amber-600 text-black shadow-md disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="grid h-9 w-9 place-items-center rounded-full text-brand-muted hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold"
              title="Grabar audio"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttachItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-brand-text transition hover:bg-[rgba(212,175,55,0.1)] hover:text-brand-gold"
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Diálogo: nuevo chat
// ---------------------------------------------------------------------------
function NewChatDialog({
  currentUserId,
  onClose,
  onCreated,
}: {
  currentUserId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [mode, setMode] = useState<'dm' | 'group' | 'channel'>('dm');
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Buscar usuarios
  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchUsersAction(q);
      if (active && !('error' in res && res.error)) {
        setUsers((res as any).users ?? []);
      }
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (mode === 'dm') {
      const userId = [...selected][0];
      if (!userId) return alert('Seleccioná un usuario');
      startTransition(async () => {
        const res = await createDmAction(userId);
        if ('error' in res && res.error) return alert(res.error);
        if ('id' in res && res.id) onCreated(res.id);
      });
      return;
    }
    if (!name.trim()) return alert('El nombre es requerido');
    if (selected.size === 0) return alert('Agregá al menos un miembro');
    startTransition(async () => {
      const res = await createGroupAction({
        type: mode,
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: [...selected],
      });
      if ('error' in res && res.error) return alert(res.error);
      if ('id' in res && res.id) onCreated(res.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.15)] px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-brand-text">Nuevo chat</h3>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-gold">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tipo */}
        <div className="flex gap-1 border-b border-[rgba(212,175,55,0.1)] bg-[#0a0a0a] p-2">
          {[
            { id: 'dm', label: 'Privado', icon: <Send className="h-3.5 w-3.5" /> },
            { id: 'group', label: 'Grupo', icon: <UsersIcon className="h-3.5 w-3.5" /> },
            { id: 'channel', label: 'Canal', icon: <Megaphone className="h-3.5 w-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setMode(t.id as any);
                if (t.id === 'dm') setSelected(new Set());
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                mode === t.id
                  ? 'bg-gradient-to-br from-brand-gold to-amber-600 text-black'
                  : 'text-brand-muted hover:bg-[rgba(212,175,55,0.08)]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {(mode === 'group' || mode === 'channel') && (
          <div className="space-y-2 border-b border-[rgba(212,175,55,0.1)] px-4 py-3">
            <input
              placeholder={mode === 'group' ? 'Nombre del grupo' : 'Nombre del canal'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text focus:border-brand-gold focus:outline-none"
            />
            <input
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] px-3 py-2 text-xs text-brand-text focus:border-brand-gold focus:outline-none"
            />
          </div>
        )}

        {/* Buscar usuarios */}
        <div className="border-b border-[rgba(212,175,55,0.1)] px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                mode === 'dm' ? 'Buscar usuario para chatear…' : 'Agregar miembros…'
              }
              className="w-full rounded-full border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] py-1.5 pl-9 pr-3 text-xs text-brand-text focus:border-brand-gold focus:outline-none"
            />
          </div>
        </div>

        {/* Lista usuarios */}
        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <p className="px-4 py-8 text-center text-xs text-brand-muted">Buscando…</p>
          )}
          {!loading && users.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-brand-muted">Sin usuarios</p>
          )}
          {users.map((u) => {
            const sel = selected.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => {
                  if (mode === 'dm') {
                    setSelected(new Set([u.id]));
                  } else {
                    toggle(u.id);
                  }
                }}
                className={`flex w-full items-center gap-3 border-b border-[rgba(212,175,55,0.05)] px-4 py-2 text-left transition hover:bg-[rgba(212,175,55,0.05)] ${
                  sel ? 'bg-[rgba(212,175,55,0.08)]' : ''
                }`}
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(212,175,55,0.2)]">
                  {u.avatar_url ? (
                    <Image src={u.avatar_url} alt={u.full_name ?? ''} fill sizes="36px" className="object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-amber-900 text-xs font-bold text-brand-text">
                      {(u.full_name?.charAt(0) ?? '?').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-brand-text">{u.full_name ?? 'Sin nombre'}</p>
                  <p className="truncate text-[11px] text-brand-muted">{u.email}</p>
                </div>
                {sel && <Check className="h-4 w-4 text-brand-gold" />}
              </button>
            );
          })}
        </div>

        {/* Acción */}
        <div className="flex items-center justify-between gap-2 border-t border-[rgba(212,175,55,0.15)] bg-[#0a0a0a] px-4 py-3">
          <span className="text-[11px] text-brand-muted">
            {mode === 'dm'
              ? selected.size > 0
                ? '1 usuario seleccionado'
                : 'Elegí 1 usuario'
              : `${selected.size} ${selected.size === 1 ? 'miembro' : 'miembros'}`}
          </span>
          <button
            onClick={handleCreate}
            disabled={pending}
            className="rounded-full bg-gradient-to-br from-brand-gold to-amber-600 px-4 py-1.5 text-xs font-semibold text-black shadow-md disabled:opacity-50"
          >
            {mode === 'dm' ? 'Iniciar chat' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
