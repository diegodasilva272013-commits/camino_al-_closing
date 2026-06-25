import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { extractFromConversation, extractFromTrainerSession } from '@/lib/motor-cac-extractor';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Mapa fijo de claves de análisis → nombre de capacidad
// Cubre tanto el formato viejo (8 claves) como el nuevo (9 claves con clave de DB)
const KEY_TO_NOMBRE: Record<string, string> = {
  intencion:               'Criterio',
  rapport:                 'Comunicación',
  empatia_profesional:     'Comunicación',
  diagnostico:             'Diagnóstico',
  generacion_interes:      'Generación de interés',
  seguimiento:             'Seguimiento',
  profesionalismo:         'Profesionalismo operativo',
  criterio:                'Criterio',
  escucha:                 'Escucha',
  comunicacion:            'Comunicación',
  profesionalismo_operativo: 'Profesionalismo operativo',
  adaptabilidad:           'Adaptabilidad',
  profesionalismo_canal:   'Profesionalismo de canal',
};

async function authorize(req: NextRequest): Promise<{ ok: boolean; admin: any }> {
  const auth  = req.headers.get('authorization');
  const admin = createSupabaseAdminClient() as any;
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return { ok: true, admin };
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, admin: null };
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return { ok: false, admin: null };
  return { ok: true, admin };
}

export async function POST(req: NextRequest) {
  try {
    const { ok, admin } = await authorize(req);
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | null = body.user_id ?? null;

    // ── 1. Capacidades desde DB (solo nombre + id — siempre existen desde 0016) ──
    const { data: capsRaw, error: capsErr } = await admin
      .from('capacidades')
      .select('id, nombre')
      .eq('activo', true)
      .order('orden');

    if (capsErr) {
      return NextResponse.json({ error: `Error leyendo capacidades: ${capsErr.message}` }, { status: 500 });
    }

    // Map: clave JSON → capacidad_id  y  capacidad_id → nombre
    const nombreToId  = new Map<string, string>((capsRaw ?? []).map((c: any) => [c.nombre as string, c.id as string]));
    const capNameMap  = new Map<string, string>((capsRaw ?? []).map((c: any) => [c.id as string, c.nombre as string]));
    const capMap      = new Map<string, string>();
    for (const [key, nombre] of Object.entries(KEY_TO_NOMBRE)) {
      const id = nombreToId.get(nombre);
      if (id) capMap.set(key, id);
    }

    // ── 2. Setters a procesar ─────────────────────────────────────────────────
    let userIds: string[];
    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      const { data: profiles } = await admin.from('profiles').select('id').eq('role', 'setter');
      userIds = (profiles ?? []).map((p: any) => p.id as string);
    }

    const summary = {
      users_processed:  0,
      users_skipped:    0,
      created:          { evidencias: 0, comportamientos: 0 },
      errors:           [] as string[],
      debug:            [] as string[],
    };

    for (const userId of userIds) {
      try {
        const r = await processUser(admin, userId, capMap, capNameMap);
        summary.debug.push(...r.debug);
        if (r.skipped) { summary.users_skipped++; continue; }
        summary.users_processed++;
        summary.created.evidencias      += r.evidencias;
        summary.created.comportamientos += r.comportamientos;
      } catch (e: any) {
        summary.errors.push(`${userId}: ${e.message}`);
      }
    }

    // ── 3. Recalcular patrones ────────────────────────────────────────────────
    try { await admin.rpc('calcular_patrones'); } catch (e: any) {
      summary.debug.push(`calcular_patrones: ${e?.message}`);
    }

    return NextResponse.json(summary);
  } catch (e: any) {
    console.error('[motor/run]', e);
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function processUser(
  admin:      any,
  userId:     string,
  capMap:     Map<string, string>,
  capNameMap: Map<string, string>,
): Promise<{ skipped: boolean; evidencias: number; comportamientos: number; debug: string[] }> {
  const debug: string[] = [];

  // ── Persona: buscar o crear (no depende de migración 0036) ───────────────
  let personaId: string;
  const { data: personaExist } = await admin
    .from('personas').select('id').eq('user_id', userId).maybeSingle();

  if (personaExist) {
    personaId = personaExist.id;
    debug.push(`persona OK: ${personaId}`);
  } else {
    const { data: profile } = await admin
      .from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
    if (!profile) return { skipped: true, evidencias: 0, comportamientos: 0, debug };

    const { data: newP, error: newPErr } = await admin
      .from('personas')
      .insert({
        nombre:        profile.full_name ?? profile.email ?? 'Sin nombre',
        email:         profile.email ?? '',
        rol_actual:    'setter',
        activo:        true,
        user_id:       userId,
        fecha_ingreso: new Date().toISOString().split('T')[0],
      })
      .select('id').single();

    if (newPErr || !newP) {
      debug.push(`no pudo crear persona: ${newPErr?.message}`);
      return { skipped: true, evidencias: 0, comportamientos: 0, debug };
    }
    personaId = newP.id;
    debug.push(`persona CREADA: ${personaId}`);
  }

  let evidencias = 0, comportamientos = 0;

  // ── A. Conversaciones ─────────────────────────────────────────────────────
  // Traemos todas las analizadas (status='ready') y filtramos las ya procesadas
  // usando fuente_externa_id en evidencias (no requiere motor_processed_at)
  const { data: convs, error: convsErr } = await admin
    .from('conversation_analyses')
    .select('id, analysis, created_at')
    .eq('user_id', userId)
    .eq('status', 'ready');

  if (convsErr) {
    debug.push(`conversaciones ERROR: ${convsErr.message}`);
  } else {
    debug.push(`conversaciones status=ready: ${convs?.length ?? 0}`);
  }

  for (const conv of (convs ?? []) as any[]) {
    // Idempotencia: ¿ya existe evidencia con este fuente_externa_id?
    const { data: dup } = await admin
      .from('evidencias')
      .select('id')
      .eq('persona_id', personaId)
      .eq('fuente_externa_id', conv.id)
      .maybeSingle();
    if (dup) { debug.push(`conv ${conv.id}: ya procesada`); continue; }

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
      .insert({ persona_id: personaId, tipo: 'conversacion', fecha, contenido_resumen: resumen, fuente_externa_id: conv.id })
      .select('id').single();

    if (evErr) { debug.push(`conv ${conv.id} evidencia error: ${evErr.message}`); continue; }
    evidencias++;

    const behaviors = extractFromConversation(a, capMap, capNameMap, ev.id, personaId, fecha);
    if (behaviors.length) {
      // Insertar sin columnas de 0037 (razonamiento) — solo campos que siempre existen
      const safeRows = behaviors.map(b => ({
        evidencia_id:   b.evidencia_id,
        persona_id:     b.persona_id,
        capacidad_id:   b.capacidad_id,
        etiqueta:       b.etiqueta,
        tipo:           b.tipo,
        registrado_por: b.registrado_por,
      }));
      const { error: bErr } = await admin.from('comportamientos').insert(safeRows);
      if (bErr) debug.push(`comportamientos error: ${bErr.message}`);
      else comportamientos += safeRows.length;
    }
    debug.push(`conv ${conv.id}: OK — ${behaviors.length} comportamientos`);
  }

  // ── B. Formularios ────────────────────────────────────────────────────────
  const { data: subs, error: subsErr } = await admin
    .from('reinforcement_submissions')
    .select('id, total_score, nivel_general, submitted_at, reinforcement_forms(title)')
    .eq('user_id', userId)
    .eq('status', 'analyzed');

  if (subsErr) {
    debug.push(`formularios ERROR: ${subsErr.message}`);
  } else {
    debug.push(`formularios status=analyzed: ${subs?.length ?? 0}`);
  }

  for (const sub of (subs ?? []) as any[]) {
    const { data: dup } = await admin
      .from('evidencias')
      .select('id')
      .eq('persona_id', personaId)
      .eq('fuente_externa_id', sub.id)
      .maybeSingle();
    if (dup) { debug.push(`formulario ${sub.id}: ya procesado`); continue; }

    const fecha = (sub.submitted_at as string)?.split('T')[0] ?? new Date().toISOString().split('T')[0];
    const title = sub.reinforcement_forms?.title ?? 'Formulario CAC';

    const { error: evErr } = await admin.from('evidencias').insert({
      persona_id:        personaId,
      tipo:              'evaluacion',
      fecha,
      contenido_resumen: `${title} — Score: ${sub.total_score ?? '?'}/100 (${sub.nivel_general ?? 'sin nivel'})`,
      fuente_externa_id: sub.id,
    });

    if (evErr) debug.push(`formulario ${sub.id} error: ${evErr.message}`);
    else { evidencias++; debug.push(`formulario ${sub.id}: OK`); }
  }

  // ── C. Trainer sessions ───────────────────────────────────────────────────
  const { data: sessions, error: sessErr } = await admin
    .from('trainer_sessions')
    .select('id, scenario_name, last_evaluation, started_at, ended_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null);

  if (sessErr) {
    debug.push(`trainer ERROR: ${sessErr.message}`);
  } else {
    debug.push(`trainer sessions finalizadas: ${sessions?.length ?? 0}`);
  }

  for (const session of (sessions ?? []) as any[]) {
    const { data: dup } = await admin
      .from('evidencias')
      .select('id')
      .eq('persona_id', personaId)
      .eq('fuente_externa_id', session.id)
      .maybeSingle();
    if (dup) { debug.push(`trainer ${session.id}: ya procesado`); continue; }

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
        fuente_externa_id: session.id,
      })
      .select('id').single();

    if (evErr) { debug.push(`trainer ${session.id} error: ${evErr.message}`); continue; }
    evidencias++;

    if (session.last_evaluation) {
      const behaviors = await extractFromTrainerSession(
        session.last_evaluation, capNameMap, ev.id, personaId, fecha, openai,
      );
      if (behaviors.length) {
        const safeRows = behaviors.map(b => ({
          evidencia_id:   b.evidencia_id,
          persona_id:     b.persona_id,
          capacidad_id:   b.capacidad_id,
          etiqueta:       b.etiqueta,
          tipo:           b.tipo,
          registrado_por: b.registrado_por,
        }));
        const { error: bErr } = await admin.from('comportamientos').insert(safeRows);
        if (bErr) debug.push(`trainer comportamientos error: ${bErr.message}`);
        else comportamientos += safeRows.length;
      }
    }
    debug.push(`trainer ${session.id}: OK`);
  }

  return { skipped: false, evidencias, comportamientos, debug };
}
