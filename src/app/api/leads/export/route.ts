import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  NO_CONTACTADO:        'Sin contactar',
  APERTURA_ENVIADA:     'Apertura enviada',
  CONTACTADO:           'Contactado',
  RESPONDIO:            'Respondió',
  NO_RESPONDE:          'No responde',
  INTERES_DETECTADO:    'Interesado',
  INVITADO_AL_GRUPO:    'Invitado al grupo',
  INGRESO_AL_GRUPO:     'Ingresó al grupo',
  ACTIVO_EN_GRUPO:      'Activo en grupo',
  DIAGNOSTICO_INICIADO: 'Diagnóstico iniciado',
  DIAGNOSTICO_PROFUNDO: 'Diagnóstico profundo',
  REUNION_PROPUESTA:    'Reunión propuesta',
  REUNION_AGENDADA:     'Reunión agendada',
  NO_CALIFICA:          'No califica',
  SEGUIMIENTO_FUTURO:   'Seguimiento futuro',
};

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Traer TODOS los leads del setter con paginación
  let allLeads: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await admin
      .from('leads')
      .select('first_name, last_name, phone, email, country, current_status, is_closed, follow_up_count, notes, next_follow_up_at, updated_at, assigned_at')
      .eq('assigned_to_user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    allLeads.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const rows = allLeads.map((l: any, i: number) => ({
    '#':                  i + 1,
    'Nombre':             `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim(),
    'Teléfono':           l.phone ?? '',
    'Email':              l.email ?? '',
    'País':               l.country ?? '',
    'Estado':             STATUS_LABEL[l.current_status] ?? l.current_status ?? '',
    'Cerrado':            l.is_closed ? 'Sí' : 'No',
    'Follow-ups':         l.follow_up_count ?? 0,
    'Próx. seguimiento':  l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleDateString('es-AR') : '',
    'Notas':              l.notes ?? '',
    'Última actividad':   l.updated_at ? new Date(l.updated_at).toLocaleDateString('es-AR') : '',
    'Asignado':           l.assigned_at ? new Date(l.assigned_at).toLocaleDateString('es-AR') : '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 4 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 10 },
    { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 40 },
    { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Mis Leads');

  const buf  = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const date = new Date().toISOString().split('T')[0];

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="mis_leads_${date}.xlsx"`,
    },
  });
}
