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
  try {
    const { ok, adminClient: admin } = await authorize(req);
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // ── 0. Verificar que la migración 0037 fue ejecutada ─────────────────────
    const { error: migErr } = await admin
      .from('conversation_analyses')
      .select('motor_processed_at')
      .limit(0);

    if (migErr) {
      return NextResponse.json({
        error: `Migración 0037 pendiente — ejecutá supabase/migrations/0037_motor_b_schema.sql en Supabase SQL Editor. Detalle: ${migErr.message}`,
      }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | null = body.user_id ?? null;

    // ── 1. Cargar capacidades activas desde DB ────────────────────────────────
    const { data: capsRaw, error: capsErr } = await admin
      .from('capacidades')
      .select('id, clave, nombre, claves_alias')
      .eq('activo', true)
      .order('orden');

    if (capsErr) {
      return NextResponse.json({ error: `Error al leer capacidades: ${capsErr.message}` }, { status: 500 });
    }

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
      const { data: profiles } = await admin.from('profiles').select('id').eq('role', 'setter');
      userIds = (profiles ?? []).map((p: any) => p.id as string);
    }

    // ── 3. Procesar cada setter ───────────────────────────────────────────────
    const summary = {
      users_processed:  0,
      users_skipped:    0,
      created:          { evidencias: 0, comportamientos: 0 },
      errors:           [] as string[],
      debug:            [] as string[],
    };

    for (const userId of userIds) {
      try {
        const result = await processUser(admin, userId, capMap, capNameMap, openai);
        if (result.debug) summary.debug.push(...result.debug);
        if (result.skipped) {
          summary.users_skipped++;
          summary.debug.push(`SKIP ${userId}: ${result.skipReason ?? 'sin persona y no se pudo crear'}`);
          continue;
        }
        summary.users_processed++;
        summary.created.evidencias      += result.evidencias;
        summary.created.comportamientos += result.comportamientos;
      } catch (err: any) {
        summary.errors.push(`${userId}: ${err.message}`);
      }
    }

    // ── 4. Recalcular patrones ────────────────────────────────────────────────
    try { await admin.rpc('calcular_patrones'); } catch (e: any) {
      summary.debug.push(`calcular_patrones error: ${e?.message}`);
    }

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[motor/run]', err);
    return NextResponse.json({ error: err?.message ?? 'Error interno del motor' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface ProcessResult {
  skipped:      boolean;
  skipReason?:  string;
  evidencias:   number;
  comportamientos: number;
  debug:        string[];
}

async function processUser(
  admin:      any,
  userId:     string,
  capMap:     Map<string, string>,
  capNameMap: Map<string, string>,
  openaiClient: OpenAI,
): Promise<ProcessResult> {
  const debug: string[] = [];

  // ── Resolver o crear persona ──────────────────────────────────────────────
  let personaId: string;

  const { data: personaExist } = await admin
    .from('personas')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (personaExist) {
    personaId = personaExist.id as string;
    debug.push(`persona OK: ${personaId}`);
  } else {
    // Auto-crear: idéntico al backfill de 0036
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return { skipped: true, skipReason: 'no existe en profiles', evidencias: 0, comportamientos: 0, debug };
    }

    const { data: newP, error: newPErr } = await admin
      .from('personas')
      .insert({
        nombre:       profile.full_name ?? profile.email ?? 'Sin nombre',
        email:        profile.email ?? '',
        rol_actual:   'setter',
        activo:       true,
        user_id:      userId,
        fecha_ingreso: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (newPErr || !newP) {
      return { skipped: true, skipReason: `no pudo crear persona: ${newPErr?.message}`, evidencias: 0, comportamientos: 0, debug };
    }

    personaId = newP.id as string;
    debug.push(`persona CREADA: ${personaId}`);
  }

  let evidencias      = 0;
  let comportamientos = 0;

  // ── A. Conversaciones ────────────────────────────────────────────────────
  const { data: convs, error: convsErr } = await admin
    .from('conversation_analyses')
    .select('id, analysis, created_at')
    .eq('user_id', userId)
    .eq('status', 'ready')
    .is('motor_processed_at', null);

  if (convsErr) {
    debug.push(`conversaciones ERROR: ${convsErr.message}`);
  } else {
    debug.push(`conversaciones encontradas: ${convs?.length ?? 0}`);
  }

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
      debug.push(`conv ${conv.id} evidencia skip: ${evErr.message}`);
      await admin.from('conversation_analyses').update({ motor_processed_at: new Date().toISOString() }).eq('id', conv.id);
      continue;
    }

    evidencias++;

    const behaviors = extractFromConversation(a, capMap, capNameMap, ev.id, personaId, fecha);
    if (behaviors.length) {
      const { error: bErr } = await admin.from('comportamientos').insert(behaviors);
      if (bErr) debug.push(`comportamientos insert error: ${bErr.message}`);
      else comportamientos += behaviors.length;
    }

    await admin.from('conversation_analyses').update({ motor_processed_at: new Date().toISOString() }).eq('id', conv.id);
  }

  // ── B. Formularios ───────────────────────────────────────────────────────
  const { data: subs, error: subsErr } = await admin
    .from('reinforcement_submissions')
    .select('id, total_score, nivel_general, submitted_at, reinforcement_forms(title)')
    .eq('user_id', userId)
    .eq('status', 'analyzed')
    .is('motor_processed_at', null);

  if (subsErr) {
    debug.push(`formularios ERROR: ${subsErr.message}`);
  } else {
    debug.push(`formularios encontrados: ${subs?.length ?? 0}`);
  }

  for (const sub of (subs ?? []) as any[]) {
    const fecha = (sub.submitted_at as string)?.split('T')[0] ?? new Date().toISOString().split('T')[0];
    const title = sub.reinforcement_forms?.title ?? 'Formulario CAC';

    const { error: evErr } = await admin.from('evidencias').insert({
      persona_id:        personaId,
      tipo:              'evaluacion',
      fecha,
      contenido_resumen: `${title} — Score: ${sub.total_score ?? '?'}/100 (${sub.nivel_general ?? 'sin nivel'})`,
      fuente_tipo:       'formulario',
      fuente_externa_id: sub.id,
    });

    if (evErr) {
      debug.push(`formulario ${sub.id} evidencia skip: ${evErr.message}`);
    } else {
      evidencias++;
    }

    await admin.from('reinforcement_submissions').update({ motor_processed_at: new Date().toISOString() }).eq('id', sub.id);
  }

  // ── C. Trainer sessions ──────────────────────────────────────────────────
  const { data: sessions, error: sessionsErr } = await admin
    .from('trainer_sessions')
    .select('id, scenario_name, last_evaluation, started_at, ended_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .is('motor_processed_at', null);

  if (sessionsErr) {
    debug.push(`trainer ERROR: ${sessionsErr.message}`);
  } else {
    debug.push(`trainer sessions encontradas: ${sessions?.length ?? 0}`);
  }

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
      debug.push(`trainer ${session.id} evidencia skip: ${evErr.message}`);
      await admin.from('trainer_sessions').update({ motor_processed_at: new Date().toISOString() }).eq('id', session.id);
      continue;
    }

    evidencias++;

    if (session.last_evaluation) {
      const behaviors = await extractFromTrainerSession(
        session.last_evaluation, capNameMap, ev.id, personaId, fecha, openaiClient,
      );
      if (behaviors.length) {
        const { error: bErr } = await admin.from('comportamientos').insert(behaviors);
        if (bErr) debug.push(`trainer comportamientos error: ${bErr.message}`);
        else comportamientos += behaviors.length;
      }
    }

    await admin.from('trainer_sessions').update({ motor_processed_at: new Date().toISOString() }).eq('id', session.id);
  }

  return { skipped: false, evidencias, comportamientos, debug };
}
