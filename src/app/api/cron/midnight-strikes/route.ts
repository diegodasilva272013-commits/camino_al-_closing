import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

function artYesterday(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
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

  const admin  = createSupabaseAdminClient() as any;
  const ayer   = artYesterday();
  const issued = [];
  const blocked = [];

  const { data: teams } = await admin
    .from('setter_teams')
    .select('id, setter1_id, setter2_id')
    .eq('activa', true);

  for (const team of teams ?? []) {
    for (const setter_id of [team.setter1_id, team.setter2_id].filter(Boolean)) {
      // Check if result exists for yesterday
      const { data: tdr } = await admin
        .from('tarea_diaria_resultado')
        .select('all_tasks_ok')
        .eq('dupla_id', team.id)
        .eq('setter_id', setter_id)
        .eq('fecha', ayer)
        .maybeSingle();

      // No record means tasks were never even started → issue strike
      const tasksOk = tdr?.all_tasks_ok === true;

      if (!tasksOk) {
        await admin.from('strikes').insert({
          setter_id,
          reason:   `No completó las tareas diarias del ${ayer}`,
          category: 'rendimiento',
          severity: 1,
          tipo:     'tarea_diaria',
          dupla_id: team.id,
        });
        issued.push({ setter_id, fecha: ayer });

        // Count all active strikes for this setter
        const { count } = await admin
          .from('strikes')
          .select('*', { count: 'exact', head: true })
          .eq('setter_id', setter_id);

        if ((count ?? 0) >= 3) {
          const motivo = `Acumulaste 3 strikes. Hablá con coordinación para desbloquear tu cuenta.`;
          await admin.from('profiles').update({
            bloqueado:        true,
            bloqueado_at:     new Date().toISOString(),
            bloqueado_motivo: motivo,
          }).eq('id', setter_id);

          // Sync bloqueado to auth user_metadata for middleware fast-check
          try {
            await admin.auth.admin.updateUserById(setter_id, {
              user_metadata: { bloqueado: true },
            });
          } catch (e) {
            console.error('[midnight-strikes] updateUserById error:', e);
          }

          blocked.push(setter_id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, fecha: ayer, issued, blocked });
}
