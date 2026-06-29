'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/push';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function detectType(file: File): 'image' | 'video' | 'audio' | 'file' {
  const m = file.type.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'file';
}

function ext(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const m = file.type.split('/')[1];
  return m || 'bin';
}

// ---------- Crear DM ----------
export async function createDmAction(otherUserId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  if (otherUserId === user.id) return { error: 'No podés chatear contigo mismo' };

  const { data, error } = await (supabase as any).rpc('get_or_create_dm', {
    p_other: otherUserId,
  });
  if (error) return { error: error.message };
  revalidatePath('/chat');
  return { id: data as string };
}

// ---------- Crear grupo o canal ----------
export async function createGroupAction(input: {
  type: 'group' | 'channel';
  name: string;
  description?: string;
  memberIds: string[];
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  const name = input.name?.trim();
  if (!name) return { error: 'El nombre es requerido' };

  const admin = createSupabaseAdminClient();

  const { data: conv, error: e1 } = await (admin as any)
    .from('chat_conversations')
    .insert({
      type: input.type,
      name,
      description: input.description ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (e1) return { error: e1.message };

  const members = [
    { conversation_id: conv.id, user_id: user.id, role: 'owner' as const },
    ...input.memberIds
      .filter((u) => u && u !== user.id)
      .map((u) => ({
        conversation_id: conv.id,
        user_id: u,
        role: 'member' as const,
      })),
  ];
  const { error: e2 } = await (admin as any)
    .from('chat_members')
    .insert(members);
  if (e2) return { error: e2.message };

  revalidatePath('/chat');
  return { id: conv.id as string };
}

// ---------- Subir archivo y devolver URL pública + meta ----------
export async function uploadChatMediaAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const file = formData.get('file') as File | null;
  if (!file) return { error: 'Archivo faltante' };
  if (file.size > MAX_BYTES) return { error: 'Máximo 25 MB' };

  const type = detectType(file);
  const path = `${user.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext(file)}`;

  const { error: upErr } = await supabase.storage
    .from('chat-media')
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
  return {
    url: pub.publicUrl,
    media_type: type as 'image' | 'video' | 'audio' | 'file',
    media_name: file.name,
  };
}

// ---------- Enviar mensaje ----------
export async function sendMessageAction(input: {
  conversationId: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'audio' | 'file' | 'gif' | null;
  mediaName?: string | null;
  replyToId?: string | null;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const rl = checkRateLimit('chat.send', user.id, 30, 60_000);
  if (!rl.ok) return { error: rl.error ?? 'Demasiados mensajes.' };

  const content = input.content?.trim() || null;
  if (!content && !input.mediaUrl) return { error: 'Mensaje vacío' };

  const { error } = await (supabase as any).from('chat_messages').insert({
    conversation_id: input.conversationId,
    user_id: user.id,
    content,
    media_url: input.mediaUrl ?? null,
    media_type: input.mediaType ?? null,
    media_name: input.mediaName ?? null,
    reply_to_id: input.replyToId ?? null,
  });
  if (error) return { error: error.message };

  // marcar como leído por mí
  await (supabase as any)
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', user.id);

  // Notificar a los otros miembros (fire and forget — no bloqueamos la respuesta)
  void (async () => {
    try {
      const admin = createSupabaseAdminClient();

      // Nombre del remitente
      const { data: sender } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const senderName = (sender as any)?.full_name ?? 'Alguien';

      // Otros miembros de la conversación
      const { data: members } = await admin
        .from('chat_members')
        .select('user_id')
        .eq('conversation_id', input.conversationId)
        .neq('user_id', user.id);

      const preview = content
        ? content.slice(0, 80)
        : input.mediaType === 'image'
          ? '📷 Foto'
          : input.mediaType === 'video'
            ? '🎬 Video'
            : input.mediaType === 'audio'
              ? '🎤 Audio'
              : input.mediaType === 'gif'
                ? '🎞️ GIF'
                : '📎 Archivo';

      await Promise.all(
        ((members as any[]) ?? []).map((m) =>
          sendPushToUser(m.user_id, {
            title: senderName,
            body: preview,
            url: `/chat?c=${input.conversationId}`,
            tag: `chat-${input.conversationId}`,
            icon: '/icon-192.png',
          })
        )
      );
    } catch {
      // push es best-effort, no rompemos si falla
    }
  })();

  return { ok: true };
}

// ---------- Borrar mensaje propio ----------
export async function deleteMessageAction(messageId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  const { error } = await (supabase as any)
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), content: null, media_url: null })
    .eq('id', messageId)
    .eq('user_id', user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------- Marcar conversación como leída ----------
export async function markReadAction(conversationId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  await (supabase as any)
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);
  return { ok: true };
}

// ---------- Agregar miembro ----------
export async function addMemberAction(conversationId: string, userId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  const { error } = await (supabase as any)
    .from('chat_members')
    .insert({ conversation_id: conversationId, user_id: userId });
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------- Salir de conversación ----------
export async function leaveConversationAction(conversationId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  const { error } = await (supabase as any)
    .from('chat_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/chat');
  return { ok: true };
}

// ---------- Buscar usuarios para iniciar chat ----------
export async function searchUsersAction(query: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado', users: [] };
  const q = query.trim();
  let req = (supabase as any)
    .from('profiles')
    .select('id, full_name, email, avatar_url, points')
    .neq('id', user.id)
    .limit(15);
  if (q) {
    req = req.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  } else {
    req = req.order('points', { ascending: false });
  }
  const { data, error } = await req;
  if (error) return { error: error.message, users: [] };
  return { users: data ?? [] };
}
