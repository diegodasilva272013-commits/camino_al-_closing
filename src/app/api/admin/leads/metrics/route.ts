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

    // Traer todos los leads con su asignación
    const { data: leads } = await admin
      .from('leads')
      .select('current_status, assigned_to_user_id, assigned_at, is_closed')
      .limit(50000);

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

    const STATUS_LIST = [
      'NO_CONTACTADO', 'APERTURA_ENVIADA', 'CONTACTADO', 'RESPONDIO',
      'INTERES_DETECTADO', 'INVITADO_AL_GRUPO', 'INGRESO_AL_GRUPO',
      'ACTIVO_EN_GRUPO', 'DIAGNOSTICO_INICIADO', 'DIAGNOSTICO_PROFUNDO',
      'REUNION_PROPUESTA', 'REUNION_AGENDADA', 'NO_CALIFICA',
      'NO_RESPONDE', 'SEGUIMIENTO_FUTURO',
    ] as const;

    // Obtener solo los IDs de quienes tienen leads asignados (sin filtrar por rol)
    const assignedIds = [...new Set(
      all.map((l) => l.assigned_to_user_id).filter((id): id is string => !!id)
    )];

    // Traer perfiles de esos IDs (en chunks de 500 para no superar límites)
    const profileMap = new Map<string, { id: string; full_name: string | null; email: string | null }>();
    for (let i = 0; i < assignedIds.length; i += 500) {
      const chunk = assignedIds.slice(i, i + 500);
      const { data: chunk_profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', chunk);
      for (const p of chunk_profiles ?? []) {
        profileMap.set(p.id, p);
      }
    }

    // Agrupar múltiples cuentas del mismo setter por nombre (deduplica cuentas dobles)
    const grouped = new Map<string, { id: string; name: string; ids: string[] }>();
    for (const [uid, u] of profileMap) {
      const key = (u.full_name ?? u.email ?? uid).trim().toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, { id: uid, name: u.full_name ?? u.email ?? uid, ids: [uid] });
      } else {
        grouped.get(key)!.ids.push(uid);
      }
    }

    const ranking = Array.from(grouped.values()).map((g) => {
      // Suma leads de TODAS las cuentas del mismo nombre
      const userLeads = all.filter((l) => l.assigned_to_user_id && g.ids.includes(l.assigned_to_user_id));
      const total     = userLeads.length;
      const resp      = userLeads.filter((l) => l.current_status === 'RESPONDIO').length;
      const inter     = userLeads.filter((l) => ['INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA'].includes(l.current_status)).length;
      const mProp     = userLeads.filter((l) => l.current_status === 'REUNION_PROPUESTA').length;
      const mSched    = userLeads.filter((l) => l.current_status === 'REUNION_AGENDADA').length;
      const pending   = userLeads.filter((l) => !l.is_closed).length;

      const byStatus: Record<string, number> = {};
      for (const s of STATUS_LIST) {
        byStatus[s] = userLeads.filter((l) => l.current_status === s).length;
      }

      return {
        id:               g.id,
        name:             g.name,
        total,
        responded:        resp,
        interested:       inter,
        meetingProposed:  mProp,
        meetingScheduled: mSched,
        pending,
        responseRate:     total > 0 ? Math.round((resp / total) * 100) : 0,
        interestRate:     total > 0 ? Math.round((inter / total) * 100) : 0,
        byStatus,
      };
    }).filter((u) => u.total > 0).sort((a, b) => b.total - a.total);

    return NextResponse.json({ global, ranking });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
