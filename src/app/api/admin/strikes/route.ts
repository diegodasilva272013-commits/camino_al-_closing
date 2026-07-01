import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') return null;
  return user;
}

// POST { setter_id, reason, category?, severity? } — emitir un strike
export async function POST(req: NextRequest) {
  const admin_user = await requireAdmin();
  if (!admin_user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;
  const { setter_id, reason, category, severity } = await req.json();

  if (!setter_id || !reason?.trim()) {
    return NextResponse.json({ error: 'setter_id y reason son obligatorios' }, { status: 400 });
  }

  const { data, error } = await admin.from('strikes').insert({
    setter_id,
    issued_by: admin_user.id,
    reason:    reason.trim(),
    category:  category ?? 'otro',
    severity:  Number(severity) || 1,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
