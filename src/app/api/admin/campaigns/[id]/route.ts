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
  return { user, admin };
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const { data: campaign, error } = await (admin as any)
    .from('campaigns')
    .select('*, message_templates(id,title,category,body), evolution_instances(id,name,status,phone_number)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Stats per status
  const { data: stats } = await (admin as any)
    .from('campaign_leads')
    .select('status')
    .eq('campaign_id', params.id);

  const statusCounts: Record<string, number> = {};
  for (const row of stats ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  return NextResponse.json({ ...campaign, status_counts: statusCounts });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const body = await req.json();
  const allowed = ['name', 'description', 'status', 'channel', 'template_id', 'evolution_instance_id', 'send_rules', 'target_segment', 'starts_at', 'ends_at'];
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await (admin as any)
    .from('campaigns')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const { error } = await (admin as any).from('campaigns').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
