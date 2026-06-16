import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

/**
 * Refresca la sesión de Supabase en cada navegación para que los Server
 * Components siempre vean cookies frescas. La protección de rutas la haremos
 * en la Etapa 3 (auth funcional).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password';

  const isPrivateRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/classes') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/resources') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/u/') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/reporte-diario') ||
    pathname.startsWith('/aperturas') ||
    pathname.startsWith('/trainer') ||
    pathname.startsWith('/setter-evolucion') ||
    pathname.startsWith('/setter-recursos') ||
    pathname.startsWith('/setter-calendario') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/admin');

  if (!user && isPrivateRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Redirigir a onboarding si no completó la presentación
  if (user && isPrivateRoute && pathname !== '/onboarding') {
    const onboardingDone = user.user_metadata?.onboarding_done === true;
    if (!onboardingDone) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Protección extra: solo admins pueden entrar a /admin/*
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile as { role?: string } | null)?.role;
    if (role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Excluir archivos estáticos e imágenes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
