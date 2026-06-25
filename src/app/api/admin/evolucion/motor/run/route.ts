import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import {
  buildCapMaps,
  extractFromConversation,
  extractFromTrainerSession,
  type CapEntry,
} from '@/lib/motor-cac-extractor';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Acepta admin logueado o CRON_SECRET (para auto-trigger desde otros endpoints)
async function authorize(req: NextRequest): Promise<{ ok: boolean; adminClient: any }> {
  const auth  = req.headers.get('authorization');
  const admin = createSupabaseAdminClient() as any;

  if (auth === `Bearer ${process.env.CRON_SECRET}`) return { ok: true, adminClient: admin };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, adminClient: null };
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return { ok: false, adminClient: null };
  return { ok: true, adminClient: admin };
}

export async function POST(req: NextRequest) {
  const { ok, adminClient: admin } = await authorize(req);
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId: string | null = body.user_id ?? null;

  // ── 1. Cargar capacidades activas (fuente de verdad, no hay listas fijas) ──
  const { data: capsRaw } = await admin
    .from('capacidades')
    .select('id, clave, nombre, claves_alias')
    .eq('activo', true)
    .order('orden');

  const caps: CapEntry[] = (capsRaw ?? []).map((c: any) => ({
    id:           c.id,
    clave:        c.clave ?? null,
    nombre:       c.nombre,
    claves_alias: c.claves_alias ?? [],
  }));

  const { capMap, capNameMap } = buildCapMaps(caps);

  // ── 2. Resolver setters a procesar ────────────────────────────────────────
  let userIds: string[] = [];
  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'setter');
    userIds = (profiles ?? []).map((p: any) => p.id as string);
  }

  // ── 3. Procesar cada setter ───────────────────────────────────────────────
  const summary = {
    users_processed: 0,
    users_skipped:   0,
    created: { evidencias: 0, comportamientos: 0 },
    errors: [] as string[],
  };

  for (const userId of userIds) {
    try {
      const result = await processUser(admin, userId, capMap, capNameMap);
      if (result.skipped) { summary.users_skipped++; continue; }
      summary.users_processed++;
      summary.created.evidencias      += result.evidencias;
      summary.created.comportamientos += result.comportamientos;
    } catch (err: any) {
      summary.errors.push(`${userId}: ${err.message}`);
    }
  }

  // ── 4. Recalcular patrones (función SQL existente, procesa todos) ─────────
  await admin.rpc('calcular_patrones').catch(() => {});

  return NextResponse.json(summary);
}

// ─────────────────────────────────────────────────────────────────────────────

async function processUser(
  admin:      any,
  userId:     string,
  capMap:     Map<string, string>,
  capNameMap: Map<string, string>,
): Promise<{ skipped: boolean; evidencias: number; comportamientos: number }> {
  // Resolver persona_id (debe existir tras el backfill de 0036)
  const { data: persona } = await admin
    .from('personas')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!persona) return { skipped: true, evidencias: 0, comportamientos: 0 };
  const personaId = persona.id as string;

  let evidencias      = 0;
  let comportamientos = 0;

  // ── A. Conversaciones ────────────────────────────────────────────────────
  const { data: convs } = await admin
    .from('conversation_analyses')
    .select('id, analysis, created_at')
    .eq('user_id', userId)
    .eq('status', 'ready')
    .is('motor_processed_at', null);

  for (const conv of (convs ?? []) as any[]) {
    const a     = conv.analysis ?? {};
    const fecha = (conv.created_at as string)?.split('T')[0] ?? new Date().toISOString().split('T')[0];

    const resumen = [
      a.resultado_probable ? `Resultado: ${a.resultado_probable}` : null,
      a.fortalezas?.length ? `Fortalezas: ${(a.fortalezas as string[]).join(' · ')}` : null,
      a.errores?.length    ? `Errores: ${(a.errores as string[]).join(' · ')}`        : null,
      a.donde_se_rompio    ? `Quiebre: ${a.donde_se_rompio}`                          : null,
    ].filter(Boolean).join('. ');

    const { data: ev, error: evErr } = await admin
      .from('evidencias')
      .insert({
        persona_id:        personaId,
        tipo:              'conversacion',
        fecha,
        contenido_resumen: resumen,
        fuente_tipo:       'conversation',
        fuente_externa_id: conv.id,
      })
      .select('id')
      .single();

    if (evErr) {
      // Duplicado (índice único) → ya procesado antes, marcar y continuar
      await admin.from('conversation_analyses')
        .update({ motor_processed_at: new Date().toISOString() })
        .eq('id', conv.id);
      continue;
    }

    evidencias++;

    const behaviors = extractFromConversation(a, capMap, capNameMap, ev.id, personaId, fecha);
    if (behaviors.length) {
      await admin.from('comportamientos').insert(behaviors);
      comportamientos += behaviors.length;
    }

    await admin.from('conversation_analyses')
      .update({ motor_processed_at: new Date().toISOString() })
      .eq('id', conv.id);
  }

  // ── B. Formularios (evidencia sin comportamientos — categorías ≠ capacidades) ─
  const { data: subs } = await admin
    .from('reinforcement_submissions')
    .select('id, total_score, nivel_general, submitted_at, reinforcement_forms(title)')
    .eq('user_id', userId)
    .eq('status', 'analyzed')
    .is('motor_processed_at', null);

  for (const sub of (subs ?? []) as any[]) {
    const fecha = (sub.submitted_at as string)?.split('T')[0] ?? new Date().toISOString().split('T')[0];
    const title = sub.reinforcement_forms?.title ?? 'Formulario CAC';

    await admin.from('evidencias').insert({
      persona_id:        personaId,
      tipo:              'evaluacion',
      fecha,
      contenido_resumen: `${title} — Score: ${sub.total_score ?? '?'}/100 (${sub.nivel_general ?? 'sin nivel'})`,
      fuente_tipo:       'formulario',
      fuente_externa_id: sub.id,
    });
    // Ignorar error de duplicado silenciosamente

    evidencias++;

    await admin.from('reinforcement_submissions')
      .update({ motor_processed_at: new Date().toISOString() })
      .eq('id', sub.id);
  }

  // ── C. Trainer sessions ──────────────────────────────────────────────────
  const { data: sessions } = await admin
    .from('trainer_sessions')
    .select('id, scenario_name, last_evaluation, started_at, ended_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .is('motor_processed_at', null);

  for (const session of (sessions ?? []) as any[]) {
    const fecha = ((session.ended_at ?? session.started_at) as string)?.split('T')[0]
      ?? new Date().toISOString().split('T')[0];

    const { data: ev, error: evErr } = await admin
      .from('evidencias')
      .insert({
        persona_id:        personaId,
        tipo:              'simulacion',
        fecha,
        contenido_resumen: [
          session.scenario_name ? `Escenario: ${session.scenario_name}` : null,
          session.last_evaluation ? (session.last_evaluation as string).slice(0, 300) : null,
        ].filter(Boolean).join('. '),
        fuente_tipo:       'trainer',
        fuente_externa_id: session.id,
      })
      .select('id')
      .single();

    if (evErr) {
      await admin.from('trainer_sessions')
        .update({ motor_processed_at: new Date().toISOString() })
        .eq('id', session.id);
      continue;
    }

    evidencias++;

    if (session.last_evaluation) {
      const behaviors = await extractFromTrainerSession(
        session.last_evaluation,
        capNameMap,
        ev.id,
        personaId,
        fecha,
        openai,
      );
      if (behaviors.length) {
        await admin.from('comportamientos').insert(behaviors);
        comportamientos += behaviors.length;
      }
    }

    await admin.from('trainer_sessions')
      .update({ motor_processed_at: new Date().toISOString() })
      .eq('id', session.id);
  }

  return { skipped: false, evidencias, comportamientos };
}
