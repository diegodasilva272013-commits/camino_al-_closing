'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { COMMUNITY_CATEGORIES } from '@/constants/categories';

const BUCKET = 'community-media';
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export type PostActionState = {
  error?: string;
  ok?: boolean;
};

type MediaType = 'image' | 'video' | 'youtube' | 'document' | 'audio';

function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'v'].includes(parts[0])) {
        return parts[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

async function uploadMedia(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  file: File,
  prefix: 'posts' | 'comments'
): Promise<{ url: string; type: MediaType; error?: string }> {
  if (file.size > MAX_BYTES) {
    return { url: '', type: 'document', error: 'El archivo supera 50 MB.' };
  }
  const type = detectMediaType(file);
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const path = `${userId}/${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return { url: '', type, error: `Error subiendo: ${upErr.message}` };

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl, type };
}

export async function createPostAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Debes iniciar sesión.' };

  const content = String(formData.get('content') ?? '').trim();
  const titleRaw = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? 'Anuncios').trim();
  const youtubeRaw = String(formData.get('youtube_url') ?? '').trim();
  const file = formData.get('media') as File | null;

  if (!content && !youtubeRaw && !(file && file.size > 0)) {
    return { error: 'Escribe algo o adjunta un medio.' };
  }

  if (!COMMUNITY_CATEGORIES.includes(category as never)) {
    return { error: 'Categoría inválida.' };
  }

  let media_url: string | null = null;
  let media_type: MediaType | null = null;
  let youtube_url: string | null = null;

  if (youtubeRaw) {
    const ytId = extractYoutubeId(youtubeRaw);
    if (!ytId) return { error: 'Enlace de YouTube inválido.' };
    youtube_url = `https://www.youtube.com/watch?v=${ytId}`;
    media_type = 'youtube';
  } else if (file && file.size > 0) {
    const up = await uploadMedia(supabase, user.id, file, 'posts');
    if (up.error) return { error: up.error };
    media_url = up.url;
    media_type = up.type;
  }

  const { error: insErr } = await (supabase as any).from('community_posts').insert({
    user_id: user.id,
    category,
    title: titleRaw || null,
    content: content || '',
    media_url,
    media_type,
    youtube_url,
  });

  if (insErr) return { error: insErr.message };

  revalidatePath('/community');
  return { ok: true };
}

export async function toggleLikeAction(postId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await (supabase as any)
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id);
  } else {
    await (supabase as any)
      .from('post_likes')
      .insert({ post_id: postId, user_id: user.id });
  }
  revalidatePath('/community');
}

export async function createCommentAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const postId = String(formData.get('post_id') ?? '');
  const content = String(formData.get('content') ?? '').trim();
  const file = formData.get('media') as File | null;
  const gifUrl = String(formData.get('gif_url') ?? '').trim();
  if (!postId) return { error: 'Post inválido.' };
  if (!content && !(file && file.size > 0) && !gifUrl) {
    return { error: 'El comentario está vacío.' };
  }

  let media_url: string | null = null;
  let media_type: MediaType | null = null;

  if (gifUrl) {
    if (!/^https?:\/\//i.test(gifUrl)) {
      return { error: 'GIF inválido.' };
    }
    media_url = gifUrl;
    media_type = 'image';
  } else if (file && file.size > 0) {
    const up = await uploadMedia(supabase, user.id, file, 'comments');
    if (up.error) return { error: up.error };
    media_url = up.url;
    media_type = up.type;
  }

  const { error } = await (supabase as any).from('community_comments').insert({
    post_id: postId,
    user_id: user.id,
    content: content || null,
    media_url,
    media_type,
  });
  if (error) return { error: error.message };

  revalidatePath('/community');
  return { ok: true };
}

export async function deletePostAction(postId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as any)
    .from('community_posts')
    .update({ is_deleted: true })
    .eq('id', postId)
    .eq('user_id', user.id);

  revalidatePath('/community');
}
