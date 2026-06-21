import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  await (admin as any)
    .from('announcement_reads')
    .upsert(
      { announcement_id: params.id, user_id: user.id },
      { onConflict: 'announcement_id,user_id' }
    );

  return NextResponse.json({ ok: true });
}
