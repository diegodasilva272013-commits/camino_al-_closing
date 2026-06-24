import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/d2030/senal-equipo/infer
 *
 * Inferencia de señales de Diego a partir de un diagnóstico de equipo.
 * Protegido por x-internal-key: CRON_SECRET.
 *
 * Body: { team_diagnostic_id?: number }
 *   → Con ID: procesa ese diagnóstico específico.
 *   → Sin ID: procesa el más reciente.
 *
 * Escribe en senal_equipo (0029). No toca tablas founder_*.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-internal-key');
  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient() as any;
  const body  = await req.json().catch(() => ({}));
  const { team_diagnostic_id } = body;

  // ── 1. Cargar diagnóstico ─────────────────────────────────────────────
  let diagQuery = admin
    .from('team_diagnostics')
    .select('id, diagnosis, meta, created_at');

  diagQuery = team_diagnostic_id
    ? diagQuery.eq('id', team_diagnostic_id).single()
    : diagQuery.order('created_at', { ascending: false }).limit(1).single();

  const { data: diagData, error: diagErr } = await diagQuery;

  if (diagErr || !diagData) {
    return NextResponse.json(
      { error: 'Diagnóstico no encontrado', detail: diagErr?.message },
      { status: 404 }
    );
  }

  // ── 2. Cargar contexto CAC (idéntico al cron de equipo) ───────────────
  const [{ data: brain }, { data: files }] = await Promise.all([
    admin.from('trainer_brain').select('base_prompt, rules').eq('id', 1).maybeSingle(),
    admin.from('trainer_files').select('name, content_text').order('created_at'),
  ]);

  const brainBase  = brain?.base_prompt ?? '';
  const brainRules = brain?.rules ?? '';
  const cacDocs    = ((files ?? []) as any[])
    .filter((f: any) => f.content_text)
    .map((f: any) => `## DOCUMENTO: ${f.name}\n${(f.content_text as string).slice(0, 12000)}`)
    .join('\n\n---\n\n');

  // ── 3. Cargar perfil + capacidades de Diego ───────────────────────────
  const { data: perfil } = await admin
    .from('perfil')
    .select('id')
    .limit(1)
    .single();

  if (!perfil?.id) {
    return NextResponse.json(
      { error: 'Perfil de Diego no inicializado. Corré la migración 0029.' },
      { status: 404 }
    );
  }

  const { data: capsData } = await admin
    .from('objetivo_crecimiento')
    .select('id, nombre, nombre_display, definicion, criterios_evaluacion')
    .eq('perfil_id', perfil.id)
    .eq('activo', true)
    .order('orden');

  const caps: any[]              = capsData ?? [];
  const capMap                   = new Map<string, any>(caps.map((c: any) => [c.nombre, c]));

  // ── 4. Construir prompt ───────────────────────────────────────────────
  const diagnosis = diagData.diagnosis;
  const meta      = diagData.meta ?? {};
  const N: number = meta.setters ?? 1;

  const mayoriaMin = Math.floor(N / 2) + 1;   // >50%
  const minoriaMax = Math.ceil(N * 0.3) - 1;  // <30%

  const capsList = caps
    .map((c: any) => `- ${c.nombre} (${c.nombre_display}): ${c.definicion}`)
    .join('\n');

  const systemPrompt = [
    brainBase  ? `INSTRUCCIONES BASE DEL ENTRENADOR:\n${brainBase}`     : '',
    brainRules ? `REGLAS DEL ENTRENADOR:\n${brainRules}`                 : '',
    cacDocs    ? `DOCUMENTOS CAC:\n${cacDocs}`                           : '',
    `INSTRUCCIÓN CRÍTICA: Basate ÚNICAMENTE en los documentos CAC y el diagnóstico proporcionado. No uses conocimiento externo.`,
  ].filter(Boolean).join('\n\n');

  const userPrompt = `Sos el Motor CAC CEO. Tu tarea: dado el diagnóstico del equipo de Diego, inferir qué dice ese diagnóstico sobre el LIDERAZGO de Diego — no sobre los setters individualmente.

DIAGNÓSTICO DEL EQUIPO — ${meta.date ?? (diagData.created_at as string).split('T')[0]}
Setters analizados: ${N}

Estado actual:
${diagnosis.estado_actual ?? '—'}

Fortalezas:
${(diagnosis.fortalezas ?? []).map((f: string) => `- ${f}`).join('\n') || '—'}

Puntos críticos:
${JSON.stringify(diagnosis.puntos_criticos ?? [], null, 2)}

Patrón del equipo:
${diagnosis.patron_del_equipo ?? '—'}

Próxima prioridad:
${diagnosis.proxima_prioridad ?? '—'}

---

CAPACIDADES DE DIEGO (usá el campo "nombre" exacto como capacidad_nombre):
${capsList}

---

REGLAS DE ATRIBUCIÓN — aplicalas con precisión matemática:

1. MAYORÍA (${mayoriaMin} o más de los ${N} setters muestran el mismo patrón):
   → La falla es sistémica. Apunta a Diego. omitir: false.

2. MINORÍA (${minoriaMax} o menos de los ${N} setters):
   → Patrón individual. No apunta a Diego. omitir: true.

3. ZONA GRIS (entre ${minoriaMax + 1} y ${mayoriaMin - 1} setters, o sin evidencia numérica clara):
   → Escribir la señal pero con a_revisar: true y omitir: false.

4. MEJORA colectiva generada por Diego → valencia: "refuerza".
   FALLA colectiva con origen en Diego → valencia: "debilita".

5. Si no hay evidencia cuantitativa suficiente para determinar → a_revisar: true.

6. El campo "razonamiento" es OBLIGATORIO en toda señal con omitir: false.
   Debe incluir: (a) el fragmento del diagnóstico que usaste, (b) el cálculo X/N=Y%, (c) por qué toca esa capacidad de Diego.

IMPORTANTE: Solo generás señales sobre Diego. No sobre setters individuales.

Devolvé ÚNICAMENTE un JSON array. Sin texto antes ni después:
[
  {
    "descripcion": "Señal concreta sobre el comportamiento/resultado del equipo",
    "tipo": "resultado | reaccion | feedback",
    "capacidad_nombre": "nombre_exacto | null",
    "valencia": "refuerza | debilita | null",
    "peso": 0.1,
    "a_revisar": false,
    "omitir": false,
    "razonamiento": "Fragmento del diagnóstico + cálculo + por qué toca esta capacidad de Diego."
  }
]`;

  // ── 5. Llamar a o3 ────────────────────────────────────────────────────
  const completion = await (openai.chat.completions.create as any)({
    model:            'o3',
    reasoning_effort: 'medium',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  });

  const raw       = (completion.choices[0].message.content ?? '[]').trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const senales: any[] = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');

  // ── 6. Insertar señales en senal_equipo ───────────────────────────────
  const toInsert = senales.filter((s: any) => !s.omitir && s.razonamiento?.trim());
  const omitidas = senales.filter((s: any) =>  s.omitir);

  let escritas = 0;

  if (toInsert.length > 0) {
    const rows = toInsert.map((s: any) => {
      const cap = capMap.get(s.capacidad_nombre ?? '');
      return {
        perfil_id:          perfil.id,
        descripcion:        s.descripcion,
        tipo:               ['resultado', 'reaccion', 'feedback'].includes(s.tipo) ? s.tipo : 'resultado',
        capacidad_id:       cap?.id ?? null,
        valencia:           ['refuerza', 'debilita'].includes(s.valencia) ? s.valencia : null,
        peso:               typeof s.peso === 'number' ? Math.min(Math.max(s.peso, 0.1), 1.0) : 0.5,
        razonamiento:       s.razonamiento,
        a_revisar:          s.a_revisar === true,
        team_diagnostic_id: diagData.id,
        fecha:              meta.date ?? new Date().toISOString().split('T')[0],
      };
    });

    const { error: insErr } = await admin.from('senal_equipo').insert(rows);

    if (insErr) {
      return NextResponse.json(
        { error: 'Error al insertar señales', detail: insErr.message },
        { status: 500 }
      );
    }

    escritas = rows.length;
  }

  return NextResponse.json({
    ok:                  true,
    team_diagnostic_id:  diagData.id,
    senales_escritas:    escritas,
    senales_omitidas:    omitidas.length,
    senales_revision:    toInsert.filter((s: any) => s.a_revisar).length,
  });
}
