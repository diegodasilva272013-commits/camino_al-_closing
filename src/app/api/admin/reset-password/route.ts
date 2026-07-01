import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function getOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(req.url).origin;
}

// POST { email } — admin dispara un reset de contraseña para cualquier usuario
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((prof as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });

  // Usamos el cliente regular (anon) para disparar el email — no necesita service role
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getOrigin(req)}/api/auth/callback?next=/reset-password`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
