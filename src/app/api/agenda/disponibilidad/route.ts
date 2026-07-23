import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/agenda/disponibilidad — franjas del closer autenticado
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'closer' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo closers pueden ver su disponibilidad' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('closer_availability')
    .select('*')
    .eq('closer_id', user.id)
    .order('dia_semana')
    .order('hora_inicio');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/agenda/disponibilidad — crear franja
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'closer' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo closers pueden configurar disponibilidad' }, { status: 403 });
  }

  const body = await req.json();
  const { dia_semana, hora_inicio, hora_fin, activa } = body;

  if (dia_semana === undefined || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: 'dia_semana, hora_inicio y hora_fin son obligatorios' }, { status: 400 });
  }
  if (hora_fin <= hora_inicio) {
    return NextResponse.json({ error: 'hora_fin debe ser posterior a hora_inicio' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('closer_availability')
    .insert({
      closer_id: user.id,
      dia_semana,
      hora_inicio,
      hora_fin,
      activa: activa ?? true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una franja para ese día y hora_inicio' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
