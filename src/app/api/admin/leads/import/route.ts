import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalizePhone(p: string | null | undefined): string {
  return (p ?? '').replace(/\D/g, '');
}

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
      return NextResponse.json({ error: `${invalid.length} filas sin teléfono o nombre` }, { status: 400 });
    }

    const batchId = batch_id ?? `batch-${Date.now()}`;

    // Normalize and deduplicate within the incoming batch
    const batchSeen = new Set<string>();
    const uniqueRows: typeof rows = [];
    for (const r of rows) {
      const norm = normalizePhone(r.phone);
      if (!norm || batchSeen.has(norm)) continue;
      batchSeen.add(norm);
      uniqueRows.push(r);
    }

    // Check which phones already exist in DB (in chunks of 500)
    const existingNorm = new Set<string>();
    const phones = uniqueRows.map(r => r.phone);
    for (let i = 0; i < phones.length; i += 500) {
      const chunk = phones.slice(i, i + 500);
      const { data: existing } = await admin
        .from('leads')
        .select('phone')
        .in('phone', chunk);
      for (const e of existing ?? []) {
        existingNorm.add(normalizePhone(e.phone));
      }
    }

    const toInsert = uniqueRows
      .filter(r => !existingNorm.has(normalizePhone(r.phone)))
      .map(r => ({
        first_name: r.first_name,
        last_name:  r.last_name ?? null,
        phone:      r.phone,
        country:    r.country ?? null,
        source:     r.source ?? null,
        batch_id:   batchId,
      }));

    const skipped = rows.length - toInsert.length;

    if (!toInsert.length) {
      return NextResponse.json({ imported: 0, skipped, batch_id: batchId, message: 'Todos los teléfonos ya existen en la base de datos.' });
    }

    // Insertar en chunks de 500 para evitar timeout con lotes grandes
    const CHUNK = 500;
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { data, error } = await admin.from('leads').insert(chunk).select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      imported += data?.length ?? 0;
    }

    return NextResponse.json({
      imported,
      skipped,
      batch_id: batchId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
