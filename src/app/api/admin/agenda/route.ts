import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/agenda — todas las reuniones del sistema (admin only)
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const url = req.nextUrl;
  const desde    = url.searchParams.get('desde');
  const hasta    = url.searchParams.get('hasta');
  const estado   = url.searchParams.get('estado');
  const closerId = url.searchParams.get('closer_id');
  const setterId = url.searchParams.get('setter_id');

  let query = admin
    .from('reuniones')
    .select(`
      *,
      closer:profiles!reuniones_closer_id_fkey(id, full_name, avatar_url),
      setter:profiles!reuniones_setter_id_fkey(id, full_name, avatar_url),
      lead:leads(id, first_name, last_name, phone, current_status),
      team_lead:team_leads(id, first_name, last_name, phone, current_status)
    `)
    .order('inicio', { ascending: true });

  if (desde)    query = query.gte('inicio', desde);
  if (hasta)    query = query.lte('inicio', hasta);
  if (estado)   query = query.eq('estado', estado);
  if (closerId) query = query.eq('closer_id', closerId);
  if (setterId) query = query.eq('setter_id', setterId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
