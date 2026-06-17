import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 1) return NextResponse.json([]);

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', `%${q}%`)
    .neq('id', user.id)
    .limit(6);

  return NextResponse.json(
    (data ?? []).filter((u) => u.full_name).map((u) => ({ id: u.id, full_name: u.full_name }))
  );
}
