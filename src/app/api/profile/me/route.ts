import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('id, full_name, email, role, avatar_url, bloqueado, bloqueado_motivo').eq('id', user.id).single();
  return NextResponse.json(profile ?? { id: user.id, email: user.email, full_name: null, role: null });
}
