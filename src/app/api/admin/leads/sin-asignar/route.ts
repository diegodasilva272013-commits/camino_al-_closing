import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ count: 0 }, { status: 403 });

  const preview = req.nextUrl.searchParams.get('preview') === 'true';

  // RPCs en SQL que usan NOT EXISTS — eficiente con índice, sin IN de miles de UUIDs.
  const [countRes, leadsRes] = await Promise.all([
    admin.rpc('leads_sin_asignar_count'),
    preview
      ? admin.rpc('leads_sin_asignar', { p_limit: 20 })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    count: Number(countRes.data ?? 0),
    leads: leadsRes.data ?? [],
  });
}
