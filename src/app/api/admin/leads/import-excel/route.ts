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
  'sin contactado': 'NO_CONTACTADO',
  'sin contactar': 'NO_CONTACTADO',
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
      .select('id, full_name, role')
      .in('role', ['setter', 'admin', 'mentor']);

    const setterByName = new Map<string, { id: string; full_name: string | null }>();
    for (const s of setters ?? []) {
      if (s.full_name) setterByName.set(normalizeName(s.full_name), s);
    }

    function matchSetter(sheetName: string) {
      const norm = normalizeName(sheetName);

      // 1. Exact match
      if (setterByName.has(norm)) return setterByName.get(norm)!;

      // 2. Substring match
      for (const [name, s] of setterByName) {
        if (name.includes(norm) || norm.includes(name)) return s;
      }

      // 3. Word-token fuzzy match (handles different order + Excel 31-char truncation)
      const sheetWords = norm.split(/\s+/).filter(Boolean);
      let bestMatch: { s: { id: string; full_name: string | null }; score: number } | null = null;

      for (const [name, s] of setterByName) {
        const nameWords = name.split(/\s+/).filter(Boolean);
        let matchCount = 0;
        for (const sw of sheetWords) {
          // prefix match: "barr" matches "barrientos" (handles Excel truncation)
          if (nameWords.some((nw) => nw.startsWith(sw) || sw.startsWith(nw))) {
            matchCount++;
          }
        }
        const score = matchCount / sheetWords.length;
        if (score >= 0.6 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { s, score };
        }
      }

      return bestMatch?.s ?? null;
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

    // Deduplicación: buscar teléfonos existentes con su asignación actual
    const incomingPhones = inserts.map((r) => r.phone);
    const PHONE_CHUNK = 500;
    // phone → { assigned: boolean }
    const existingMap = new Map<string, { assigned: boolean }>();
    for (let i = 0; i < incomingPhones.length; i += PHONE_CHUNK) {
      const chunk = incomingPhones.slice(i, i + PHONE_CHUNK);
      const { data: existing } = await admin
        .from('leads')
        .select('phone, assigned_to_user_id')
        .in('phone', chunk);
      for (const row of existing ?? []) {
        existingMap.set(row.phone, { assigned: !!row.assigned_to_user_id });
      }
    }

    // Leads nuevos → insertar
    const newInserts = inserts.filter((r) => !existingMap.has(r.phone));
    // Leads ya existentes pero SIN asignar y que ahora tienen setter → actualizar
    const toReassign = inserts.filter((r) => {
      const ex = existingMap.get(r.phone);
      return ex && !ex.assigned && r.assigned_to_user_id;
    });
    const skipped = inserts.length - newInserts.length - toReassign.length;

    // Actualizar asignación de leads que estaban sin setter
    let reassigned = 0;
    for (const r of toReassign) {
      await admin
        .from('leads')
        .update({ assigned_to_user_id: r.assigned_to_user_id, assigned_at: r.assigned_at })
        .eq('phone', r.phone);
      reassigned++;
    }

    const CHUNK = 500;
    let imported = 0;
    for (let i = 0; i < newInserts.length; i += CHUNK) {
      const chunk = newInserts.slice(i, i + CHUNK);
      const { data, error } = await admin.from('leads').insert(chunk).select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      imported += data?.length ?? 0;
    }

    const messageParts: string[] = [];
    if (skipped > 0) messageParts.push(`${skipped} ya asignados (omitidos)`);
    if (reassigned > 0) messageParts.push(`${reassigned} sin asignar → ahora asignados`);

    return NextResponse.json({
      imported,
      skipped,
      reassigned,
      batch_id: batchId,
      perSheet,
      message: messageParts.length ? messageParts.join(' · ') : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
