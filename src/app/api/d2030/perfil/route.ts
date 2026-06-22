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
 * Las 6 capacidades con nivel_actual, tendencia y último comportamiento.
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data: perfil } = await (admin as any).from('perfil').select('id').limit(1).single();
    if (!perfil?.id) return NextResponse.json({ error: 'Perfil no inicializado. Corré la migración 0029.' }, { status: 404 });

    const [capsRes, medsRes, compsRes, countEvRes, countCompRes] = await Promise.all([
      (admin as any).from('objetivo_crecimiento').select('id, nombre, nombre_display, nivel_actual, orden').eq('perfil_id', perfil.id).eq('activo', true).order('orden'),
      (admin as any).from('medicion').select('capacidad_id, valor, fecha, created_at').order('created_at', { ascending: false }).limit(60),
      (admin as any)
        .from('comportamiento')
        .select('id, descripcion, cita, fecha, created_at, evidencia_id, comportamiento_capacidad(capacidad_id, valencia), evidencia(tipo)')
        .order('created_at', { ascending: false })
        .limit(120),
      (admin as any).from('evidencia').select('*', { count: 'exact', head: true }).eq('perfil_id', perfil.id).eq('estado', 'procesada'),
      (admin as any).from('comportamiento').select('*', { count: 'exact', head: true }),
    ]);

    const caps:  any[] = capsRes.data  ?? [];
    const meds:  any[] = medsRes.data  ?? [];
    const comps: any[] = compsRes.data ?? [];
    const totalEvidencias        = countEvRes.count  ?? 0;
    const totalComportamientos   = countCompRes.count ?? 0;

    // 2 últimas mediciones por capacidad (para tendencia)
    const medsByCap: Record<string, any[]> = {};
    for (const m of meds) {
      if (!medsByCap[m.capacidad_id]) medsByCap[m.capacidad_id] = [];
      if (medsByCap[m.capacidad_id].length < 2) medsByCap[m.capacidad_id].push(m);
    }

    // Último comportamiento por capacidad
    const lastCompByCap: Record<string, any> = {};
    for (const c of comps) {
      for (const link of (c.comportamiento_capacidad ?? [])) {
        if (!lastCompByCap[link.capacidad_id]) {
          lastCompByCap[link.capacidad_id] = {
            id:           c.id,
            descripcion:  c.descripcion,
            cita:         c.cita,
            fecha:        c.fecha,
            evidencia_id: c.evidencia_id,
            tipo_evidencia: c.evidencia?.tipo ?? null,
            valencia:     link.valencia,
          };
        }
      }
    }

    const capacidades = caps.map(cap => {
      const capMeds  = medsByCap[cap.id] ?? [];
      const lastMed  = capMeds[0] ?? null;
      const prevMed  = capMeds[1] ?? null;
      let tendencia: 'sube' | 'baja' | 'estable' | null = null;
      if (lastMed && prevMed) {
        const diff = lastMed.valor - prevMed.valor;
        tendencia = diff > 0.05 ? 'sube' : diff < -0.05 ? 'baja' : 'estable';
      }
      return {
        id:            cap.id,
        nombre:        cap.nombre,
        nombre_display: cap.nombre_display,
        nivel_actual:  cap.nivel_actual ?? null,
        tendencia,
        ultima_medicion: lastMed ? { valor: lastMed.valor, fecha: lastMed.fecha } : null,
        ultimo_comportamiento: lastCompByCap[cap.id] ?? null,
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
