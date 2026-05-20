import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from './env';

/**
 * Cliente Supabase para Server Components, Route Handlers y Server Actions.
 * Lee/escribe la sesión en cookies de Next.js.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components no permiten set; lo manejará el middleware.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // ignore
        }
      },
    },
  });
}

/**
 * Cliente administrativo con service_role. Saltea RLS.
 * USAR SOLO en server, nunca exponer al browser.
 */
export function createSupabaseAdminClient() {
  if (!env.supabase.serviceRoleKey) {
    throw new Error(
      '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local'
    );
  }
  return createClient<Database>(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
