import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300; // o3 puede tardar varios minutos

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function capScore(v: string) {
  if (v === 'alta') return 3;
  if (v === 'media') return 2;
  if (v === 'baja') return 1;
  return null;
}

const CAT_LABELS: Record<string, string> = {
  cerebro_predictivo: 'Cerebro Predictivo',
  cingulo:            'Cíngulo e Incongruencia',
  amigdala:           'Amígdala y Defensa',
  lobulo_frontal:     'Lóbulo Frontal',
  rapport_falso:      'Rapport Falso',
  rapport_genuino:    'Rapport Genuino',
  conexion_genuina:   'Conexión Genuina',
  criterio_comercial: 'Criterio Comercial',
  aplicacion_practica:'Aplicación Práctica',
};

const CAP_MAP: Record<string, string> = {
  intencion:           'Intención',
  rapport:             'Rapport',
  empatia_profesional: 'Empatía profesional',
  diagnostico:         'Diagnóstico',
  generacion_interes:  'Generación de interés',
  seguimiento:         'Seguimiento',
  profesionalismo:     'Profesionalismo',
  criterio:            'Criterio',
};

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: myProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((myProfile as any)?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // ── 1. Brain del entrenador + documentos CAC ─────────────────────────
  const [{ data: brain }, { data: files }] = await Promise.all([
    admin.from('trainer_brain').select('*').eq('id', 1).maybeSingle(),
    admin.from('trainer_files').select('name, content_text').order('created_at'),
  ]);

  const brainBase  = (brain as any)?.base_prompt ?? '';
  const brainRules = (brain as any)?.rules ?? '';
  const cacDocs    = ((files ?? []) as any[])
    .filter((f) => f.content_text)
    .map((f: any) => `## DOCUMENTO: ${f.name}\n${(f.content_text as string).slice(0, 12000)}`)
    .join('\n\n---\n\n');

  // ── 2. Setters del equipo ─────────────────────────────────────────────
  const { data: profiles } = await admin.from('profiles')
    .select('id, full_name').in('role', ['setter', 'admin']);
  const setters    = profiles ?? [];
  const setterIds  = setters.map((p: any) => p.id);
  const setterMap  = new Map(setters.map((p: any) => [p.id, (p.full_name ?? p.id) as string]));
  const N          = setters.length;

  // ── 3. Formularios ────────────────────────────────────────────────────
  const { data: subs } = await (admin as any)
    .from('reinforcement_submissions')
    .select('id, user_id, total_score, nivel_general, status')
    .in('user_id', setterIds)
    .eq('status', 'analyzed');
  const allSubs: any[] = subs ?? [];
  const subIds = allSubs.map((s: any) => s.id).filter(Boolean);

  const [{ data: ans2 }, { data: qs }] = await Promise.all([
    subIds.length
      ? (admin as any).from('reinforcement_answers').select('question_id, score').in('submission_id', subIds)
      : Promise.resolve({ data: [] }),
    (admin as any).from('reinforcement_questions').select('id, category'),
  ]);
  const allAnswers:   any[] = ans2 ?? [];
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

  // ── 4. Conversaciones reales ──────────────────────────────────────────
  const { data: convs } = await (admin as any)
    .from('conversation_analyses')
    .select('user_id, analysis, created_at')
    .in('user_id', setterIds)
    .eq('status', 'ready');
  const allConvs: any[] = convs ?? [];

  const capRaw: Record<string, number[]> = {};
  const erroresFrecuentes: string[]  = [];
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
  const topErrores    = countStrings(erroresFrecuentes);
  const topFortalezas = countStrings(fortalezasFrecuentes);

  // ── 5. Trainer ────────────────────────────────────────────────────────
  const { data: sessions } = await (admin as any)
    .from('trainer_sessions')
    .select('user_id, scenario_group, difficulty, status, ended_at, last_evaluation')
    .in('user_id', setterIds)
    .order('started_at', { ascending: false });
  const allSessions: any[] = sessions ?? [];

  const completedSessions  = allSessions.filter((s: any) => s.status === 'finished' || s.ended_at);
  const settersWithTrainer = new Set(allSessions.map((s: any) => s.user_id)).size;
  const groupCount: Record<string, number> = {};
  for (const s of allSessions) {
    if (s.scenario_group) groupCount[s.scenario_group] = (groupCount[s.scenario_group] ?? 0) + 1;
  }
  const topGroups = Object.entries(groupCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  const avgDifficulty = allSessions.length
    ? Math.round(allSessions.reduce((s: number, r: any) => s + (r.difficulty ?? 1), 0) / allSessions.length * 10) / 10
    : null;

  // Últimas 10 evaluaciones con nombre del setter
  const lastEvals = allSessions
    .filter((s: any) => s.last_evaluation)
    .slice(0, 10)
    .map((s: any) => `[${setterMap.get(s.user_id) ?? 'Setter'}] ${s.last_evaluation}`)
    .join('\n');

  // ── 6. Leads ─────────────────────────────────────────────────────────
  let allLeads: any[] = [];
  let from = 0;
  while (true) {
    const { data: page } = await admin.from('leads')
      .select('assigned_to_user_id, current_status, is_closed')
      .in('assigned_to_user_id', setterIds)
      .range(from, from + 999);
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

  // ── 7. Prompt ─────────────────────────────────────────────────────────
  const catLines = Object.entries(catAvg)
    .sort((a, b) => a[1] - b[1])
    .map(([cat, avg]) => `  - ${CAT_LABELS[cat] ?? cat}: ${avg}/10`)
    .join('\n');

  const capLines = Object.entries(capAvgConv)
    .sort((a, b) => a[1] - b[1])
    .map(([k, avg]) => `  - ${CAP_MAP[k] ?? k}: ${avg.toFixed(1)}/3`)
    .join('\n');

  const systemPrompt = [
    brainBase  ? `INSTRUCCIONES BASE DEL ENTRENADOR:\n${brainBase}` : '',
    brainRules ? `REGLAS DEL ENTRENADOR:\n${brainRules}` : '',
    cacDocs    ? `DOCUMENTOS Y FILOSOFÍA CAC (base de conocimiento exclusiva — no salgas de este marco):\n${cacDocs}` : '',
    `INSTRUCCIÓN CRÍTICA: Todo tu análisis debe estar 100% basado en los documentos CAC provistos arriba y en los datos del equipo a continuación. NO uses ningún conocimiento externo, no cites autores ajenos, no inventes conceptos que no estén en los documentos. Si algo no está en los documentos CAC, no lo menciones.`,
  ].filter(Boolean).join('\n\n');

  const userPrompt = `Tenés que hacer el diagnóstico de equipo de Camino al Closing basándote exclusivamente en los documentos CAC y en estos datos reales:

## DATOS DEL EQUIPO (${new Date().toLocaleDateString('es-AR')})

### Equipo
- Total setters: ${N}
- Setters con formularios completados: ${settersWithForms}/${N}
- Setters con sesiones de trainer: ${settersWithTrainer}/${N}
- Conversaciones reales analizadas: ${allConvs.length}

### Conocimiento CAC (Formularios de Refuerzo)
- Promedio general: ${formAvgTotal ?? 'sin datos'}/100
- Niveles: ${JSON.stringify(nivelesCount)}
- Scores por categoría (de más débil a más fuerte):
${catLines || '  (sin datos)'}

### Capacidades en conversaciones reales (escala 1-3, 3=alta):
${capLines || '  (sin datos)'}

### Errores más frecuentes en conversaciones reales:
${topErrores.length ? topErrores.map(e => `  - ${e}`).join('\n') : '  (sin datos)'}

### Fortalezas más frecuentes:
${topFortalezas.length ? topFortalezas.map(f => `  - ${f}`).join('\n') : '  (sin datos)'}

### Conversaciones que se rompieron: ${convsConQuiebre} de ${allConvs.length}
### Resultados más frecuentes: ${JSON.stringify(Object.entries(resultadosProb).sort((a, b) => b[1] - a[1]).slice(0, 5))}

### Entrenamiento (Trainer)
- Sesiones totales: ${allSessions.length} | Completadas: ${completedSessions.length}
- Grupos practicados: ${topGroups.join(', ') || 'ninguno'}
- Dificultad promedio: ${avgDifficulty ?? 'sin datos'}/5
${lastEvals ? `\nÚltimas evaluaciones:\n${lastEvals}` : ''}

### Leads y resultados reales
- Total leads: ${leadsTotal}
- Con alguna respuesta: ${leadsRespond} (${leadsTotal > 0 ? Math.round(leadsRespond / leadsTotal * 100) : 0}%)
- Con interés detectado: ${leadsInterest} (${leadsTotal > 0 ? Math.round(leadsInterest / leadsTotal * 100) : 0}%)
- Reuniones agendadas: ${leadsMeetings}
- No califica: ${leadsNoFit}
- No responde: ${leadsNoResp}
- Ventas cerradas: ${leadsClosed}

## TU TAREA

Producí un diagnóstico real y accionable. Usá exclusivamente la filosofía, conceptos y herramientas de CAC que están en los documentos provistos. No divagues, no uses términos ajenos a CAC.

Respondé con este JSON exacto (sin texto antes ni después):
{
  "estado_actual": "Párrafo de 3-5 oraciones. Dónde está el equipo en el proceso CAC hoy: qué etapa dominan, qué les falta para cerrar, gap entre conocimiento teórico y ejecución real.",
  "fortalezas": ["Fortaleza concreta con dato", "Fortaleza 2", "Fortaleza 3"],
  "puntos_criticos": [
    {
      "problema": "Nombre del problema en términos CAC",
      "evidencia": "Dato concreto que lo demuestra",
      "impacto": "Por qué esto impide avanzar en el proceso de closing según el marco CAC",
      "accion": "Acción específica dentro del sistema CAC para corregirlo"
    }
  ],
  "patron_del_equipo": "El patrón de comportamiento dominante que explica los resultados actuales, en términos del marco CAC.",
  "proxima_prioridad": "Una sola acción concreta para esta semana, específica, dentro del sistema CAC."
}`;

  const completion = await (openai.chat.completions.create as any)({
    model:            'o3',
    reasoning_effort: 'high',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  });

  const raw = (completion.choices[0].message.content ?? '{}').trim();

  // Extraer JSON aunque el modelo agregue texto alrededor
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  return NextResponse.json({
    ...result,
    meta: {
      model:              'o3',
      setters:            N,
      forms:              allSubs.length,
      conversations:      allConvs.length,
      trainer_sessions:   allSessions.length,
      leads:              leadsTotal,
      docs_loaded:        (files ?? []).length,
      generated_at:       new Date().toISOString(),
    },
  });
}
