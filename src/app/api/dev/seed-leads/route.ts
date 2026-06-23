import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const FAKE_LEADS = [
  { first_name: 'Valentina', last_name: 'Rodríguez', phone: '+54 9 11 2345-6789', email: 'valen.rodriguez@gmail.com', current_status: 'NO_CONTACTADO',        follow_up_count: 0, max_follow_ups: 5, notes: null,                                    last_action_at: null },
  { first_name: 'Martín',    last_name: 'López',      phone: '+54 9 11 3456-7890', email: 'martin.lopez@hotmail.com',   current_status: 'APERTURA_ENVIADA',      follow_up_count: 1, max_follow_ups: 5, notes: 'Vio el webinar de julio',                last_action_at: daysAgo(1) },
  { first_name: 'Carolina',  last_name: 'Fernández',  phone: '+54 9 351 4567-890', email: null,                          current_status: 'CONTACTADO',            follow_up_count: 2, max_follow_ups: 5, notes: 'Le interesa pero dice que no tiene tiempo', last_action_at: daysAgo(2) },
  { first_name: 'Sebastián', last_name: 'García',     phone: '+54 9 11 5678-9012', email: 'seba.garcia@icloud.com',     current_status: 'NO_RESPONDE',           follow_up_count: 3, max_follow_ups: 5, notes: 'Ya mandé 3 mensajes sin respuesta',       last_action_at: daysAgo(5) },
  { first_name: 'Luciana',   last_name: 'Martínez',   phone: '+54 9 261 6789-012', email: 'lu.martinez@gmail.com',      current_status: 'RESPONDIO',             follow_up_count: 2, max_follow_ups: 5, notes: 'Respondió rápido, quiere saber más',      last_action_at: daysAgo(1) },
  { first_name: 'Gonzalo',   last_name: 'Pérez',      phone: '+54 9 11 7890-1234', email: null,                          current_status: 'INTERES_DETECTADO',     follow_up_count: 3, max_follow_ups: 5, notes: 'Tiene negocio propio, quiere escalar',    last_action_at: daysAgo(0) },
  { first_name: 'Florencia', last_name: 'Sánchez',    phone: '+54 9 11 8901-2345', email: 'flor.sanchez@outlook.com',   current_status: 'INVITADO_AL_GRUPO',     follow_up_count: 2, max_follow_ups: 5, notes: 'Aceptó la invitación al grupo de WA',     last_action_at: daysAgo(3) },
  { first_name: 'Nicolás',   last_name: 'Torres',     phone: '+54 9 341 9012-345', email: 'nico.torres@gmail.com',      current_status: 'INGRESO_AL_GRUPO',      follow_up_count: 3, max_follow_ups: 5, notes: null,                                    last_action_at: daysAgo(2) },
  { first_name: 'Agustina',  last_name: 'Morales',    phone: '+54 9 11 0123-456',  email: null,                          current_status: 'ACTIVO_EN_GRUPO',       follow_up_count: 4, max_follow_ups: 5, notes: 'Participa activo, hace preguntas',       last_action_at: daysAgo(1) },
  { first_name: 'Diego',     last_name: 'Herrera',    phone: '+54 9 11 1234-5670', email: 'diegoherrera@gmail.com',     current_status: 'DIAGNOSTICO_INICIADO',  follow_up_count: 4, max_follow_ups: 5, notes: 'Tiene empresa de 8 personas, factura 2M', last_action_at: daysAgo(0) },
  { first_name: 'Sofía',     last_name: 'Ramírez',    phone: '+54 9 221 2345-678', email: 'sofia.ramirez@icloud.com',   current_status: 'DIAGNOSTICO_PROFUNDO',  follow_up_count: 4, max_follow_ups: 5, notes: 'Diagnóstico muy bien, califica perfecto',  last_action_at: daysAgo(0) },
  { first_name: 'Matías',    last_name: 'Díaz',       phone: '+54 9 11 3456-7891', email: null,                          current_status: 'REUNION_PROPUESTA',     follow_up_count: 5, max_follow_ups: 5, notes: 'Le propuse reunión para el miércoles',   last_action_at: daysAgo(1) },
  { first_name: 'Camila',    last_name: 'González',   phone: '+54 9 11 4567-8901', email: 'cami.gonza@gmail.com',       current_status: 'REUNION_AGENDADA',      follow_up_count: 5, max_follow_ups: 5, notes: 'Reunión confirmada el jueves 10hs',      last_action_at: daysAgo(0) },
  { first_name: 'Rodrigo',   last_name: 'Vargas',     phone: '+54 9 11 5678-9013', email: 'r.vargas@outlook.com',       current_status: 'SEGUIMIENTO_FUTURO',    follow_up_count: 3, max_follow_ups: 5, notes: 'Vuelve en agosto, viaje de trabajo',     last_action_at: daysAgo(10) },
  { first_name: 'Paula',     last_name: 'Castro',     phone: '+54 9 11 6789-0124', email: null,                          current_status: 'NO_CALIFICA',           follow_up_count: 2, max_follow_ups: 5, notes: 'No tiene empresa propia, solo empleada',  last_action_at: daysAgo(7),   is_closed: true, closed_reason: 'No califica' },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const rows = FAKE_LEADS.map(l => ({
    first_name:           l.first_name,
    last_name:            l.last_name,
    phone:                l.phone,
    email:                l.email ?? null,
    current_status:       l.current_status,
    follow_up_count:      l.follow_up_count,
    max_follow_ups:       l.max_follow_ups,
    notes:                l.notes ?? null,
    last_action_at:       l.last_action_at ?? null,
    updated_at:           l.last_action_at ?? new Date().toISOString(),
    is_closed:            (l as any).is_closed ?? false,
    closed_reason:        (l as any).closed_reason ?? null,
    assigned_to_user_id:  user.id,
  }));

  const { data, error } = await admin.from('leads').insert(rows).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: data?.length ?? 0, message: 'Leads ficticios creados OK' });
}

// DELETE — borra los ficticios de este user (los que tienen phone que empieza con +54 9 XX XXXX)
export async function DELETE() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const phones = FAKE_LEADS.map(l => l.phone);
  const { error } = await admin
    .from('leads')
    .delete()
    .eq('assigned_to_user_id', user.id)
    .in('phone', phones);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Leads ficticios eliminados' });
}
