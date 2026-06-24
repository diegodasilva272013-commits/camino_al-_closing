import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { MOTOR_CAC_CEO_SYSTEM, buildAnalysisPrompt } from '@/lib/motor-cac-ceo';
import { loadMemory, buildMemoryContext, updatePatterns, updateBehaviors } from '@/lib/founder-memory';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

// GET /api/founder/evidences — lista con análisis anidados
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const { data, error } = await (admin as any)
    .from('founder_evidences')
    .select(`
      id, title, type, context, duration_min, date_recorded,
      analysis_status, created_at,
      founder_analyses(id, capacities, patterns, exercises, created_at)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/founder/evidences — DESACTIVADO (F5-A: sistema 0025/0026 en modo lectura)
// Las nuevas evidencias del founder van a /api/d2030/evidencia (sistema 0029)
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Sistema legacy desactivado. Usá /api/d2030/evidencia — sistema 0029 es la fuente de verdad.' },
    { status: 410 }
  );
}

async function updateCapacitySnapshot(admin: any) {
  try {
    const { data: allAnalyses } = await admin.from('founder_analyses').select('capacities');
    if (!allAnalyses?.length) return;

    const caps = ['claridad_ejecutiva','priorizacion','delegacion','seguimiento','comunicacion_ejecutiva','presencia'];
    const scores: Record<string, number> = {};

    for (const cap of caps) {
      const capScores = allAnalyses
        .map((a: any) => a.capacities?.[cap]?.score)
        .filter((s: any) => s != null && typeof s === 'number');
      if (capScores.length) {
        scores[cap] = Math.round(capScores.reduce((a: number, b: number) => a + b, 0) / capScores.length * 10) / 10;
      }
    }

    const avgDist = Object.values(scores).length
      ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length * 10) / 10
      : null;

    const today = new Date().toISOString().split('T')[0];
    await admin.from('founder_capacity_snapshots').upsert({
      snapshot_date:  today,
      scores,
      evidence_count: allAnalyses.length,
      avg_2030_dist:  avgDist,
    }, { onConflict: 'snapshot_date' });
  } catch {}
}
