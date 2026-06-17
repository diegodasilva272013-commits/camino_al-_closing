import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await (createSupabaseAdminClient() as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const body = await req.json();
  const { nombre, email, fecha_ingreso, rol_actual } = body;

  if (!nombre || !email || !fecha_ingreso)
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;

  // Verificar que no exista ya
  const { data: existing } = await admin
    .from('personas')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing)
    return NextResponse.json({ error: 'Ya existe' }, { status: 409 });

  const { error } = await admin
    .from('personas')
    .insert({ nombre, email, fecha_ingreso, rol_actual });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
