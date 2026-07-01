import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

function artToday(): string {
  // Argentina = UTC-3 fija (sin DST)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
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

  const admin    = createSupabaseAdminClient() as any;
  const hoy      = artToday();
  const updated  = [];

  const { data: teams } = await admin
    .from('setter_teams')
    .select('id, setter1_id, setter2_id')
    .eq('activa', true);

  for (const team of teams ?? []) {
    const { data: cfg } = await admin
      .from('dupla_config')
      .select('aperturas_meta, contactados_meta, conv_meta')
      .eq('dupla_id', team.id)
      .maybeSingle();

    const meta = {
      aperturas_meta:   cfg?.aperturas_meta   ?? 5,
      contactados_meta: cfg?.contactados_meta ?? 5,
      conv_meta:        cfg?.conv_meta        ?? 10,
    };

    for (const setter_id of [team.setter1_id, team.setter2_id].filter(Boolean)) {
      const { data: counts } = await admin
        .rpc('get_setter_tarea_counts', { p_setter_id: setter_id, p_fecha: hoy })
        .single();

      const ap  = counts?.aperturas_count   ?? 0;
      const co  = counts?.contactados_count ?? 0;
      const cv  = counts?.conv_count        ?? 0;

      const task_aperturas_ok   = ap >= meta.aperturas_meta;
      const task_contactados_ok = co >= meta.contactados_meta;
      const task_conv_ok        = cv >= meta.conv_meta;
      const all_tasks_ok        = task_aperturas_ok && task_contactados_ok && task_conv_ok;

      await admin.from('tarea_diaria_resultado').upsert(
        {
          dupla_id: team.id, setter_id, fecha: hoy,
          aperturas_count: ap, contactados_count: co, conv_count: cv,
          task_aperturas_ok, task_contactados_ok, task_conv_ok, all_tasks_ok,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'dupla_id,setter_id,fecha' }
      );

      updated.push({ team_id: team.id, setter_id, ap, co, cv, all_tasks_ok });
    }
  }

  return NextResponse.json({ ok: true, fecha: hoy, updated });
}
