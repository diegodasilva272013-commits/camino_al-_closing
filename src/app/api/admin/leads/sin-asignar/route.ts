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

  // IDs ya distribuidos a algún equipo (via source_lead_id)
  const { data: distributed } = await admin
    .from('team_leads')
    .select('source_lead_id')
    .not('source_lead_id', 'is', null);

  const usedIds: string[] = (distributed ?? []).map((r: any) => r.source_lead_id).filter(Boolean);

  let q = admin
    .from('leads')
    .select('id, first_name, last_name, phone, country', { count: 'exact' })
    .is('assigned_to_user_id', null);

  if (usedIds.length) q = q.not('id', 'in', `(${usedIds.join(',')})`);

  const preview = req.nextUrl.searchParams.get('preview') === 'true';
  if (!preview) q = q.limit(1); // solo count

  const { data, count, error } = await q.limit(preview ? 20 : 1);
  if (error) return NextResponse.json({ count: 0, leads: [] });

  return NextResponse.json({ count: count ?? 0, leads: preview ? (data ?? []) : [] });
}
