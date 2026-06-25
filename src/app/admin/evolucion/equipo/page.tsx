import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { Plus, TrendingUp, TrendingDown, Minus, User, Zap, ChevronRight } from 'lucide-react';
import type { Patron, Persona } from '@/types/evolucion';

export const dynamic = 'force-dynamic';

function TendenciaBadge({ t }: { t: string }) {
  if (t === 'aumentando')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-700/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <TrendingUp className="h-3 w-3" /> Aumentando
      </span>
    );
  if (t === 'disminuyendo')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-950/40 border border-red-700/30 px-2 py-0.5 text-[10px] font-medium text-red-400">
        <TrendingDown className="h-3 w-3" /> Disminuyendo
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
      <Minus className="h-3 w-3" /> Estable
    </span>
  );
}

export default async function EvolucionEquipoDashboard() {
  const admin = createSupabaseAdminClient() as any;

  const [{ data: personas }, { data: patrones }] = await Promise.all([
    admin.from('personas').select('*').eq('activo', true).order('nombre'),
    admin
      .from('patrones')
      .select('*, persona:personas(nombre), capacidad:capacidades(nombre), catalogo:catalogo_comportamientos(tipo)')
      .gt('frecuencia', 1)
      .order('frecuencia', { ascending: false })
      .limit(50),
  ]);

  const personaList: Persona[] = personas ?? [];
  const patronList: Patron[]   = patrones  ?? [];

  const patronesPorPersona: Record<string, Patron[]> = {};
  for (const p of patronList) {
    const pid = p.persona_id;
    if (!patronesPorPersona[pid]) patronesPorPersona[pid] = [];
    patronesPorPersona[pid].push(p);
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Admin · Sistema de Evolución CAC"
          title="Evolución del Equipo"
          description="Patrones de comportamiento activos por setter"
        />
        <Link
          href="/admin/evolucion/persona/nueva"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/20 transition"
        >
          <Plus className="h-4 w-4" />
          Nueva persona
        </Link>
      </div>

      {personaList.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[rgba(212,175,55,0.03)] p-10 text-center">
          <Zap className="mx-auto h-10 w-10 text-brand-gold/20 mb-3" />
          <p className="text-brand-muted">Todavía no hay personas registradas.</p>
          <Link
            href="/admin/evolucion/persona/nueva"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/20 transition"
          >
            <Plus className="h-4 w-4" /> Agregar primera persona
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4 max-w-5xl">
          {personaList.map((persona) => {
            const pats = patronesPorPersona[persona.id] ?? [];
            const topPatrons = pats.slice(0, 5);
            return (
              <div
                key={persona.id}
                className="rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.2)] bg-brand-gold/10">
                      <User className="h-4 w-4 text-brand-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-brand-text">{persona.nombre}</p>
                      <p className="text-[11px] text-brand-muted">{persona.rol_actual ?? 'Setter'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-brand-muted">
                      {pats.length} patrón{pats.length !== 1 ? 'es' : ''}
                    </span>
                    <Link
                      href={`/admin/evolucion/persona/${persona.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs font-medium text-brand-gold hover:border-brand-gold/50 transition"
                    >
                      Ver perfil <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {topPatrons.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {topPatrons.map((pat: any) => (
                      <div
                        key={pat.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 bg-[#0a0a0a] px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${pat.catalogo?.tipo === 'negativo' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <p className="truncate text-xs text-brand-text">{pat.etiqueta}</p>
                          {pat.capacidad && (
                            <span className="hidden sm:block shrink-0 text-[10px] text-brand-muted">
                              · {pat.capacidad.nombre}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[11px] font-semibold text-brand-gold">
                            ×{pat.frecuencia}
                          </span>
                          <TendenciaBadge t={pat.tendencia ?? 'estable'} />
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

                {pats.length === 0 && (
                  <p className="mt-3 text-xs text-brand-muted/50">Sin patrones registrados aún.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap">
        <Link
          href="/admin/evolucion/catalogo"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-brand-muted hover:text-brand-text hover:border-zinc-500 transition"
        >
          Revisión catálogo
        </Link>
      </div>
    </div>
  );
}
