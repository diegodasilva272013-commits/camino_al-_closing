import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import {
  Plus, TrendingUp, TrendingDown, Minus, User, Zap, ChevronRight,
  ClipboardCheck, MessageSquare, Swords, Users2,
} from 'lucide-react';
import { MotorRunButton } from '@/components/evolucion/MotorRunButton';

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

function StatChip({ icon: Icon, count, label, active }: { icon: any; count: number; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
      active
        ? 'border border-zinc-700 bg-zinc-900 text-brand-text'
        : 'border border-zinc-800/40 bg-zinc-950/50 text-zinc-600'
    }`}>
      <Icon className={`h-3 w-3 ${active ? 'text-brand-gold' : 'text-zinc-700'}`} />
      <span className={`font-semibold ${active ? 'text-brand-gold' : 'text-zinc-600'}`}>{count}</span>
      <span>{label}</span>
    </div>
  );
}

function countByField(rows: any[], field: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const uid = r[field] as string;
    if (uid) map.set(uid, (map.get(uid) ?? 0) + 1);
  }
  return map;
}

export default async function EvolucionEquipoDashboard() {
  const admin = createSupabaseAdminClient() as any;

  // ── Paso 1: lista de setters (fuente de verdad) ───────────────────────────
  const { data: setterProfiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'setter')
    .order('full_name');

  const setters = (setterProfiles ?? []) as any[];
  const setterIds = setters.map((p: any) => p.id as string);

  // ── Paso 2: actividad real por user_id (todas en paralelo) ───────────────
  const [
    { data: personasData },
    { data: patronesData },
    { data: submissionsData },
    { data: conversationsData },
    { data: trainerData },
    { data: leadsData },
  ] = await Promise.all([
    // personas: solo para saber si hay perfil CAC y para linkear al detalle
    admin.from('personas').select('id, user_id, rol_actual'),
    // patrones: solo para los que tienen persona
    admin.from('patrones')
      .select('id, persona_id, etiqueta, frecuencia, tendencia, capacidad:capacidades(nombre), catalogo:catalogo_comportamientos(tipo)')
      .gt('frecuencia', 1)
      .order('frecuencia', { ascending: false })
      .limit(300),
    // actividad real — columna user_id
    setterIds.length
      ? admin.from('reinforcement_submissions').select('user_id').in('user_id', setterIds)
      : Promise.resolve({ data: [] }),
    setterIds.length
      ? admin.from('conversation_analyses').select('user_id').in('user_id', setterIds)
      : Promise.resolve({ data: [] }),
    setterIds.length
      ? admin.from('trainer_sessions').select('user_id').in('user_id', setterIds)
      : Promise.resolve({ data: [] }),
    // leads usa assigned_to_user_id
    setterIds.length
      ? admin.from('leads').select('assigned_to_user_id').in('assigned_to_user_id', setterIds)
      : Promise.resolve({ data: [] }),
  ]);

  // ── Mapas de lookup ───────────────────────────────────────────────────────
  const personaByUserId = new Map<string, any>(
    ((personasData ?? []) as any[]).map((p: any) => [p.user_id as string, p])
  );

  const patronesByPersonaId = new Map<string, any[]>();
  for (const p of (patronesData ?? []) as any[]) {
    const list = patronesByPersonaId.get(p.persona_id as string) ?? [];
    list.push(p);
    patronesByPersonaId.set(p.persona_id as string, list);
  }

  const submissionsCount   = countByField((submissionsData   ?? []) as any[], 'user_id');
  const conversationsCount = countByField((conversationsData ?? []) as any[], 'user_id');
  const trainerCount       = countByField((trainerData       ?? []) as any[], 'user_id');
  const leadsCount         = countByField((leadsData         ?? []) as any[], 'assigned_to_user_id');

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
            const persona    = personaByUserId.get(profile.id) ?? null;
            const pats       = persona ? (patronesByPersonaId.get(persona.id) ?? []) : [];
            const topPats    = pats.slice(0, 4);

            const formCount  = submissionsCount.get(profile.id)   ?? 0;
            const convCount  = conversationsCount.get(profile.id)  ?? 0;
            const trainCount = trainerCount.get(profile.id)        ?? 0;
            const leadCount  = leadsCount.get(profile.id)          ?? 0;
            const hasActivity = formCount + convCount + trainCount + leadCount > 0;

            return (
              <div
                key={profile.id}
                className="rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-5"
              >
                {/* Cabecera */}
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
                        {persona ? (persona.rol_actual ?? 'Setter') : 'Sin perfil CAC'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {persona && (
                      <span className="text-[11px] text-brand-muted">
                        {pats.length} patrón{pats.length !== 1 ? 'es' : ''}
                      </span>
                    )}
                    <Link
                      href={`/admin/evolucion/persona/${profile.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs font-medium text-brand-gold hover:border-brand-gold/50 transition"
                    >
                      Ver <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Actividad real por user_id */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatChip icon={ClipboardCheck} count={formCount}  label="formularios"   active={formCount  > 0} />
                  <StatChip icon={MessageSquare}  count={convCount}  label="conversaciones" active={convCount  > 0} />
                  <StatChip icon={Swords}         count={trainCount} label="trainer"        active={trainCount > 0} />
                  <StatChip icon={Users2}         count={leadCount}  label="leads"          active={leadCount  > 0} />
                </div>

                {/* Patrones (solo si tiene persona CAC) */}
                {topPats.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {topPats.map((pat: any) => (
                      <div
                        key={pat.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 bg-[#0a0a0a] px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${
                            pat.catalogo?.tipo === 'negativo' ? 'bg-red-500' : 'bg-emerald-500'
                          }`} />
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

                {!hasActivity && !persona && (
                  <p className="mt-2 text-[10px] text-zinc-700">Sin actividad registrada aún.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap items-center">
        <MotorRunButton label="Analizar todo el equipo" />
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
