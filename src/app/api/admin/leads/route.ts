import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireAdmin(supabase);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { searchParams } = req.nextUrl;
    const userId   = searchParams.get('user_id');
    const status   = searchParams.get('status');
    const batchId  = searchParams.get('batch_id');
    const source   = searchParams.get('source');

    let query = admin
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_user_id_fkey(id, full_name, email)')
      .order('created_at', { ascending: false });

    if (userId)  query = query.eq('assigned_to_user_id', userId);
    if (status)  query = query.eq('current_status', status);
    if (batchId) query = query.eq('batch_id', batchId);
    if (source)  query = query.eq('source', source);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
