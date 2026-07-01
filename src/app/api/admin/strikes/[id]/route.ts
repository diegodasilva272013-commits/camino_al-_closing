import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') return null;
  return user;
}

// DELETE — eliminar un strike
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from('strikes').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
