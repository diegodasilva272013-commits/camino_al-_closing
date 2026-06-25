import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { Plus, TrendingUp, TrendingDown, Minus, User, Zap, ChevronRight } from 'lucide-react';

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

  // ── Fuente de verdad: profiles para la lista de setters ───────────────────
  const [
    { data: setterProfiles },
    { data: personasData },
    { data: patronesData },
  ] = await Promise.all([
    admin.from('profiles')
      .select('id, full_name, email')
      .eq('role', 'setter')
      .order('full_name'),
    // Personas: solo para cruzar datos de evolución, NO como fuente de lista
    admin.from('personas')
      .select('id, nombre, user_id, rol_actual'),
    admin.from('patrones')
      .select('id, persona_id, etiqueta, frecuencia, tendencia, capacidad:capacidades(nombre), catalogo:catalogo_comportamientos(tipo)')
      .gt('frecuencia', 1)
      .order('frecuencia', { ascending: false })
      .limit(300),
  ]);

  const setters = (setterProfiles ?? []) as any[];
  const personas = (personasData  ?? []) as any[];
  const patrones = (patronesData  ?? []) as any[];

  // LEFT JOIN en JS: persona por user_id
  const personaByUserId = new Map<string, any>(
    personas.map((p: any) => [p.user_id as string, p])
  );

  // Patrones agrupados por persona_id
  const patronesByPersonaId = new Map<string, any[]>();
  for (const p of patrones) {
    const list = patronesByPersonaId.get(p.persona_id as string) ?? [];
    list.push(p);
    patronesByPersonaId.set(p.persona_id as string, list);
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Admin · Sistema de Evolución CAC"
          title="Evolución del Equipo"
          description={`${setters.length} setters · fuente: profiles`}
        />
        <Link
          href="/admin/evolucion/persona/nueva"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/20 transition"
        >
          <Plus className="h-4 w-4" />
          Nueva persona
        </Link>
      </div>

      {setters.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[rgba(212,175,55,0.03)] p-10 text-center">
          <Zap className="mx-auto h-10 w-10 text-brand-gold/20 mb-3" />
          <p className="text-brand-muted">No hay setters registrados en profiles.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3 max-w-5xl">
          {setters.map((profile: any) => {
            const persona = personaByUserId.get(profile.id) ?? null;
            const pats    = persona ? (patronesByPersonaId.get(persona.id) ?? []) : [];
            const topPats = pats.slice(0, 4);

            return (
              <div
                key={profile.id}
                className="rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.2)] bg-brand-gold/10">
                      <User className="h-4 w-4 text-brand-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-brand-text">
                        {profile.full_name ?? profile.email ?? 'Sin nombre'}
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        {persona ? (persona.rol_actual ?? 'Setter') : 'Sin perfil CAC aún'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {persona ? (
                      <>
                        <span className="text-[11px] text-brand-muted">
                          {pats.length} patrón{pats.length !== 1 ? 'es' : ''}
                        </span>
                        <Link
                          href={`/admin/evolucion/persona/${persona.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs font-medium text-brand-gold hover:border-brand-gold/50 transition"
                        >
                          Ver perfil <ChevronRight className="h-3 w-3" />
                        </Link>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-600">sin datos CAC</span>
                    )}
                  </div>
                </div>

                {topPats.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {topPats.map((pat: any) => (
                      <div
                        key={pat.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 bg-[#0a0a0a] px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${pat.catalogo?.tipo === 'negativo' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <p className="truncate text-xs text-brand-text">{pat.etiqueta}</p>
                          {pat.capacidad?.nombre && (
                            <span className="hidden sm:block shrink-0 text-[10px] text-brand-muted">
                              · {pat.capacidad.nombre}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[11px] font-semibold text-brand-gold">×{pat.frecuencia}</span>
                          <TendenciaBadge t={pat.tendencia ?? 'estable'} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {persona && pats.length === 0 && (
                  <p className="mt-2 text-xs text-brand-muted/50">Sin patrones registrados aún.</p>
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
