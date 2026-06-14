import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00.000Z`;

    const [{ data: leads }, { data: users }] = await Promise.all([
      admin.from('leads').select('current_status, assigned_to_user_id, assigned_at, is_closed'),
      admin.from('profiles').select('id, full_name, email').neq('role', 'admin'),
    ]);

    const all = leads ?? [];
    const count = (status: string) => all.filter((l) => l.current_status === status).length;

    const global = {
      total:             all.length,
      assignedToday:     all.filter((l) => l.assigned_at && l.assigned_at >= todayStart).length,
      contacted:         count('CONTACTADO'),
      responded:         count('RESPONDIO'),
      interested:        count('INTERES_DETECTADO'),
      invitedToGroup:    count('INVITADO_AL_GRUPO'),
      enteredGroup:      count('INGRESO_AL_GRUPO'),
      diagnosisStarted:  count('DIAGNOSTICO_INICIADO'),
      meetingProposed:   count('REUNION_PROPUESTA'),
      meetingScheduled:  count('REUNION_AGENDADA'),
      noFit:             count('NO_CALIFICA'),
      futureFollowUp:    count('SEGUIMIENTO_FUTURO'),
    };

    const ranking = (users ?? []).map((u) => {
      const userLeads = all.filter((l) => l.assigned_to_user_id === u.id);
      const total     = userLeads.length;
      const resp      = userLeads.filter((l) => l.current_status === 'RESPONDIO').length;
      const inter     = userLeads.filter((l) => l.current_status === 'INTERES_DETECTADO').length;
      const mProp     = userLeads.filter((l) => l.current_status === 'REUNION_PROPUESTA').length;
      const mSched    = userLeads.filter((l) => l.current_status === 'REUNION_AGENDADA').length;
      const pending   = userLeads.filter((l) => !l.is_closed).length;
      return {
        id:               u.id,
        name:             u.full_name ?? u.email,
        total,
        responded:        resp,
        interested:       inter,
        meetingProposed:  mProp,
        meetingScheduled: mSched,
        pending,
        responseRate:     total > 0 ? Math.round((resp / total) * 100) : 0,
        interestRate:     total > 0 ? Math.round((inter / total) * 100) : 0,
      };
    }).sort((a, b) => b.meetingScheduled - a.meetingScheduled);

    return NextResponse.json({ global, ranking });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
