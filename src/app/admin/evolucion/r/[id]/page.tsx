import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

const CAP_LABEL: Record<string, string> = {
  claridad_ejecutiva:     'Claridad Ejecutiva',
  priorizacion:           'Priorización',
  delegacion:             'Delegación',
  seguimiento:            'Seguimiento',
  comunicacion_ejecutiva: 'Comunicación Ejecutiva',
  presencia:              'Presencia',
};

const CAP_COLOR: Record<string, string> = {
  claridad_ejecutiva:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  priorizacion:           'bg-purple-500/20 text-purple-300 border-purple-500/30',
  delegacion:             'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  seguimiento:            'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  comunicacion_ejecutiva: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  presencia:              'bg-red-500/20 text-red-300 border-red-500/30',
};

export default async function ResultadoPage({ params }: { params: { id: string } }) {
  // Auth check
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: profile } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') redirect('/');

  // Cargar evidencia
  const { data: ev } = await (admin as any)
    .from('d2030_evidencias')
    .select('id, titulo, tipo, fecha, contexto, estado_proc, error_msg, procesado_at')
    .eq('id', params.id)
    .single();

  if (!ev) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
      Evidencia no encontrada.
    </div>
  );

  // Cargar comportamientos con sus impactos
  const { data: comps } = await (admin as any)
    .from('d2030_comportamientos')
    .select(`
      id, descripcion, cita_textual, intensidad, fecha,
      d2030_comportamiento_capacidades(capacidad_clave, valencia, peso)
    `)
    .eq('evidencia_id', params.id)
    .order('created_at');

  // Cargar mediciones de esta evidencia
  const { data: meds } = await (admin as any)
    .from('d2030_mediciones')
    .select('capacidad_clave, valor, justificacion, confianza')
    .eq('evidencia_id', params.id)
    .order('valor', { ascending: false });

  // Cargar nivel_actual actual por capacidad (estado post-procesamiento)
  const { data: caps } = await (admin as any)
    .from('d2030_capacidades')
    .select('clave, nivel_actual')
    .eq('activa', true);

  const nivelActual: Record<string, number | null> = {};
  for (const c of (caps ?? [])) nivelActual[c.clave] = c.nivel_actual;

  const comportamientos: any[] = comps ?? [];
  const mediciones: any[] = meds ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-8">

        {/* Header */}
        <div>
          <a href="/admin/evolucion" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Diego 2030</a>
          <h1 className="text-xl font-bold text-white mt-2 tracking-tight">{ev.titulo}</h1>
          <div className="text-sm text-zinc-500 mt-1 flex items-center gap-3">
            <span>{ev.tipo}</span>
            {ev.fecha && <span>{ev.fecha}</span>}
            {ev.estado_proc === 'ready' && <span className="text-emerald-500">✓ procesada</span>}
            {ev.estado_proc === 'error' && <span className="text-red-400">✗ error</span>}
            {ev.estado_proc === 'processing' && <span className="text-yellow-400 animate-pulse">procesando...</span>}
          </div>
          {ev.error_msg && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 font-mono">{ev.error_msg}</div>
          )}
        </div>

        {/* Estado: sin datos */}
        {ev.estado_proc !== 'ready' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
            {ev.estado_proc === 'processing' ? 'El pipeline está corriendo...' :
             ev.estado_proc === 'pending'    ? 'Pendiente de procesar.' :
             'El pipeline terminó con error. Revisá error_msg arriba.'}
          </div>
        )}

        {ev.estado_proc === 'ready' && comportamientos.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
            El LLM no encontró comportamientos observables de Diego en esta evidencia.
          </div>
        )}

        {/* Comportamientos */}
        {comportamientos.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Comportamientos extraídos · {comportamientos.length}
            </h2>
            <div className="space-y-4">
              {comportamientos.map((c: any) => {
                const impactos: any[] = c.d2030_comportamiento_capacidades ?? [];
                return (
                  <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-zinc-100 leading-relaxed">{c.descripcion}</p>

                    {c.cita_textual && (
                      <blockquote className="border-l-2 border-zinc-600 pl-3 text-xs text-zinc-400 italic leading-relaxed">
                        &ldquo;{c.cita_textual}&rdquo;
                      </blockquote>
                    )}

                    {impactos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {impactos.map((imp: any) => (
                          <span
                            key={imp.capacidad_clave}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium ${
                              CAP_COLOR[imp.capacidad_clave] ?? 'bg-zinc-700 text-zinc-300 border-zinc-600'
                            }`}
                          >
                            {CAP_LABEL[imp.capacidad_clave] ?? imp.capacidad_clave}
                            <span className={`opacity-70 ${imp.valencia === 'refuerza' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {imp.valencia === 'refuerza' ? '↑' : '↓'}
                            </span>
                            <span className="opacity-50">{imp.peso}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mediciones generadas */}
        {mediciones.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Mediciones generadas · aporte neto por capacidad
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {mediciones.map((m: any) => {
                const neto = m.valor as number;
                const nivel = nivelActual[m.capacidad_clave];
                return (
                  <div key={m.capacidad_clave} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-40 shrink-0">
                      <div className="text-sm font-medium text-zinc-200">{CAP_LABEL[m.capacidad_clave] ?? m.capacidad_clave}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{m.confianza} confianza</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${neto > 0 ? 'text-emerald-400' : neto < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                          {neto > 0 ? '+' : ''}{neto}
                        </span>
                        <span className="text-xs text-zinc-600">aporte neto</span>
                        {nivel != null && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-xs text-zinc-400">nivel actual: <span className="text-zinc-200 font-semibold">{nivel}/10</span></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
