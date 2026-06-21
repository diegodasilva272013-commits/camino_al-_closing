import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin(req?: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return null;
  return { user, admin };
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const { data, error } = await (admin as any)
    .from('campaigns')
    .select('*, message_templates(id,title,category), evolution_instances(id,name,status,phone_number)')
    .order('created_at', { ascending: false })
    .range(0, 199);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { user, admin } = ctx;

  const body = await req.json();
  const { name, description, channel, template_id, evolution_instance_id, send_rules, target_segment, starts_at, ends_at } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const insert: Record<string, any> = {
    name: name.trim(),
    description: description?.trim() ?? null,
    channel: channel ?? 'manual',
    template_id: template_id ?? null,
    evolution_instance_id: evolution_instance_id ?? null,
    send_rules: send_rules ?? { max_per_hour: 80, pause_seconds: 30, auto_stop_fail_rate: 0.3 },
    target_segment: target_segment ?? {},
    created_by: user.id,
    starts_at: starts_at ?? null,
    ends_at: ends_at ?? null,
  };

  const { data, error } = await (admin as any).from('campaigns').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
