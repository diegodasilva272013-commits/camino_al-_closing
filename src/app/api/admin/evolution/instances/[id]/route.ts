import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { getEvolutionInstance, evolutionCheckStatus, evolutionDeleteInstance } from '@/lib/evolution';

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

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const instance = await getEvolutionInstance(params.id);
  if (!instance) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Check live status from Evolution API
  try {
    const statusData = await evolutionCheckStatus(instance);
    const state = statusData?.instance?.state ?? 'unknown';
    const newStatus = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting';
    const phone = statusData?.instance?.wuid?.replace('@s.whatsapp.net', '') ?? null;

    if (newStatus !== instance.status || phone !== instance.phone_number) {
      await (admin as any).from('evolution_instances').update({
        status: newStatus,
        phone_number: phone,
        updated_at: new Date().toISOString(),
      }).eq('id', params.id);
      instance.status = newStatus;
      instance.phone_number = phone;
    }
  } catch {
    // Evolution API unavailable — return DB state
  }

  return NextResponse.json(instance);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { admin } = ctx;

  const instance = await getEvolutionInstance(params.id);
  if (!instance) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  try { await evolutionDeleteInstance(instance); } catch { /* ignore */ }

  const { error } = await (admin as any).from('evolution_instances').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
