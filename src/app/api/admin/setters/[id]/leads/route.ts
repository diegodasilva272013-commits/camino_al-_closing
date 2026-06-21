import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = params;

  // Perfil del setter
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', id)
    .single() as { data: any };

  // Leads completos del setter
  const { data: leads, error } = await admin
    .from('leads')
    .select('first_name, last_name, phone, email, current_status, is_closed, follow_up_count, assigned_at, updated_at, created_at, notes')
    .eq('assigned_to_user_id', id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (leads ?? []).map((l: any, i: number) => ({
    '#':                  i + 1,
    'Nombre':             `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim(),
    'Teléfono':           l.phone ?? '',
    'Email':              l.email ?? '',
    'Estado':             STATUS_LABEL[l.current_status] ?? l.current_status ?? '',
    'Cerrado':            l.is_closed ? 'Sí' : 'No',
    'Follow-ups':         l.follow_up_count ?? 0,
    'Notas':              l.notes ?? '',
    'Asignado':           l.assigned_at ? new Date(l.assigned_at).toLocaleDateString('es-AR') : '',
    'Última actividad':   l.updated_at  ? new Date(l.updated_at).toLocaleDateString('es-AR')  : '',
    'Creado':             l.created_at  ? new Date(l.created_at).toLocaleDateString('es-AR')   : '',
  }));

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.json_to_sheet(rows);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 4 }, { wch: 28 }, { wch: 16 }, { wch: 28 },
    { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 40 },
    { wch: 14 }, { wch: 18 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Leads');

  const buf  = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const name = (profile?.full_name ?? 'setter').replace(/\s+/g, '_').toLowerCase();
  const date = new Date().toISOString().split('T')[0];

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads_${name}_${date}.xlsx"`,
    },
  });
}
