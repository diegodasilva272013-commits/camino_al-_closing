import { createSupabaseServerClient, createSupabaseAdminClient } from './supabase-server';

export type CurrentUserContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'student' | 'mentor' | 'admin' | 'setter' | 'closer';
  isAdmin: boolean;
  isSetter: boolean;
  isCloser: boolean;
};

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Intentar con RLS client primero
    const { data: rlsProfile } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url, email')
      .eq('id', user.id)
      .maybeSingle();

    // Si RLS bloquea la lectura del propio perfil, usar admin client como fallback
    let profile: { role?: string; full_name?: string | null; avatar_url?: string | null; email?: string | null } | null = rlsProfile as any;

    if (!profile) {
      try {
        const adminClient = createSupabaseAdminClient();
        const { data: adminProfile } = await adminClient
          .from('profiles')
          .select('role, full_name, avatar_url, email')
          .eq('id', user.id)
          .maybeSingle();
        if (adminProfile) {
          profile = adminProfile as any;
          console.warn('[current-user] RLS bloqueó la lectura del perfil — fallback a admin client');
        }
      } catch {
        // admin client no disponible
      }
    }

    const role = (profile?.role ?? 'student') as 'student' | 'mentor' | 'admin' | 'setter' | 'closer';

    return {
      userId: user.id,
      email: user.email ?? profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role,
      isAdmin: role === 'admin',
      isSetter: role === 'setter',
      isCloser: role === 'closer',
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<CurrentUserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) throw new Error('No autenticado.');
  if (!ctx.isAdmin) throw new Error('Acceso restringido a administradores.');
  return ctx;
}
