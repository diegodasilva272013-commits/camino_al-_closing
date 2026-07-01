import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

function artToday(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

function artHour(): number {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.getUTCHours(); // UTC hours after subtracting 3h = ART hours
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isCron     = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const a = createSupabaseAdminClient() as any;
    const { data: p } = await a.from('profiles').select('role').eq('id', user.id).single();
    if (p?.role !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient() as any;
  const hoy   = artToday();
  const hora  = artHour();

  const messages: Record<number, string> = {
    19: '⚡ Quedan 4 horas. ¿Arrancaste con las tareas del día?',
    20: '⏰ Quedan 3 horas. Revisá tus aperturas y conversaciones.',
    21: '⚠️ Quedan 2 horas. No dejes las tareas para el final.',
    22: '🚨 Queda 1 hora. Completá las tareas para evitar un strike.',
    23: '🔴 Último aviso. Si no completás las tareas esta noche, recibirás un strike.',
  };

  const body = messages[hora] ?? 'Recordatorio de tareas diarias pendientes.';

  const { data: teams } = await admin
    .from('setter_teams')
    .select('id, setter1_id, setter2_id')
    .eq('activa', true);

  const notified = [];

  for (const team of teams ?? []) {
    for (const setter_id of [team.setter1_id, team.setter2_id].filter(Boolean)) {
      const { data: tdr } = await admin
        .from('tarea_diaria_resultado')
        .select('all_tasks_ok')
        .eq('dupla_id', team.id)
        .eq('setter_id', setter_id)
        .eq('fecha', hoy)
        .maybeSingle();

      if (tdr?.all_tasks_ok) continue; // ya completó — no molestar

      await admin.from('notifications').insert({
        user_id: setter_id,
        type:    'tarea_recordatorio',
        title:   'Tareas diarias pendientes',
        body,
        link:    '/equipo',
      });

      notified.push(setter_id);
    }
  }

  return NextResponse.json({ ok: true, hora, hoy, notified: notified.length });
}
