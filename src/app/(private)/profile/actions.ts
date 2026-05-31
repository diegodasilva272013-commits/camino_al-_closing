'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { env } from '@/lib/env';
import {
  generateStyledAvatar,
  type AvatarStyle,
} from '@/lib/openai-images';

export type ProfileActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  avatarUrl?: string;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_MIME = /^image\/(jpeg|jpg|png|webp|gif)$/i;

function clean(s: unknown, max = 200): string | null {
  if (typeof s !== 'string') return null;
  const v = s.trim();
  if (!v) return null;
  return v.slice(0, max);
}

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const full_name = clean(formData.get('full_name'), 80);
  const bio = clean(formData.get('bio'), 500);
  const phone = clean(formData.get('phone'), 30);
  const city = clean(formData.get('city'), 80);
  const country = clean(formData.get('country'), 80);
  const website = clean(formData.get('website'), 200);
  const instagram = clean(formData.get('instagram'), 60);
  const is_public = formData.get('is_public') === 'on';

  if (website && !/^https?:\/\//i.test(website)) {
    return { error: 'El sitio web debe comenzar con http:// o https://' };
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      full_name,
      bio,
      phone,
      city,
      country,
      website,
      instagram: instagram ? instagram.replace(/^@/, '') : null,
      is_public,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/profile');
  revalidatePath('/community');
  return { ok: true, message: 'Perfil actualizado.' };
}

export async function uploadAvatarAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const file = formData.get('avatar') as File | null;
  if (!file || file.size === 0) return { error: 'Seleccioná una imagen.' };
  if (file.size > MAX_AVATAR_BYTES) return { error: 'La imagen supera 5 MB.' };
  if (!AVATAR_MIME.test(file.type)) {
    return { error: 'Formato no soportado. Usá JPG, PNG, WEBP o GIF.' };
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });
  if (upErr) return { error: `Error subiendo avatar: ${upErr.message}` };

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);

  const { error: updErr } = await (supabase as any)
    .from('profiles')
    .update({ avatar_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (updErr) return { error: updErr.message };

  revalidatePath('/profile');
  revalidatePath('/community');
  return { ok: true, message: 'Foto de perfil actualizada.' };
}

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (password !== confirm) {
    return { error: 'Las contraseñas no coinciden.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { ok: true, message: 'Contraseña actualizada correctamente.' };
}

// =====================================================================
// AI Avatar Studio — genera avatar estilizado con OpenAI gpt-image-1
// =====================================================================

const AI_AVATAR_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const AI_AVATAR_MAX = 8 * 1024 * 1024; // 8 MB entrada

function computeLevel(points: number): number {
  if (points >= 8000) return 10;
  if (points >= 5500) return 9;
  if (points >= 3500) return 8;
  if (points >= 2000) return 7;
  if (points >= 1200) return 6;
  if (points >= 700) return 5;
  if (points >= 350) return 4;
  if (points >= 150) return 3;
  if (points >= 50) return 2;
  return 1;
}

export async function generateAiAvatarAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  if (!env.openai.apiKey) {
    return {
      error:
        'El servicio de avatares IA no está configurado. Avisá al administrador.',
    };
  }

  const styleRaw = String(formData.get('style') ?? '');
  if (!['pixar', 'cartoon', 'marvel'].includes(styleRaw)) {
    return { error: 'Estilo inválido.' };
  }
  const style = styleRaw as AvatarStyle;

  const file = formData.get('photo') as File | null;
  if (!file || file.size === 0) {
    return { error: 'Subí una foto de tu cara para empezar.' };
  }
  if (file.size > AI_AVATAR_MAX) {
    return { error: 'La foto supera 8 MB.' };
  }
  if (!AI_AVATAR_MIME.test(file.type)) {
    return { error: 'Formato no soportado. Usá JPG, PNG o WEBP.' };
  }

  // Lee créditos y puntos
  const { data: prof, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('points, ai_avatar_credits')
    .eq('id', user.id)
    .maybeSingle();
  if (profErr) return { error: profErr.message };
  const credits = (prof?.ai_avatar_credits as number | null) ?? 0;
  if (credits <= 0) {
    return {
      error:
        'No te quedan generaciones gratis. Subí de nivel para ganar 1 nueva ✨',
    };
  }

  const points = (prof?.points as number | null) ?? 0;
  const level = computeLevel(points);

  // Sube la foto original al bucket privado (audit + opcional reuso)
  const sourcePath = `${user.id}/source-${Date.now()}.png`;
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  await supabase.storage
    .from('avatar-sources')
    .upload(sourcePath, sourceBytes, {
      contentType: file.type,
      upsert: false,
    });

  // Llama a OpenAI
  let outputBuffer: Buffer;
  try {
    outputBuffer = await generateStyledAvatar({
      apiKey: env.openai.apiKey,
      sourceImage: new Blob([sourceBytes], { type: file.type }),
      style,
      level,
    });
  } catch (e: any) {
    const msg = e?.message ?? 'Error al generar avatar.';
    return { error: `IA: ${msg}` };
  }

  // Sube el resultado al bucket público
  const outPath = `${user.id}/avatar-${style}-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage
    .from('avatars-ai')
    .upload(outPath, outputBuffer, {
      contentType: 'image/png',
      upsert: false,
    });
  if (upErr) return { error: `Storage: ${upErr.message}` };

  const { data: pub } = supabase.storage.from('avatars-ai').getPublicUrl(outPath);
  const publicUrl = pub.publicUrl;

  // Consumir crédito de forma atómica
  const { data: consumed, error: consErr } = await (supabase as any).rpc(
    'consume_ai_avatar_credit',
    { p_user: user.id }
  );
  if (consErr) return { error: consErr.message };
  if (!consumed) {
    return { error: 'No quedan créditos.' };
  }

  // Actualiza perfil
  await (supabase as any)
    .from('profiles')
    .update({
      avatar_url: publicUrl,
      ai_avatar_url: publicUrl,
      ai_avatar_style: style,
      ai_avatar_level: level,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // Audit
  await (supabase as any).from('ai_avatar_generations').insert({
    user_id: user.id,
    style,
    level_snapshot: level,
    source_path: sourcePath,
    output_url: publicUrl,
    cost_credits: 1,
  });

  revalidatePath('/profile');
  revalidatePath('/community');
  revalidatePath(`/u/${user.id}`);

  return {
    ok: true,
    message: '¡Tu nuevo avatar está listo!',
    avatarUrl: publicUrl,
  };
}
