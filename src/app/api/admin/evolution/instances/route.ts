import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { evolutionCreateInstance } from '@/lib/evolution';

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

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const { data, error } = await (admin as any)
    .from('evolution_instances')
    .select('id, name, instance_key, api_url, status, phone_number, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { user, admin } = ctx;

  const { name, instance_key, api_url, api_token } = await req.json();
  if (!name?.trim() || !instance_key?.trim() || !api_url?.trim() || !api_token?.trim()) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
  }

  // Create instance in Evolution API
  try {
    await evolutionCreateInstance(api_url.trim(), api_token.trim(), instance_key.trim());
  } catch (e: any) {
    // If already exists in Evolution API, continue
    if (!e?.message?.includes('already')) {
      return NextResponse.json({ error: `Evolution API: ${e?.message}` }, { status: 400 });
    }
  }

  // Save to DB
  const { data, error } = await (admin as any).from('evolution_instances').insert({
    name: name.trim(),
    instance_key: instance_key.trim(),
    api_url: api_url.trim(),
    api_token: api_token.trim(),
    status: 'disconnected',
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
