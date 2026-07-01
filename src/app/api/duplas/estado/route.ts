import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function artToday(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

function minutesUntilMidnightART(): number {
  const now  = new Date();
  const artMs = now.getTime() - 3 * 60 * 60 * 1000;
  const artNow = new Date(artMs);
  const midnight = new Date(artNow);
  midnight.setUTCHours(24, 0, 0, 0); // next UTC midnight after subtracting 3h = ART midnight
  return Math.max(0, Math.floor((midnight.getTime() - artMs) / 60000));
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const hoy   = artToday();

  // Find this setter's team
  const { data: team } = await admin
    .from('setter_teams')
    .select('id, name, setter1_id, setter2_id, activa')
    .or(`setter1_id.eq.${user.id},setter2_id.eq.${user.id}`)
    .eq('activa', true)
    .maybeSingle();

  if (!team) return NextResponse.json({ team: null, estado: null, config: null, strikes: 0 });

  // Get config (with defaults)
  const { data: cfg } = await admin
    .from('dupla_config')
    .select('aperturas_meta, contactados_meta, conv_meta')
    .eq('dupla_id', team.id)
    .maybeSingle();

  const config = {
    aperturas_meta:   cfg?.aperturas_meta   ?? 5,
    contactados_meta: cfg?.contactados_meta ?? 5,
    conv_meta:        cfg?.conv_meta        ?? 10,
  };

  // Get today's resultado for this setter
  const { data: estado } = await admin
    .from('tarea_diaria_resultado')
    .select('*')
    .eq('dupla_id', team.id)
    .eq('setter_id', user.id)
    .eq('fecha', hoy)
    .maybeSingle();

  // Get today's resultado for the partner
  const partner_id = team.setter1_id === user.id ? team.setter2_id : team.setter1_id;
  const { data: partner_estado } = partner_id
    ? await admin
        .from('tarea_diaria_resultado')
        .select('aperturas_count, contactados_count, conv_count, all_tasks_ok')
        .eq('dupla_id', team.id)
        .eq('setter_id', partner_id)
        .eq('fecha', hoy)
        .maybeSingle()
    : { data: null };

  // Count this setter's strikes
  const { count: strikes } = await admin
    .from('strikes')
    .select('*', { count: 'exact', head: true })
    .eq('setter_id', user.id);

  // Get partner profile
  const { data: partnerProfile } = partner_id
    ? await admin.from('profiles').select('id, full_name, avatar_url').eq('id', partner_id).maybeSingle()
    : { data: null };

  return NextResponse.json({
    team,
    estado:          estado ?? null,
    partner_estado:  partner_estado ?? null,
    partner_profile: partnerProfile ?? null,
    config,
    strikes:         strikes ?? 0,
    fecha:           hoy,
    minutos_restantes: minutesUntilMidnightART(),
  });
}
