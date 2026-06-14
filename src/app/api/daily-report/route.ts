import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const date = req.nextUrl.searchParams.get('date') ??
      new Date().toISOString().split('T')[0];

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('daily_reports')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? null);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const today = new Date().toISOString().split('T')[0];

    // Get all leads assigned to user
    const { data: leads } = await admin
      .from('leads')
      .select('current_status, follow_up_count, max_follow_ups, is_closed')
      .eq('assigned_to_user_id', user.id);

    const all = leads ?? [];

    const count = (status: string) => all.filter((l) => l.current_status === status).length;

    const totalAssigned          = all.length;
    const totalContacted         = count('CONTACTADO');
    const totalNoContacted       = count('NO_CONTACTADO');
    const totalNoResponse        = count('NO_RESPONDE');
    const totalResponded         = count('RESPONDIO');
    const totalInterested        = count('INTERES_DETECTADO');
    const totalInvitedToGroup    = count('INVITADO_AL_GRUPO');
    const totalEnteredGroup      = count('INGRESO_AL_GRUPO');
    const totalActiveGroup       = count('ACTIVO_EN_GRUPO');
    const totalDiagnosisStarted  = count('DIAGNOSTICO_INICIADO');
    const totalDeepDiagnosis     = count('DIAGNOSTICO_PROFUNDO');
    const totalMeetingProposed   = count('REUNION_PROPUESTA');
    const totalMeetingScheduled  = count('REUNION_AGENDADA');
    const totalNoFit             = count('NO_CALIFICA');
    const totalFutureFollowUp    = count('SEGUIMIENTO_FUTURO');
    const pendingFollowUps       = all.filter((l) => l.follow_up_count < l.max_follow_ups && !l.is_closed).length;
    const completedLeads         = all.filter((l) => l.is_closed).length;

    const productivityScore =
      totalContacted * 1 +
      totalResponded * 2 +
      totalInterested * 3 +
      totalMeetingProposed * 5 +
      totalMeetingScheduled * 8;

    const summary =
      `Hoy trabajaste ${totalAssigned} leads. ` +
      `Contactaste ${totalContacted}. ` +
      `Recibiste ${totalResponded} respuestas. ` +
      `Detectaste ${totalInterested} interesados. ` +
      `Propusiste ${totalMeetingProposed} reuniones y agendaste ${totalMeetingScheduled}. ` +
      `Tenés ${pendingFollowUps} seguimientos pendientes. ` +
      `Score de productividad: ${productivityScore} pts.`;

    const { data, error } = await admin
      .from('daily_reports')
      .upsert(
        {
          user_id: user.id,
          date: today,
          total_assigned:           totalAssigned,
          total_contacted:          totalContacted,
          total_no_contacted:       totalNoContacted,
          total_no_response:        totalNoResponse,
          total_responded:          totalResponded,
          total_interested:         totalInterested,
          total_invited_to_group:   totalInvitedToGroup,
          total_entered_group:      totalEnteredGroup,
          total_active_group:       totalActiveGroup,
          total_diagnosis_started:  totalDiagnosisStarted,
          total_deep_diagnosis:     totalDeepDiagnosis,
          total_meeting_proposed:   totalMeetingProposed,
          total_meeting_scheduled:  totalMeetingScheduled,
          total_no_fit:             totalNoFit,
          total_future_follow_up:   totalFutureFollowUp,
          pending_follow_ups:       pendingFollowUps,
          completed_leads:          completedLeads,
          productivity_score:       productivityScore,
          summary,
        },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
