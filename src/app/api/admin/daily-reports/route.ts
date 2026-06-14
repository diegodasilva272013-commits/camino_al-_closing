import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const userId = req.nextUrl.searchParams.get('user_id');
    const date   = req.nextUrl.searchParams.get('date');

    let query = admin
      .from('daily_reports')
      .select('*, user:profiles!daily_reports_user_id_fkey(full_name, email)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (date)   query = query.eq('date', date);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
