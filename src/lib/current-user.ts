import { createSupabaseServerClient } from './supabase-server';

export type CurrentUserContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'student' | 'mentor' | 'admin';
  isAdmin: boolean;
};

/**
 * Devuelve el usuario autenticado + su perfil. Null si no hay sesión o si Supabase no está configurado.
 */
export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url, email')
      .eq('id', user.id)
      .maybeSingle();

    const role = ((profile as { role?: string } | null)?.role ?? 'student') as
      | 'student'
      | 'mentor'
      | 'admin';

    return {
      userId: user.id,
      email: user.email ?? (profile as any)?.email ?? null,
      fullName: (profile as any)?.full_name ?? null,
      avatarUrl: (profile as any)?.avatar_url ?? null,
      role,
      isAdmin: role === 'admin',
    };
  } catch {
    return null;
  }
}

/**
 * Wrapper para Server Actions / pages que requieren rol admin.
 * Tira un Error si no lo es para que la acción falle de forma visible.
 */
export async function requireAdmin(): Promise<CurrentUserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('No autenticado.');
  if (!ctx.isAdmin) throw new Error('Acceso restringido a administradores.');
  return ctx;
}
