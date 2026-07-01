import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — todos los strikes del equipo (visible para cualquier setter autenticado)
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  const [strikesRes, profilesRes] = await Promise.all([
    admin.from('strikes')
      .select('id, setter_id, issued_by, reason, category, severity, created_at')
      .order('created_at', { ascending: false }),
    admin.from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .in('role', ['setter', 'admin']),
  ]);

  return NextResponse.json({
    strikes:  strikesRes.data  ?? [],
    profiles: profilesRes.data ?? [],
  });
}
