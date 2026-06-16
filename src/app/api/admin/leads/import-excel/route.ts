import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { LEAD_STATUSES, type LeadStatus } from '@/constants/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IncomingRow = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  status?: string;
  notes?: string;
};

type IncomingSheet = {
  name: string;
  rows: IncomingRow[];
};

const STATUS_ALIASES: Record<string, LeadStatus> = {
  pendiente: 'NO_CONTACTADO',
  contactado: 'CONTACTADO',
  'no contactado': 'NO_CONTACTADO',
  contesto: 'RESPONDIO',
  'contestó': 'RESPONDIO',
  respondio: 'RESPONDIO',
  'respondió': 'RESPONDIO',
  'no contesta': 'NO_RESPONDE',
  noresponde: 'NO_RESPONDE',
  'en seguimiento': 'SEGUIMIENTO_FUTURO',
  seguimiento: 'SEGUIMIENTO_FUTURO',
  interes: 'INTERES_DETECTADO',
  'interés': 'INTERES_DETECTADO',
  grupo: 'INGRESO_AL_GRUPO',
  'ingreso al grupo': 'INGRESO_AL_GRUPO',
  'activo en grupo': 'ACTIVO_EN_GRUPO',
  diagnostico: 'DIAGNOSTICO_INICIADO',
  'diagnóstico': 'DIAGNOSTICO_INICIADO',
  'reunion propuesta': 'REUNION_PROPUESTA',
  'reunión propuesta': 'REUNION_PROPUESTA',
  'reunion agendada': 'REUNION_AGENDADA',
  'reunión agendada': 'REUNION_AGENDADA',
  'no califica': 'NO_CALIFICA',
};

function normalizeStatus(raw?: string): LeadStatus {
  if (!raw) return 'NO_CONTACTADO';
  const key = raw.trim().toLowerCase();
  if ((LEAD_STATUSES as readonly string[]).includes(raw.trim().toUpperCase())) {
    return raw.trim().toUpperCase() as LeadStatus;
  }
  return STATUS_ALIASES[key] ?? 'NO_CONTACTADO';
}

function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
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
    const sheets = body?.sheets as IncomingSheet[] | undefined;
    if (!sheets?.length) return NextResponse.json({ error: 'Sin hojas para importar' }, { status: 400 });

    const { data: setters } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'setter');

    const setterByName = new Map<string, { id: string; full_name: string | null }>();
    for (const s of setters ?? []) {
      if (s.full_name) setterByName.set(normalizeName(s.full_name), s);
    }

    function matchSetter(sheetName: string) {
      const norm = normalizeName(sheetName);
      if (setterByName.has(norm)) return setterByName.get(norm)!;
      for (const [name, s] of setterByName) {
        if (name.includes(norm) || norm.includes(name)) return s;
      }
      return null;
    }

    const batchId = `xlsx-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const perSheet: { sheet: string; matchedSetter: string | null; rows: number }[] = [];
    const inserts: {
      first_name: string;
      last_name: string | null;
      phone: string;
      email: string | null;
      source: string;
      batch_id: string;
      current_status: LeadStatus;
      notes: string | null;
      assigned_to_user_id: string | null;
      assigned_at: string | null;
    }[] = [];

    for (const sheet of sheets) {
      const matched = matchSetter(sheet.name);
      let count = 0;
      for (const r of sheet.rows ?? []) {
        const phone = String(r.phone ?? '').trim();
        if (!phone) continue;
        const first_name = String(r.first_name ?? '').trim() || String(r.last_name ?? '').trim() || 'Sin nombre';
        inserts.push({
          first_name,
          last_name: String(r.last_name ?? '').trim() || null,
          phone,
          email: String(r.email ?? '').trim() || null,
          source: 'excel_import',
          batch_id: batchId,
          current_status: normalizeStatus(r.status),
          notes: String(r.notes ?? '').trim() || null,
          assigned_to_user_id: matched?.id ?? null,
          assigned_at: matched ? nowIso : null,
        });
        count++;
      }
      perSheet.push({ sheet: sheet.name, matchedSetter: matched?.full_name ?? null, rows: count });
    }

    if (!inserts.length) {
      return NextResponse.json({ error: 'Ninguna fila tenía teléfono válido.' }, { status: 400 });
    }

    const CHUNK = 500;
    let imported = 0;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const chunk = inserts.slice(i, i + CHUNK);
      const { data, error } = await admin.from('leads').insert(chunk).select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      imported += data?.length ?? 0;
    }

    return NextResponse.json({ imported, batch_id: batchId, perSheet });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
