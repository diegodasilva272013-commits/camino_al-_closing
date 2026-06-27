import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

async function authorize(req: NextRequest): Promise<boolean> {
  const auth  = req.headers.get('authorization');
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const admin = createSupabaseAdminClient() as any;
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return p?.role === 'admin';
}

export async function POST(req: NextRequest) {
  try {
    const ok = await authorize(req);
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // La URL de DB la construimos desde NEXT_PUBLIC_SUPABASE_URL + SERVICE_ROLE_KEY
    // Supabase expone la DB en: postgresql://postgres.[ref]:[password]@aws-0-xx.pooler.supabase.com:6543/postgres
    // Pero el password de DB no es el service_role. Necesitamos SUPABASE_DB_PASSWORD o DATABASE_URL.
    const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_URL;
    if (!dbUrl) {
      return NextResponse.json({
        error: 'No hay DATABASE_URL en las variables de entorno. Pegá el SQL manualmente en Supabase SQL Editor.',
        sql_0036: getSql('0036_backfill_personas_from_setters.sql'),
        sql_0037: getSql('0037_motor_b_schema.sql'),
      }, { status: 400 });
    }

    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const results: string[] = [];

    for (const file of ['0036_backfill_personas_from_setters.sql', '0037_motor_b_schema.sql']) {
      const sql = getSql(file);
      if (!sql) { results.push(`${file}: archivo no encontrado`); continue; }
      try {
        await client.query(sql);
        results.push(`${file}: OK`);
      } catch (e: any) {
        results.push(`${file}: ${e.message}`);
      }
    }

    await client.end();
    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({
      error: e?.message ?? 'Error',
      sql_0036: getSql('0036_backfill_personas_from_setters.sql'),
      sql_0037: getSql('0037_motor_b_schema.sql'),
    }, { status: 500 });
  }
}

// GET: devuelve el SQL de las migraciones para copy-paste manual
export async function GET(req: NextRequest) {
  const ok = await authorize(req);
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return NextResponse.json({
    sql_0036: getSql('0036_backfill_personas_from_setters.sql'),
    sql_0037: getSql('0037_motor_b_schema.sql'),
  });
}

function getSql(filename: string): string | null {
  try {
    const p = path.join(process.cwd(), 'supabase', 'migrations', filename);
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}
