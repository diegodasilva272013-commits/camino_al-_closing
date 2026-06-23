import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('leads')
      .select('*')
      .eq('assigned_to_user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Dedup by phone — keep the most recently updated (first in desc order)
    const seen = new Set<string>();
    const deduped = (data ?? []).filter((l) => {
      const key = l.phone?.replace(/\D/g, '') ?? l.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(deduped);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
