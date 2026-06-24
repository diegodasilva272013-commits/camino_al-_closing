import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import {
  Plus, ArrowLeft, TrendingUp, TrendingDown, Minus,
  CalendarDays, Zap, ClipboardList, ClipboardCheck, ExternalLink,
} from 'lucide-react';
import type { Evidencia, Patron, Intervencion } from '@/types/evolucion';

export const dynamic = 'force-dynamic';

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

export default async function PerfilPersonaPage({ params }: { params: { id: string } }) {
  const admin = createSupabaseAdminClient() as any;
  const { id } = params;

  const [
    { data: persona },
    { data: evidencias },
    { data: patrones },
    { data: intervenciones },
  ] = await Promise.all([
    admin.from('personas').select('*').eq('id', id).single(),
    admin.from('evidencias').select('*').eq('persona_id', id).order('fecha', { ascending: false }),
    admin.from('patrones').select('*, capacidad:capacidades(nombre)').eq('persona_id', id).order('frecuencia', { ascending: false }),
    admin.from('intervenciones').select('*, patron:patrones(etiqueta), capacidad:capacidades(nombre)').eq('persona_id', id).order('fecha', { ascending: false }),
  ]);

  if (!persona) notFound();

  // Vincular persona → user_id (post-migración 0033: user_id directo; fallback por email)
  let formSubs: any[] = [];
  let personaUserId: string | null = persona.user_id ?? null;
  try {
    if (!personaUserId && persona.email) {
      const { data: profile } = await (admin as any)
        .from('profiles')
        .select('id')
        .eq('email', persona.email)
        .maybeSingle();
      personaUserId = profile?.id ?? null;
    }

    if (personaUserId) {
      const { data } = await (admin as any)
        .from('reinforcement_submissions')
        .select('id, form_id, submitted_at, total_score, nivel_general, ai_risk, reinforcement_forms(title, topic)')
        .eq('user_id', personaUserId)
        .eq('status', 'analyzed')
        .order('submitted_at', { ascending: false });
      formSubs = data ?? [];
    }
  } catch {}

  const evidList: Evidencia[]     = evidencias    ?? [];
  const patronList: Patron[]       = patrones      ?? [];
  const intervList: Intervencion[] = intervenciones ?? [];

  const positivos  = patronList.filter((p: any) => p.tipo !== 'negativo');
  const negativos  = patronList.filter((p: any) => p.tipo === 'negativo');

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <Link
        href="/admin/evolucion"
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
      </Link>

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

      {persona.objetivo_actual && (
        <div className="mt-2 max-w-2xl rounded-xl border border-[rgba(212,175,55,0.12)] bg-[rgba(212,175,55,0.04)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-brand-gold/50 mb-1">Objetivo actual</p>
          <p className="text-sm text-brand-muted">{persona.objetivo_actual}</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2 max-w-5xl">
        {/* Patrones */}
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
            <Zap className="h-3.5 w-3.5" /> Patrones ({patronList.length})
          </p>
          {patronList.length === 0 ? (
            <p className="text-xs text-brand-muted/50">Sin patrones. Cargá evidencias primero.</p>
          ) : (
            <div className="space-y-2">
              {patronList.map((pat: any) => (
                <div
                  key={pat.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pat.tipo === 'negativo' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      <p className="truncate text-xs font-medium text-brand-text">{pat.etiqueta}</p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-brand-muted">
                      {pat.capacidad?.nombre}
                      <span>·</span>
                      <TendenciaBadge t={pat.tendencia ?? 'estable'} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-brand-gold">×{pat.frecuencia}</span>
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

        {/* Intervenciones */}
        <div>
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
                    <p className="mt-1 text-[11px] text-brand-muted truncate">
                      Patrón: {interv.patron.etiqueta}
                    </p>
                  )}
                  {interv.resultado_observado && (
                    <p className="mt-1 text-xs text-brand-text/70">{interv.resultado_observado}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formularios de refuerzo — conectados por email */}
      <div className="mt-6 max-w-5xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-brand-gold/50">
            <ClipboardCheck className="h-3.5 w-3.5" /> Formularios CAC ({formSubs.length})
          </p>
          {formSubs.length > 0 && (
            <span className="text-[10px] text-brand-muted/50">
              Promedio: <span className="text-brand-gold font-bold">
                {Math.round(formSubs.reduce((s: number, f: any) => s + (f.total_score ?? 0), 0) / formSubs.length)}/100
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
              const riskColor  = sub.ai_risk === 'bajo' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10'
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

      {/* Evidencias */}
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
    </div>
  );
}
