'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export type ProfileActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
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
