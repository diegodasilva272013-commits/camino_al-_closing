'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { env } from './env';

/**
 * Cliente Supabase para uso en componentes "use client".
 * Maneja la sesión en cookies automáticamente vía @supabase/ssr.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.supabase.url,
    env.supabase.anonKey
  );
}
