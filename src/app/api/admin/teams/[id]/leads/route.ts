import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json([], { status: 403 });

  // JOIN a leads para datos de contacto (única fuente de verdad)
  const { data, error } = await admin
    .from('team_leads')
    .select('id, current_status, handled_by, created_at, source_lead_id, lead:leads!source_lead_id(first_name, last_name, phone)')
    .eq('team_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json([], { status: 500 });

  const flat = (data ?? []).map((tl: any) => ({
    id:             tl.id,
    source_lead_id: tl.source_lead_id,
    current_status: tl.current_status,
    handled_by:     tl.handled_by,
    created_at:     tl.created_at,
    first_name:     tl.lead?.first_name ?? '',
    last_name:      tl.lead?.last_name  ?? null,
    phone:          tl.lead?.phone      ?? '',
  }));

  return NextResponse.json(flat);
}
