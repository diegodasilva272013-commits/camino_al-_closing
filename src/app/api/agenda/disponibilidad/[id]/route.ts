import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// PATCH /api/agenda/disponibilidad/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: row } = await admin
    .from('closer_availability')
    .select('closer_id')
    .eq('id', params.id)
    .single();

  if (!row) return NextResponse.json({ error: 'Franja no encontrada' }, { status: 404 });
  if (row.closer_id !== user.id) {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.dia_semana !== undefined) updates.dia_semana = body.dia_semana;
  if (body.hora_inicio !== undefined) updates.hora_inicio = body.hora_inicio;
  if (body.hora_fin !== undefined) updates.hora_fin = body.hora_fin;
  if (body.activa !== undefined) updates.activa = body.activa;

  const { data, error } = await admin
    .from('closer_availability')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/agenda/disponibilidad/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: row } = await admin
    .from('closer_availability')
    .select('closer_id')
    .eq('id', params.id)
    .single();

  if (!row) return NextResponse.json({ error: 'Franja no encontrada' }, { status: 404 });
  if (row.closer_id !== user.id) {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { error } = await admin.from('closer_availability').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
