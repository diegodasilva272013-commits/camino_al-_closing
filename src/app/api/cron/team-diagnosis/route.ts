import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function capScore(v: string) {
  if (v === 'alta') return 3;
  if (v === 'media') return 2;
  if (v === 'baja') return 1;
  return null;
}

const CAT_LABELS: Record<string, string> = {
  cerebro_predictivo: 'Cerebro Predictivo', cingulo: 'Cíngulo e Incongruencia',
  amigdala: 'Amígdala y Defensa', lobulo_frontal: 'Lóbulo Frontal',
  rapport_falso: 'Rapport Falso', rapport_genuino: 'Rapport Genuino',
  conexion_genuina: 'Conexión Genuina', criterio_comercial: 'Criterio Comercial',
  aplicacion_practica: 'Aplicación Práctica',
};
const CAP_MAP: Record<string, string> = {
  intencion: 'Intención', rapport: 'Rapport', empatia_profesional: 'Empatía profesional',
  diagnostico: 'Diagnóstico', generacion_interes: 'Generación de interés',
  seguimiento: 'Seguimiento', profesionalismo: 'Profesionalismo', criterio: 'Criterio',
};

export async function GET(req: NextRequest) {
  // Acepta: cron de Vercel (CRON_SECRET) O admin logueado
  const authHeader = req.headers.get('authorization');
  const isCron     = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    // Verificar sesión de admin
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const adminClient = createSupabaseAdminClient();
    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
    if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  // ── Brain + documentos CAC ────────────────────────────────────────────
  const [{ data: brain }, { data: files }] = await Promise.all([
    admin.from('trainer_brain').select('*').eq('id', 1).maybeSingle(),
    admin.from('trainer_files').select('name, content_text').order('created_at'),
  ]);

  const brainBase  = (brain as any)?.base_prompt ?? '';
  const brainRules = (brain as any)?.rules ?? '';
  const cacDocs    = ((files ?? []) as any[])
    .filter((f: any) => f.content_text)
    .map((f: any) => `## DOCUMENTO: ${f.name}\n${(f.content_text as string).slice(0, 12000)}`)
    .join('\n\n---\n\n');

  // ── Equipo ────────────────────────────────────────────────────────────
  const { data: profiles } = await admin.from('profiles')
    .select('id, full_name').in('role', ['setter', 'admin']);
  const setters   = profiles ?? [];
  const setterIds = setters.map((p: any) => p.id);
  const setterMap = new Map(setters.map((p: any) => [p.id, (p.full_name ?? p.id) as string]));
  const N         = setters.length;

  // ── Formularios ───────────────────────────────────────────────────────
  const { data: subs } = await (admin as any)
    .from('reinforcement_submissions')
    .select('id, user_id, total_score, nivel_general, status')
    .in('user_id', setterIds).eq('status', 'analyzed');
  const allSubs: any[] = subs ?? [];
  const subIds = allSubs.map((s: any) => s.id).filter(Boolean);

  const [{ data: ans2 }, { data: qs }] = await Promise.all([
    subIds.length
      ? (admin as any).from('reinforcement_answers').select('question_id, score').in('submission_id', subIds)
      : Promise.resolve({ data: [] }),
    (admin as any).from('reinforcement_questions').select('id, category'),
  ]);
  const allAnswers: any[] = ans2 ?? [];
  const qMap = new Map(((qs ?? []) as any[]).map((q: any) => [q.id, q]));

  const catRaw: Record<string, number[]> = {};
  for (const a of allAnswers) {
    const q: any = qMap.get(a.question_id);
    if (!q?.category || a.score == null) continue;
    if (!catRaw[q.category]) catRaw[q.category] = [];
    catRaw[q.category].push(a.score);
  }
  const catAvg: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(catRaw)) {
    catAvg[cat] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }
  const formAvgTotal = allSubs.length
    ? Math.round(allSubs.reduce((s: number, r: any) => s + (r.total_score ?? 0), 0) / allSubs.length)
    : null;
  const settersWithForms = new Set(allSubs.map((s: any) => s.user_id)).size;
  const nivelesCount: Record<string, number> = {};
  for (const s of allSubs) {
    if (s.nivel_general) nivelesCount[s.nivel_general] = (nivelesCount[s.nivel_general] ?? 0) + 1;
  }

  // ── Conversaciones ────────────────────────────────────────────────────
  const { data: convs } = await (admin as any)
    .from('conversation_analyses')
    .select('user_id, analysis, created_at')
    .in('user_id', setterIds).eq('status', 'ready');
  const allConvs: any[] = convs ?? [];

  const capRaw: Record<string, number[]> = {};
  const erroresFrecuentes: string[] = [];
  const fortalezasFrecuentes: string[] = [];
  let convsConQuiebre = 0;
  const resultadosProb: Record<string, number> = {};

  for (const c of allConvs) {
    const a = c.analysis ?? {};
    for (const [k, v] of Object.entries(a.capacidades_impactadas ?? {})) {
      const sc = capScore(String(v));
      if (sc !== null) { if (!capRaw[k]) capRaw[k] = []; capRaw[k].push(sc); }
    }
    if (Array.isArray(a.errores))    erroresFrecuentes.push(...a.errores);
    if (Array.isArray(a.fortalezas)) fortalezasFrecuentes.push(...a.fortalezas);
    if (a.donde_se_rompio) convsConQuiebre++;
    if (a.resultado_probable) resultadosProb[a.resultado_probable] = (resultadosProb[a.resultado_probable] ?? 0) + 1;
  }

  const capAvgConv: Record<string, number> = {};
  for (const [k, scores] of Object.entries(capRaw)) {
    capAvgConv[k] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  const countStrings = (arr: string[]) => {
    const m: Record<string, number> = {};
    for (const s of arr) m[s] = (m[s] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  };

  // ── Trainer ───────────────────────────────────────────────────────────
  const { data: sessions } = await (admin as any)
    .from('trainer_sessions')
    .select('user_id, scenario_group, difficulty, status, ended_at, last_evaluation')
    .in('user_id', setterIds).order('started_at', { ascending: false });
  const allSessions: any[] = sessions ?? [];

  const completedSessions  = allSessions.filter((s: any) => s.status === 'finished' || s.ended_at);
  const settersWithTrainer = new Set(allSessions.map((s: any) => s.user_id)).size;
  const groupCount: Record<string, number> = {};
  for (const s of allSessions) {
    if (s.scenario_group) groupCount[s.scenario_group] = (groupCount[s.scenario_group] ?? 0) + 1;
  }
  const topGroups = Object.entries(groupCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  const lastEvals = allSessions.filter((s: any) => s.last_evaluation).slice(0, 10)
    .map((s: any) => `[${setterMap.get(s.user_id) ?? 'Setter'}] ${s.last_evaluation}`).join('\n');

  // ── Leads ─────────────────────────────────────────────────────────────
  let allLeads: any[] = [];
  let from = 0;
  while (true) {
    const { data: page } = await admin.from('leads')
      .select('assigned_to_user_id, current_status, is_closed')
      .in('assigned_to_user_id', setterIds).range(from, from + 999);
    if (!page?.length) break;
    allLeads.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }

  const leadsTotal    = allLeads.length;
  const leadsRespond  = allLeads.filter(l => !['NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','NO_RESPONDE'].includes(l.current_status)).length;
  const leadsInterest = allLeads.filter(l => ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
  const leadsMeetings = allLeads.filter(l => l.current_status === 'REUNION_AGENDADA').length;
  const leadsNoFit    = allLeads.filter(l => l.current_status === 'NO_CALIFICA').length;
  const leadsNoResp   = allLeads.filter(l => l.current_status === 'NO_RESPONDE').length;
  const leadsClosed   = allLeads.filter(l => l.is_closed).length;

  // ── Prompt ────────────────────────────────────────────────────────────
  const catLines = Object.entries(catAvg).sort((a, b) => a[1] - b[1])
    .map(([cat, avg]) => `  - ${CAT_LABELS[cat] ?? cat}: ${avg}/10`).join('\n');
  const capLines = Object.entries(capAvgConv).sort((a, b) => a[1] - b[1])
    .map(([k, avg]) => `  - ${CAP_MAP[k] ?? k}: ${avg.toFixed(1)}/3`).join('\n');

  const systemPrompt = [
    brainBase  ? `INSTRUCCIONES BASE DEL ENTRENADOR:\n${brainBase}` : '',
    brainRules ? `REGLAS DEL ENTRENADOR:\n${brainRules}` : '',
    cacDocs    ? `DOCUMENTOS Y FILOSOFÍA CAC (base exclusiva de conocimiento):\n${cacDocs}` : '',
    `INSTRUCCIÓN CRÍTICA: Todo tu análisis debe estar 100% basado en los documentos CAC provistos. NO uses conocimiento externo. NO cites autores ajenos. NO inventes conceptos fuera del marco CAC.`,
  ].filter(Boolean).join('\n\n');

  const userPrompt = `Hacé el diagnóstico diario del equipo CAC. Fecha: ${new Date().toLocaleDateString('es-AR')}.

## DATOS DEL EQUIPO

Equipo: ${N} setters | Con formularios: ${settersWithForms} | Con trainer: ${settersWithTrainer} | Convs analizadas: ${allConvs.length}

Conocimiento CAC (formularios) — Promedio: ${formAvgTotal ?? 'sin datos'}/100
Niveles: ${JSON.stringify(nivelesCount)}
Por categoría (más débil → más fuerte):
${catLines || '  (sin datos)'}

Capacidades en conversaciones reales (1-3):
${capLines || '  (sin datos)'}

Errores frecuentes: ${countStrings(erroresFrecuentes).join(' | ') || '—'}
Fortalezas frecuentes: ${countStrings(fortalezasFrecuentes).join(' | ') || '—'}
Convs que se rompieron: ${convsConQuiebre}/${allConvs.length}
Resultados: ${JSON.stringify(Object.entries(resultadosProb).sort((a,b)=>b[1]-a[1]).slice(0,4))}

Trainer — Sesiones: ${allSessions.length} | Completadas: ${completedSessions.length} | Grupos: ${topGroups.join(', ')||'—'}
${lastEvals ? `\nÚltimas evaluaciones:\n${lastEvals}` : ''}

Leads — Total: ${leadsTotal} | Respuesta: ${leadsTotal>0?Math.round(leadsRespond/leadsTotal*100):0}% | Interés: ${leadsTotal>0?Math.round(leadsInterest/leadsTotal*100):0}% | Reuniones: ${leadsMeetings} | No califica: ${leadsNoFit} | No responde: ${leadsNoResp} | Cerrados: ${leadsClosed}

Respondé con este JSON exacto:
{
  "estado_actual": "3-5 oraciones. Dónde está el equipo hoy en el proceso CAC.",
  "fortalezas": ["Fortaleza con dato", "Fortaleza 2", "Fortaleza 3"],
  "puntos_criticos": [
    { "problema": "Nombre en términos CAC", "evidencia": "Dato concreto", "impacto": "Por qué frena el closing según CAC", "accion": "Acción dentro del sistema CAC" }
  ],
  "patron_del_equipo": "Patrón dominante que explica los resultados, en términos CAC.",
  "proxima_prioridad": "Una sola acción concreta esta semana, dentro del sistema CAC."
}`;

  const completion = await (openai.chat.completions.create as any)({
    model: 'o3',
    reasoning_effort: 'high',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  });

  const raw       = (completion.choices[0].message.content ?? '{}').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const diagnosis = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  const meta = {
    model: 'o3', date: new Date().toISOString().split('T')[0],
    setters: N, forms: allSubs.length, conversations: allConvs.length,
    trainer_sessions: allSessions.length, leads: leadsTotal,
    docs_loaded: (files ?? []).length,
  };

  // ── Guardar en historial ──────────────────────────────────────────────
  const { error: saveErr } = await (admin as any)
    .from('team_diagnostics')
    .insert({ diagnosis, meta });

  if (saveErr) console.error('[cron/team-diagnosis] save error:', saveErr.message);

  return NextResponse.json({ ok: true, meta, diagnosis });
}
