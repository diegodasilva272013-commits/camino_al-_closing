'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import type { AuthActionState } from './types';

function getOrigin(): string {
  // En producción usar NEXT_PUBLIC_SITE_URL, en local cae a localhost.
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  );
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email y contraseña son obligatorios.' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: traduceError(error.message) };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const full_name   = String(formData.get('full_name')   ?? '').trim();
  const email       = String(formData.get('email')       ?? '').trim();
  const password    = String(formData.get('password')    ?? '');
  const access_code = String(formData.get('access_code') ?? '').trim().toUpperCase();

  if (!full_name || !email || !password || !access_code) {
    return { error: 'Todos los campos son obligatorios.' };
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  // Validar código de acceso
  const adminClient = createSupabaseAdminClient();
  const { data: code } = await adminClient
    .from('invite_codes')
    .select('id, used_count, max_uses, is_active')
    .eq('code', access_code)
    .maybeSingle();

  if (!code || !code.is_active) {
    return { error: 'Código de acceso inválido.' };
  }
  if (code.used_count >= code.max_uses) {
    return { error: 'Este código ya alcanzó su límite de usos.' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${getOrigin()}/login`,
    },
  });

  if (error) {
    return { error: traduceError(error.message) };
  }

  // Incrementar used_count y guardar access_code en el perfil
  if (data.user) {
    await Promise.all([
      adminClient
        .from('invite_codes')
        .update({ used_count: code.used_count + 1 })
        .eq('id', code.id),
      adminClient
        .from('profiles')
        .update({ access_code })
        .eq('id', data.user.id),
    ]);
  }

  // Si email confirmation está desactivado, Supabase devuelve sesión activa.
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/onboarding');
  }

  return {
    ok: true,
    message:
      'Cuenta creada. Revisa tu email para confirmar la cuenta y luego inicia sesión.',
  };
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Ingresa tu email.' };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getOrigin()}/login`,
  });

  if (error) return { error: traduceError(error.message) };

  return {
    ok: true,
    message: 'Si el email existe, te enviamos un enlace para restablecer tu contraseña.',
  };
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

function traduceError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Credenciales inválidas.';
  if (m.includes('email not confirmed'))
    return 'Debes confirmar tu email antes de iniciar sesión.';
  if (m.includes('user already registered'))
    return 'Ya existe una cuenta con ese email.';
  if (m.includes('password should be at least'))
    return 'La contraseña es demasiado corta.';
  return msg;
}
