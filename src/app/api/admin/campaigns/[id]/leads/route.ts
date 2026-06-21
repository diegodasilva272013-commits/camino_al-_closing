import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return null;
  return { admin };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') ?? '0');
  const pageSize = 100;

  let q = (admin as any)
    .from('campaign_leads')
    .select(`
      id, status, sent_at, delivered_at, read_at, replied_at, failed_at, error_message, message_body,
      leads!campaign_leads_lead_id_fkey(id, first_name, last_name, phone, country, status),
      profiles!campaign_leads_setter_id_fkey(id, full_name)
    `)
    .eq('campaign_id', params.id)
    .order('created_at', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const body = await req.json();
  // segment: { status?: string, setter_ids?: string[], lead_ids?: string[] }
  const segment = body.segment ?? {};

  // Build query for leads matching segment
  let leadsQ = (admin as any)
    .from('leads')
    .select('id, assigned_to_user_id')
    .range(0, 9999);

  if (segment.status) leadsQ = leadsQ.eq('status', segment.status);
  if (segment.setter_ids?.length) leadsQ = leadsQ.in('assigned_to_user_id', segment.setter_ids);
  if (segment.lead_ids?.length) leadsQ = leadsQ.in('id', segment.lead_ids);

  const { data: leads, error: leadsErr } = await leadsQ;
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });

  if (!leads?.length) return NextResponse.json({ added: 0, skipped: 0 });

  // Check which leads are already in campaign
  const { data: existing } = await (admin as any)
    .from('campaign_leads')
    .select('lead_id')
    .eq('campaign_id', params.id);

  const existingSet = new Set((existing ?? []).map((r: any) => r.lead_id));
  const toInsert = (leads as any[]).filter((l) => !existingSet.has(l.id));

  if (!toInsert.length) return NextResponse.json({ added: 0, skipped: leads.length });

  // Insert in chunks of 500
  let added = 0;
  const chunks = [];
  for (let i = 0; i < toInsert.length; i += 500) chunks.push(toInsert.slice(i, i + 500));

  for (const chunk of chunks) {
    const rows = chunk.map((l: any) => ({
      campaign_id: params.id,
      lead_id: l.id,
      setter_id: l.assigned_to_user_id ?? null,
    }));
    const { error } = await (admin as any).from('campaign_leads').insert(rows);
    if (!error) added += rows.length;
  }

  // Update campaign total_leads count
  const { data: total } = await (admin as any)
    .from('campaign_leads')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', params.id);

  await (admin as any)
    .from('campaigns')
    .update({ total_leads: (total as any)?.count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ added, skipped: leads.length - added });
}
