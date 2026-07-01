import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  const { data: team } = await admin
    .from('setter_teams')
    .select('id, name, setter1_id, setter2_id')
    .or(`setter1_id.eq.${user.id},setter2_id.eq.${user.id}`)
    .single();
  if (!team) return NextResponse.json({ error: 'Sin equipo' }, { status: 404 });

  const memberIds = [team.setter1_id, team.setter2_id].filter(Boolean) as string[];

  const [leadsRes, profilesRes, conversRes] = await Promise.all([
    admin.from('team_leads').select('id, current_status, handled_by, created_at').eq('team_id', team.id),
    admin.from('profiles').select('id, full_name, avatar_url, points').in('id', memberIds),
    admin.from('team_conversation_analyses')
      .select('id, submitted_by, status, created_at')
      .eq('team_id', team.id),
  ]);

  const leads: any[]   = leadsRes.data   ?? [];
  const profiles: any[] = profilesRes.data ?? [];
  const convs: any[]   = conversRes.data  ?? [];

  // Métricas por miembro
  const memberStats = profiles.map(p => {
    const myLeads = leads.filter(l => l.handled_by === p.id);
    const byStatus: Record<string, number> = {};
    for (const l of myLeads) byStatus[l.current_status] = (byStatus[l.current_status] ?? 0) + 1;

    const contactados = myLeads.filter(l => !['NO_CONTACTADO'].includes(l.current_status)).length;
    const respondieron = myLeads.filter(l =>
      ['RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO',
       'DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)
    ).length;
    const reuniones = myLeads.filter(l => l.current_status === 'REUNION_AGENDADA').length;

    return {
      id:          p.id,
      full_name:   p.full_name,
      avatar_url:  p.avatar_url,
      points:      p.points ?? 0,
      leads_total: myLeads.length,
      contactados,
      respondieron,
      reuniones,
      tasa_respuesta: contactados > 0 ? Math.round((respondieron / contactados) * 100) : 0,
      by_status:   byStatus,
    };
  });

  // Métricas globales del equipo
  const totalByStatus: Record<string, number> = {};
  for (const l of leads) totalByStatus[l.current_status] = (totalByStatus[l.current_status] ?? 0) + 1;

  const sinTomar = leads.filter(l => !l.handled_by).length;

  return NextResponse.json({
    team_id:     team.id,
    total_leads: leads.length,
    sin_tomar:   sinTomar,
    by_status:   totalByStatus,
    conversaciones_analizadas: convs.filter(c => c.status === 'ready').length,
    members:     memberStats,
  });
}
