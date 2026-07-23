import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { APP_TIMEZONE } from '@/constants/timezone';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agenda/closers/[id]/slots?fecha=YYYY-MM-DD&duracion_min=60
 *
 * Devuelve slots libres del closer ese día.
 * Lógica:
 *  1. Obtener day-of-week del fecha en America/Caracas
 *  2. Obtener franjas activas del closer para ese día
 *  3. Generar slots de duracion_min dentro de cada franja
 *  4. Restar slots que se solapan con reuniones agendadas/reprogramadas
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const fecha = req.nextUrl.searchParams.get('fecha'); // YYYY-MM-DD en Caracas
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'fecha requerida (YYYY-MM-DD)' }, { status: 400 });
  }

  const duracionMin = parseInt(req.nextUrl.searchParams.get('duracion_min') ?? '60', 10);
  if (isNaN(duracionMin) || duracionMin < 15) {
    return NextResponse.json({ error: 'duracion_min mínimo 15' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient() as any;

  // Verificar que el closer existe
  const { data: closerProfile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', params.id)
    .eq('role', 'closer')
    .single();
  if (!closerProfile) return NextResponse.json({ error: 'Closer no encontrado' }, { status: 404 });

  const diaSemana = getDayOfWeek(fecha);

  // Franjas activas del closer para ese día
  const { data: franjas } = await admin
    .from('closer_availability')
    .select('hora_inicio, hora_fin')
    .eq('closer_id', params.id)
    .eq('dia_semana', diaSemana)
    .eq('activa', true);

  if (!franjas || franjas.length === 0) {
    return NextResponse.json([]);
  }

  // Rango UTC del día Caracas (UTC-4:00)
  const inicioUTC = new Date(`${fecha}T04:00:00Z`); // 00:00 Caracas = 04:00 UTC
  const finUTC    = new Date(inicioUTC.getTime() + 24 * 60 * 60 * 1000);

  const { data: reunionesOcupadas } = await admin
    .from('reuniones')
    .select('inicio, duracion_min')
    .eq('closer_id', params.id)
    .in('estado', ['agendada', 'reprogramada'])
    .gte('inicio', inicioUTC.toISOString())
    .lt('inicio', finUTC.toISOString());

  // Generar todos los slots posibles
  const slotsDisponibles: { inicio: string; fin: string }[] = [];

  for (const franja of franjas as { hora_inicio: string; hora_fin: string }[]) {
    // Convertir hora local Caracas a UTC para ese fecha
    const [hIni, mIni] = franja.hora_inicio.split(':').map(Number);
    const [hFin, mFin] = franja.hora_fin.split(':').map(Number);

    // UTC = Caracas + 4:00
    const franjaInicioUTC = new Date(inicioUTC.getTime() + (hIni * 60 + mIni) * 60 * 1000);
    const franjaFinUTC    = new Date(inicioUTC.getTime() + (hFin * 60 + mFin) * 60 * 1000);

    let cursor = franjaInicioUTC.getTime();
    const durMs = duracionMin * 60 * 1000;

    while (cursor + durMs <= franjaFinUTC.getTime()) {
      const slotIni = new Date(cursor);
      const slotFin = new Date(cursor + durMs);

      // Verificar solapamiento con reuniones ocupadas
      const solapado = (reunionesOcupadas ?? []).some((r: { inicio: string; duracion_min: number }) => {
        const rIni = new Date(r.inicio).getTime();
        const rFin = rIni + r.duracion_min * 60 * 1000;
        return cursor < rFin && cursor + durMs > rIni;
      });

      // Solo slots en el futuro
      const enElFuturo = slotIni.getTime() > Date.now() + 5 * 60 * 1000; // +5 min buffer

      if (!solapado && enElFuturo) {
        slotsDisponibles.push({
          inicio: slotIni.toISOString(),
          fin: slotFin.toISOString(),
        });
      }

      cursor += durMs;
    }
  }

  return NextResponse.json(slotsDisponibles);
}

/** Día de semana (0=domingo) del fecha YYYY-MM-DD en America/Caracas */
function getDayOfWeek(fecha: string): number {
  const date = new Date(`${fecha}T12:00:00`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: APP_TIMEZONE,
  });
  const day = formatter.format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[day] ?? 0;
}
