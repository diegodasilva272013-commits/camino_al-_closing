import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { rows, batch_id } = body as {
      rows: { first_name: string; last_name?: string; phone: string; country?: string; source?: string }[];
      batch_id?: string;
    };

    if (!rows?.length) return NextResponse.json({ error: 'Sin filas' }, { status: 400 });

    const invalid = rows.filter((r) => !r.phone || !r.first_name);
    if (invalid.length) {
      return NextResponse.json(
        { error: `${invalid.length} filas sin teléfono o nombre` },
        { status: 400 }
      );
    }

    const batchId = batch_id ?? `batch-${Date.now()}`;
    const inserts = rows.map((r) => ({
      first_name: r.first_name,
      last_name:  r.last_name ?? null,
      phone:      r.phone,
      country:    r.country ?? null,
      source:     r.source ?? null,
      batch_id:   batchId,
    }));

    const { data, error } = await admin
      .from('leads')
      .insert(inserts)
      .select('id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ imported: data?.length ?? 0, batch_id: batchId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
