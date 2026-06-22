import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

/**
 * GET /api/d2030/perfil
 * Devuelve el estado actual del perfil de Diego:
 * - 6 capacidades con nivel_actual, tendencia, último comportamiento que las movió
 * - Conteos de evidencias y comportamientos
 * - tiene_datos: false si no hay ningún comportamiento aún
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    // 4 queries paralelas
    const [capsRes, medsRes, compsRes, countEvRes, countCompRes] = await Promise.all([
      // 1. Las 6 capacidades
      (admin as any).from('d2030_capacidades').select('clave, nombre, nivel_actual, nivel_objetivo, orden').eq('activa', true).order('orden'),

      // 2. Últimas 60 mediciones (10 por cap × 6) para tendencia y nivel
      (admin as any).from('d2030_mediciones').select('capacidad_clave, valor, fecha, created_at').order('created_at', { ascending: false }).limit(60),

      // 3. Últimos 120 comportamientos con su link a capacidades + titulo de evidencia
      (admin as any).from('d2030_comportamientos')
        .select('id, descripcion, cita_textual, fecha, created_at, evidencia_id, d2030_comportamiento_capacidades(capacidad_clave, valencia), d2030_evidencias(titulo)')
        .order('created_at', { ascending: false })
        .limit(120),

      // 4. Total evidencias procesadas
      (admin as any).from('d2030_evidencias').select('*', { count: 'exact', head: true }).eq('estado_proc', 'ready'),

      // 5. Total comportamientos
      (admin as any).from('d2030_comportamientos').select('*', { count: 'exact', head: true }),
    ]);

    const caps:  any[] = capsRes.data  ?? [];
    const meds:  any[] = medsRes.data  ?? [];
    const comps: any[] = compsRes.data ?? [];
    const totalEvidencias    = countEvRes.count  ?? 0;
    const totalComportamientos = countCompRes.count ?? 0;

    // Agrupar mediciones por capacidad (queremos las 2 más recientes para tendencia)
    const medsByCap: Record<string, any[]> = {};
    for (const m of meds) {
      if (!medsByCap[m.capacidad_clave]) medsByCap[m.capacidad_clave] = [];
      if (medsByCap[m.capacidad_clave].length < 2) medsByCap[m.capacidad_clave].push(m);
    }

    // Último comportamiento por capacidad (el más reciente que la impactó)
    const lastCompByCap: Record<string, any> = {};
    for (const c of comps) {
      for (const link of (c.d2030_comportamiento_capacidades ?? [])) {
        if (!lastCompByCap[link.capacidad_clave]) {
          lastCompByCap[link.capacidad_clave] = {
            id:              c.id,
            descripcion:     c.descripcion,
            cita_textual:    c.cita_textual,
            fecha:           c.fecha,
            evidencia_id:    c.evidencia_id,
            evidencia_titulo: c.d2030_evidencias?.titulo ?? null,
            valencia:        link.valencia,
          };
        }
      }
    }

    const capacidades = caps.map(cap => {
      const capMeds   = medsByCap[cap.clave] ?? [];
      const lastMed   = capMeds[0] ?? null;
      const prevMed   = capMeds[1] ?? null;

      let tendencia: 'sube' | 'baja' | 'estable' | null = null;
      if (lastMed && prevMed) {
        const diff = lastMed.valor - prevMed.valor;
        tendencia = diff > 0.05 ? 'sube' : diff < -0.05 ? 'baja' : 'estable';
      }

      return {
        clave:           cap.clave,
        nombre:          cap.nombre,
        nivel_actual:    cap.nivel_actual ?? null,
        nivel_objetivo:  cap.nivel_objetivo,
        tendencia,
        ultima_medicion: lastMed ? { valor: lastMed.valor, fecha: lastMed.fecha } : null,
        ultimo_comportamiento: lastCompByCap[cap.clave] ?? null,
      };
    });

    return NextResponse.json({
      tiene_datos:           totalComportamientos > 0,
      total_evidencias:      totalEvidencias,
      total_comportamientos: totalComportamientos,
      capacidades,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
