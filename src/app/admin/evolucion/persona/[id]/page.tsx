import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import {
  Plus, ArrowLeft, TrendingUp, TrendingDown, Minus,
  CalendarDays, Zap, ClipboardList, ClipboardCheck, ExternalLink,
  MessageSquare, Users, Activity, AlertTriangle, CheckCircle2, XCircle,
  ArrowDown,
} from 'lucide-react';
import type { Evidencia, Patron, Intervencion } from '@/types/evolucion';

export const dynamic = 'force-dynamic';

// ── Criterios de pase — Diego los ajusta con casos reales ─────────────────────
// Cambiar aquí; la tarjeta de LISTO/NO LISTO refleja el nuevo umbral automáticamente.
const UMBRAL_PATRON_FRECUENCIA = 3;   // patrón negativo bloqueante si frecuencia ≥ N
const UMBRAL_FORMULARIO_SCORE  = 60;  // conocimiento CAC suficiente si promedio ≥ N/100
const UMBRAL_CAPACIDAD_SCORE   = 4;   // capacidad habilitada si score ≥ N/10

const TIPO_COLORS: Record<string, string> = {
  conversacion: 'bg-blue-950/40 text-blue-300 border-blue-700/30',
  reporte:      'bg-zinc-900 text-zinc-300 border-zinc-700',
  simulacion:   'bg-purple-950/40 text-purple-300 border-purple-700/30',
  reunion:      'bg-amber-950/40 text-amber-300 border-amber-700/30',
  evaluacion:   'bg-cyan-950/40 text-cyan-300 border-cyan-700/30',
};

const INTERV_COLORS: Record<string, string> = {
  roleplay:      'bg-purple-950/40 text-purple-300 border-purple-700/30',
  simulacion_ia: 'bg-blue-950/40 text-blue-300 border-blue-700/30',
  correccion:    'bg-red-950/40 text-red-300 border-red-700/30',
  clase:         'bg-emerald-950/40 text-emerald-300 border-emerald-700/30',
  mentoria:      'bg-amber-950/40 text-amber-300 border-amber-700/30',
};

function TendenciaBadge({ t }: { t: string }) {
  if (t === 'aumentando')
    return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><TrendingUp className="h-3 w-3" />Aumentando</span>;
  if (t === 'disminuyendo')
    return <span className="inline-flex items-center gap-1 text-[10px] text-red-400"><TrendingDown className="h-3 w-3" />Disminuyendo</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400"><Minus className="h-3 w-3" />Estable</span>;
}

function CausalConnector({ text }: { text: string }) {
  return (
    <div className="my-5 flex items-center gap-3 max-w-5xl">
      <div className="h-px flex-1 bg-brand-gold/10" />
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-brand-gold/40">
        <ArrowDown className="h-3 w-3 shrink-0" />{text}
      </span>
      <div className="h-px flex-1 bg-brand-gold/10" />
    </div>
  );
}

function ScoreBar({ score, nombre }: { score: number | null; nombre: string }) {
  const color     = score === null ? '' : score >= 7 ? 'bg-emerald-500' : score >= UMBRAL_CAPACIDAD_SCORE ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score === null ? 'text-zinc-600' : score >= 7 ? 'text-emerald-400' : score >= UMBRAL_CAPACIDAD_SCORE ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] truncate ${score !== null ? 'text-brand-text' : 'text-brand-muted/50'}`}>{nombre}</span>
        <span className={`text-[11px] font-bold tabular-nums shrink-0 ml-2 ${textColor}`}>
          {score !== null ? `${score.toFixed(1)}/10` : 'sin datos'}
        </span>
      </div>
      {score !== null && (
        <div className="h-1 w-full rounded-full bg-zinc-800">
          <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(score * 10, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function PerfilPersonaPage({ params }: { params: { id: string } }) {
  const admin = createSupabaseAdminClient() as any;
  const { id } = params;

  // ── Datos base — sin cambio respecto a la versión anterior ───────────────────
  const [
    { data: persona },
    { data: evidencias },
    { data: patrones },
    { data: intervenciones },
  ] = await Promise.all([
    admin.from('personas').select('*').eq('id', id).single(),
    admin.from('evidencias').select('*').eq('persona_id', id).order('fecha', { ascending: false }),
    // Ajuste: agrego catalogo join para obtener tipo positivo/negativo real del catálogo
    admin.from('patrones')
      .select('*, capacidad:capacidades(nombre), catalogo:catalogo_comportamientos(tipo)')
      .eq('persona_id', id)
      .order('frecuencia', { ascending: false }),
    admin.from('intervenciones')
      .select('*, patron:patrones(etiqueta), capacidad:capacidades(nombre)')
      .eq('persona_id', id)
      .order('fecha', { ascending: false }),
  ]);

  if (!persona) notFound();

  // ── Resolver user_id (F4: primero user_id directo, fallback email) ────────────
  let personaUserId: string | null = persona.user_id ?? null;
  let formSubs:        any[] = [];
  let comportsList:    any[] = [];
  let capacidadesList: any[] = [];
  let convCount    = 0;
  let trainerCount = 0;
  let leadsData    = { total: 0, reuniones: 0, cerrados: 0 };

  try {
    if (!personaUserId && persona.email) {
      const { data: profile } = await admin
        .from('profiles').select('id').eq('email', persona.email).maybeSingle();
      personaUserId = profile?.id ?? null;
    }

    const [formsRes, compsRes, capsRes, convRes, trainerRes, leadsRes] = await Promise.all([
      // Formularios (existente, sin cambio)
      personaUserId
        ? admin.from('reinforcement_submissions')
            .select('id, form_id, submitted_at, total_score, nivel_general, ai_risk, reinforcement_forms(title, topic)')
            .eq('user_id', personaUserId).eq('status', 'analyzed').order('submitted_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      // Comportamientos por persona — para calcular score 0-10 por capacidad
      admin.from('comportamientos').select('capacidad_id, tipo').eq('persona_id', id),
      // Las 9 capacidades CAC
      admin.from('capacidades').select('id, nombre, orden').eq('activo', true).order('orden'),
      // Conversaciones analizadas — count
      personaUserId
        ? admin.from('conversation_analyses')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', personaUserId).eq('status', 'ready')
        : Promise.resolve({ count: 0 }),
      // Sesiones de trainer — count
      personaUserId
        ? admin.from('trainer_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', personaUserId)
        : Promise.resolve({ count: 0 }),
      // Leads asignados
      personaUserId
        ? admin.from('leads').select('current_status, is_closed').eq('assigned_to_user_id', personaUserId)
        : Promise.resolve({ data: [] }),
    ]);

    formSubs        = formsRes.data   ?? [];
    comportsList    = compsRes.data   ?? [];
    capacidadesList = capsRes.data    ?? [];
    convCount       = convRes.count   ?? 0;
    trainerCount    = trainerRes.count ?? 0;

    const leads = leadsRes.data ?? [];
    leadsData = {
      total:     leads.length,
      reuniones: leads.filter((l: any) => l.current_status === 'REUNION_AGENDADA').length,
      cerrados:  leads.filter((l: any) => l.is_closed).length,
    };
  } catch {}

  // ── Listas base ────────────────────────────────────────────────────────────
  const evidList:   Evidencia[]    = evidencias    ?? [];
  const patronList: Patron[]       = patrones      ?? [];
  const intervList: Intervencion[] = intervenciones ?? [];

  // Tipo de patrón vía catalogo join (fix: antes pat.tipo siempre era undefined)
  const patronTipo = (p: any) => (p.catalogo?.tipo ?? null) as 'positivo' | 'negativo' | null;
  const negativos  = patronList.filter(p => patronTipo(p) === 'negativo');
  const positivos  = patronList.filter(p => patronTipo(p) === 'positivo');

  // Score 0-10 por capacidad: positivos/(positivos+negativos)*10
  type CapEntry = { pos: number; neg: number; score: number };
  const capScoreMap = new Map<string, CapEntry>();
  for (const c of comportsList) {
    const e = capScoreMap.get(c.capacidad_id) ?? { pos: 0, neg: 0, score: 0 };
    if (c.tipo === 'positivo') e.pos++; else e.neg++;
    capScoreMap.set(c.capacidad_id, e);
  }
  for (const [capId, e] of capScoreMap) {
    const total = e.pos + e.neg;
    e.score = total > 0 ? Math.round((e.pos / total) * 100) / 10 : 5;
    capScoreMap.set(capId, e);
  }
  const capWithScores = capacidadesList.map((cap: any) => {
    const d = capScoreMap.get(cap.id);
    return { ...cap, pos: d?.pos ?? 0, neg: d?.neg ?? 0, score: d ? d.score : null as number | null };
  });

  // Cuello = capacidad con score más bajo entre las que tienen datos
  const cuello = [...capWithScores]
    .filter(c => c.score !== null)
    .sort((a, b) => (a.score as number) - (b.score as number))[0] ?? null;

  // Patrón negativo más frecuente
  const patronDominante = negativos[0] ?? null;

  // Promedio formularios
  const formProm = formSubs.length
    ? Math.round(formSubs.reduce((s: number, f: any) => s + (f.total_score ?? 0), 0) / formSubs.length)
    : null;

  // ── Criterios de pase con trazabilidad ─────────────────────────────────────
  const bloqueantes  = negativos.filter(p => (p as any).frecuencia >= UMBRAL_PATRON_FRECUENCIA);
  const capsConDatos = capWithScores.filter(c => c.score !== null);
  const capsBajas    = capsConDatos.filter(c => (c.score as number) < UMBRAL_CAPACIDAD_SCORE);

  const checkPatron = bloqueantes.length === 0;
  const checkForms  = formProm !== null && formProm >= UMBRAL_FORMULARIO_SCORE;
  const checkCaps   = capsConDatos.length > 0 && capsBajas.length === 0;
  const listo       = checkPatron && checkForms && checkCaps;

  const criterios = [
    {
      ok:      checkPatron,
      label:   `Sin patrones bloqueantes (umbral: ×${UMBRAL_PATRON_FRECUENCIA})`,
      detalle: checkPatron
        ? 'Ningún patrón negativo supera el umbral de repeticiones'
        : bloqueantes.map(p => `"${(p as any).etiqueta}" ×${(p as any).frecuencia}`).join(' · '),
    },
    {
      ok:      checkForms,
      label:   `Conocimiento CAC ≥ ${UMBRAL_FORMULARIO_SCORE}/100`,
      detalle: formProm === null ? 'Sin formularios completados' : `Promedio actual: ${formProm}/100`,
    },
    {
      ok:      checkCaps,
      label:   `Todas las capacidades ≥ ${UMBRAL_CAPACIDAD_SCORE}/10`,
      detalle: capsConDatos.length === 0
        ? 'Sin datos de comportamientos — cargá evidencias etiquetadas'
        : capsBajas.length === 0
          ? 'Todas las capacidades con datos superan el umbral'
          : capsBajas.map(c => `${c.nombre} (${(c.score as number).toFixed(1)}/10)`).join(' · '),
    },
  ];

  // Textos de conectores causales
  const connEvidPatron = patronDominante
    ? `${evidList.length} evidencia${evidList.length !== 1 ? 's' : ''} · patrón dominante: "${(patronDominante as any).etiqueta}" ×${(patronDominante as any).frecuencia}`
    : `${evidList.length} evidencia${evidList.length !== 1 ? 's' : ''} cargadas — sin patrones aún`;

  const connPatronCuello = cuello
    ? `cuello de botella: ${cuello.nombre} (${(cuello.score as number).toFixed(1)}/10)`
    : patronDominante
      ? `patrón dominante en ${(patronDominante as any).capacidad?.nombre ?? 'capacidad'}`
      : 'sin cuello de botella identificado aún';

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">

      {/* Navegación */}
      <Link
        href="/admin/evolucion"
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
      </Link>

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Admin · Evolución"
          title={persona.nombre}
          description={`${persona.rol_actual ?? 'Setter'} · Ingresó ${new Date(persona.fecha_ingreso).toLocaleDateString('es-AR')}`}
        />
        <Link
          href={`/admin/evolucion/evidencia/nueva?persona_id=${persona.id}`}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/20 transition"
        >
          <Plus className="h-4 w-4" />
          Cargar evidencia
        </Link>
      </div>

      {/* Objetivo actual */}
      {persona.objetivo_actual && (
        <div className="mt-2 max-w-2xl rounded-xl border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.04)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-brand-gold/50 mb-1">Objetivo actual</p>
          <p className="text-sm text-brand-muted">{persona.objetivo_actual}</p>
        </div>
      )}

      {/* ── FRANJA DE FUENTES ─────────────────────────────────────────────────── */}
      <div className="mt-5 max-w-5xl flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-700/30 bg-blue-950/30 px-3 py-1 text-[11px] font-medium text-blue-300">
          <MessageSquare className="h-3 w-3" />
          {convCount} conversaci{convCount === 1 ? 'ón' : 'ones'} analizadas
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${
          formProm === null              ? 'border-zinc-700 bg-zinc-900 text-zinc-500'
          : formProm >= UMBRAL_FORMULARIO_SCORE ? 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'
          : 'border-amber-700/30 bg-amber-950/30 text-amber-300'
        }`}>
          <ClipboardCheck className="h-3 w-3" />
          {formSubs.length} formulario{formSubs.length !== 1 ? 's' : ''}{formProm !== null ? ` · prom. ${formProm}/100` : ''}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-700/30 bg-purple-950/30 px-3 py-1 text-[11px] font-medium text-purple-300">
          <Activity className="h-3 w-3" />
          {trainerCount} sesión{trainerCount !== 1 ? 'es' : ''} trainer
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-950/30 px-3 py-1 text-[11px] font-medium text-emerald-300">
          <Users className="h-3 w-3" />
          {leadsData.total} leads · {leadsData.reuniones} reuniones · {leadsData.cerrados} cierres
        </span>
      </div>

      {/* ── EVIDENCIAS ──────────────────────────────────────────────────────────── */}
      <div className="mt-6 max-w-5xl">
        <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
          <CalendarDays className="h-3.5 w-3.5" /> Evidencias ({evidList.length})
        </p>
        {evidList.length === 0 ? (
          <p className="text-xs text-brand-muted/50">Sin evidencias cargadas.</p>
        ) : (
          <div className="space-y-2">
            {evidList.map((ev: any) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TIPO_COLORS[ev.tipo] ?? 'bg-zinc-900 text-zinc-400 border-zinc-700'}`}>
                      {ev.tipo}
                    </span>
                    <span className="text-[10px] text-brand-muted">
                      {new Date(ev.fecha).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  {ev.contenido_resumen && (
                    <p className="mt-1.5 text-xs text-brand-muted line-clamp-2">{ev.contenido_resumen}</p>
                  )}
                </div>
                <Link
                  href={`/admin/evolucion/evidencia/${ev.id}/etiquetar`}
                  className="shrink-0 text-[10px] rounded border border-zinc-700 px-2 py-1 text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 transition"
                >
                  Etiquetar
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <CausalConnector text={connEvidPatron} />

      {/* ── PATRONES LIMITANTES ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl">
        <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
          <Zap className="h-3.5 w-3.5" /> Patrones limitantes ({negativos.length})
        </p>
        {negativos.length === 0 ? (
          <p className="text-xs text-brand-muted/50">Sin patrones negativos detectados.</p>
        ) : (
          <div className="space-y-2">
            {negativos.map((pat: any) => (
              <div
                key={pat.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <p className="truncate text-xs font-medium text-brand-text">{pat.etiqueta}</p>
                    {pat.frecuencia >= UMBRAL_PATRON_FRECUENCIA && (
                      <span className="rounded-full border border-red-700/30 bg-red-950/50 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                        BLOQUEANTE
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-brand-muted">
                    {pat.capacidad?.nombre}
                    <span>·</span>
                    <TendenciaBadge t={pat.tendencia ?? 'estable'} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-sm font-bold ${pat.frecuencia >= UMBRAL_PATRON_FRECUENCIA ? 'text-red-400' : 'text-brand-gold'}`}>
                    ×{pat.frecuencia}
                  </span>
                  <Link
                    href={`/admin/evolucion/intervencion/nueva?patron_id=${pat.id}&persona_id=${persona.id}`}
                    className="text-[10px] rounded border border-zinc-700 px-2 py-0.5 text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 transition"
                  >
                    Intervenir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CausalConnector text={connPatronCuello} />

      {/* ── CUELLO DE BOTELLA ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl">
        <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
          <AlertTriangle className="h-3.5 w-3.5" /> Cuello de botella
        </p>
        {!cuello && !patronDominante ? (
          <p className="text-xs text-brand-muted/50">Sin datos suficientes — etiquetá las evidencias para detectar el cuello.</p>
        ) : cuello ? (
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/10 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-300">{cuello.nombre}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">
                  {cuello.pos} comportamiento{cuello.pos !== 1 ? 's' : ''} positivo{cuello.pos !== 1 ? 's' : ''} · {cuello.neg} negativo{cuello.neg !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-amber-400">{(cuello.score as number).toFixed(1)}</p>
                <p className="text-[10px] text-brand-muted">/10</p>
              </div>
            </div>
            {patronDominante && (patronDominante as any).capacidad?.nombre === cuello.nombre && (
              <p className="mt-2 border-t border-amber-700/20 pt-2 text-[11px] text-brand-muted/70">
                Patrón asociado: &ldquo;{(patronDominante as any).etiqueta}&rdquo; ×{(patronDominante as any).frecuencia}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/10 px-4 py-3">
            <p className="text-sm font-semibold text-amber-300">{(patronDominante as any).capacidad?.nombre ?? '—'}</p>
            <p className="mt-1 text-[11px] text-brand-muted">
              &ldquo;{(patronDominante as any).etiqueta}&rdquo; · ×{(patronDominante as any).frecuencia} veces observado
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">Sin score — etiquetá comportamientos en las evidencias para calcular el rango 0-10</p>
          </div>
        )}
      </div>

      <CausalConnector text="por eso se prescribió la siguiente intervención →" />

      {/* ── INTERVENCIONES ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl">
        <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
          <ClipboardList className="h-3.5 w-3.5" /> Intervenciones ({intervList.length})
        </p>
        {intervList.length === 0 ? (
          <p className="text-xs text-brand-muted/50">Sin intervenciones registradas.</p>
        ) : (
          <div className="space-y-2">
            {intervList.map((interv: any) => (
              <div
                key={interv.id}
                className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${INTERV_COLORS[interv.tipo] ?? 'bg-zinc-900 text-zinc-400 border-zinc-700'}`}>
                    {interv.tipo.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-brand-muted">
                    {new Date(interv.fecha).toLocaleDateString('es-AR')}
                  </span>
                </div>
                {interv.patron && (
                  <p className="mt-1 text-[11px] text-brand-muted truncate">Patrón: {interv.patron.etiqueta}</p>
                )}
                {interv.resultado_observado && (
                  <p className="mt-1 text-xs text-brand-text/70">{interv.resultado_observado}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CausalConnector text="el panorama actual de capacidades →" />

      {/* ── CAPACIDADES 0-10 ────────────────────────────────────────────────────── */}
      <div className="max-w-5xl">
        <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
          Capacidades CAC · rango 0-10
        </p>
        {capWithScores.length === 0 ? (
          <p className="text-xs text-brand-muted/50">Sin capacidades cargadas.</p>
        ) : (
          <div className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-4 py-2 divide-y divide-zinc-800/50">
            {capWithScores.map((cap: any) => (
              <ScoreBar key={cap.id} score={cap.score} nombre={cap.nombre} />
            ))}
          </div>
        )}
      </div>

      {/* ── FORTALEZAS (patrones positivos) ─────────────────────────────────────── */}
      {positivos.length > 0 && (
        <div className="mt-6 max-w-5xl">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
            <Zap className="h-3.5 w-3.5" /> Fortalezas detectadas ({positivos.length})
          </p>
          <div className="space-y-2">
            {positivos.map((pat: any) => (
              <div
                key={pat.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <p className="truncate text-xs font-medium text-brand-text">{pat.etiqueta}</p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-brand-muted">
                    {pat.capacidad?.nombre}<span>·</span>
                    <TendenciaBadge t={pat.tendencia ?? 'estable'} />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-400">×{pat.frecuencia}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONOCIMIENTO CAC (formularios) ──────────────────────────────────────── */}
      <div className="mt-6 max-w-5xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
            <ClipboardCheck className="h-3.5 w-3.5" /> Conocimiento CAC ({formSubs.length} formularios)
          </p>
          {formProm !== null && (
            <span className="text-[10px] text-brand-muted/50">
              Promedio:{' '}
              <span className={`font-bold ${formProm >= UMBRAL_FORMULARIO_SCORE ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formProm}/100
              </span>
            </span>
          )}
        </div>
        {formSubs.length === 0 ? (
          <p className="text-xs text-brand-muted/50">Este setter no completó formularios aún.</p>
        ) : (
          <div className="space-y-2">
            {formSubs.map((sub: any) => {
              const score = sub.total_score ?? 0;
              const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
              const riskColor  = sub.ai_risk === 'bajo'  ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10'
                               : sub.ai_risk === 'medio' ? 'text-amber-400 border-amber-500/20 bg-amber-900/10'
                               : 'text-red-400 border-red-500/20 bg-red-900/10';
              const fecha = new Date(sub.submitted_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
              return (
                <div key={sub.id} className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-4 py-3">
                  <div className="flex-1 min-w-0">
                    {sub.reinforcement_forms?.topic && (
                      <p className="text-[10px] uppercase tracking-wider text-brand-gold/40 truncate">{sub.reinforcement_forms.topic}</p>
                    )}
                    <p className="text-xs font-semibold text-brand-text truncate">{sub.reinforcement_forms?.title ?? 'Formulario'}</p>
                    <p className="text-[10px] text-brand-muted mt-0.5">{fecha}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.ai_risk && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${riskColor}`}>IA {sub.ai_risk}</span>
                    )}
                    {sub.nivel_general && (
                      <span className="text-[10px] text-brand-muted capitalize">{sub.nivel_general.replace('_', ' ')}</span>
                    )}
                    <span className={`text-base font-black ${scoreColor}`}>{score}</span>
                    <span className="text-[10px] text-brand-muted/50">/100</span>
                  </div>
                  <Link
                    href={`/admin/forms/${sub.form_id}`}
                    className="shrink-0 text-[10px] rounded border border-zinc-700 px-2 py-1 text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 transition flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── OPERACIÓN (leads) ───────────────────────────────────────────────────── */}
      {personaUserId && (
        <div className="mt-6 max-w-5xl">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
            <Users className="h-3.5 w-3.5" /> Operación · leads asignados
          </p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: 'Leads totales',        value: leadsData.total,     color: 'text-brand-text' },
              { label: 'Reuniones agendadas',   value: leadsData.reuniones, color: 'text-amber-400'  },
              { label: 'Cerrados',              value: leadsData.cerrados,  color: 'text-emerald-400' },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-4 py-3 text-center">
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {leadsData.total > 0 && (
            <p className="mt-2 text-[10px] text-brand-muted/50">
              Tasa de reunión: {Math.round((leadsData.reuniones / leadsData.total) * 100)}%
              {' · '}
              Tasa de cierre: {Math.round((leadsData.cerrados / leadsData.total) * 100)}%
            </p>
          )}
        </div>
      )}

      {/* ── CRITERIO DE PASE ────────────────────────────────────────────────────── */}
      <div className="mt-6 max-w-5xl mb-12">
        <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
          Criterio de pase
        </p>
        <div className={`rounded-xl border px-4 py-4 ${listo ? 'border-emerald-600/40 bg-emerald-950/10' : 'border-red-700/30 bg-red-950/10'}`}>
          <div className="mb-3 flex items-center gap-3">
            {listo
              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              : <XCircle     className="h-5 w-5 shrink-0 text-red-400" />
            }
            <p className={`text-base font-black tracking-wide ${listo ? 'text-emerald-400' : 'text-red-400'}`}>
              {listo ? 'LISTO PARA PASE' : 'NO LISTO — bloqueantes activos'}
            </p>
          </div>
          <div className="space-y-2.5">
            {criterios.map(c => (
              <div key={c.label} className="flex items-start gap-2.5">
                {c.ok
                  ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : <XCircle     className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                }
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold ${c.ok ? 'text-emerald-300' : 'text-red-300'}`}>{c.label}</p>
                  <p className="mt-0.5 text-[10px] text-brand-muted">{c.detalle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
