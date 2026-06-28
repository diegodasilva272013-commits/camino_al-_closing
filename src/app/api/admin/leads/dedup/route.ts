import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function normalizePhone(p: string | null | undefined): string {
  return (p ?? '').replace(/\D/g, '');
}

async function authAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return admin;
}

// GET → cuenta cuántos leads se eliminarían (sin borrar nada)
export async function GET() {
  try {
    const admin = await authAdmin();
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: all, error } = await admin
      .from('leads')
      .select('id, phone, assigned_to_user_id, follow_up_count, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const groups = new Map<string, any[]>();
    for (const lead of all ?? []) {
      const norm = normalizePhone(lead.phone);
      if (!norm) continue;
      const key = `${norm}::${lead.assigned_to_user_id ?? '__unassigned__'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lead);
    }

    let toDelete = 0;
    for (const [, leads] of groups) {
      if (leads.length > 1) toDelete += leads.length - 1;
    }

    return NextResponse.json({ duplicates: toDelete, total: (all ?? []).length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST → dedup per (phone, assigned_to_user_id): preserva el más activo, borra el resto.
// NO borra un lead si el mismo teléfono está en lista de otro setter (eso es válido).
export async function POST() {
  try {
    const admin = await authAdmin();
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Fetch all leads — up to 50k
    const { data: all, error: fetchErr } = await admin
      .from('leads')
      .select('id, phone, assigned_to_user_id, follow_up_count, updated_at, is_closed')
      .order('updated_at', { ascending: false })
      .limit(50000);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    // Group by (normalizedPhone + setter) — the same phone can exist for different setters
    const groups = new Map<string, any[]>();
    let skippedNoPhone = 0;

    for (const lead of all ?? []) {
      const norm = normalizePhone(lead.phone);
      if (!norm) { skippedNoPhone++; continue; }
      const key = `${norm}::${lead.assigned_to_user_id ?? '__unassigned__'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lead);
    }

    const toDelete: string[] = [];

    for (const [, leads] of groups) {
      if (leads.length <= 1) continue;

      // Keep the most active: highest follow_up_count, then most recent updated_at
      const sorted = [...leads].sort((a, b) => {
        const fcDiff = (b.follow_up_count ?? 0) - (a.follow_up_count ?? 0);
        if (fcDiff !== 0) return fcDiff;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      // Keep first, delete rest
      toDelete.push(...sorted.slice(1).map((l: any) => l.id));
    }

    if (!toDelete.length) {
      return NextResponse.json({ deleted: 0, message: 'No hay duplicados por setter.', skipped_no_phone: skippedNoPhone });
    }

    const CHUNK = 200;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const chunk = toDelete.slice(i, i + CHUNK);
      const { error } = await admin.from('leads').delete().in('id', chunk);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deleted += chunk.length;
    }

    return NextResponse.json({
      deleted,
      message: `${deleted} leads duplicados eliminados (por setter).`,
      skipped_no_phone: skippedNoPhone,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
