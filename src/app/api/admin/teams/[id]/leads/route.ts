import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  // Verificar que el equipo existe
  const { data: team } = await admin.from('setter_teams').select('id').eq('id', params.id).single();
  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

  // Body: { leads: [{ first_name, last_name, phone, email?, country? }] }
  const { leads } = await req.json();
  if (!Array.isArray(leads) || leads.length === 0) return NextResponse.json({ error: 'Sin leads' }, { status: 400 });

  const rows = leads
    .filter((l: any) => l.first_name?.trim() && l.phone?.trim())
    .map((l: any) => ({
      team_id:    params.id,
      first_name: l.first_name.trim(),
      last_name:  l.last_name?.trim() || null,
      phone:      l.phone.trim(),
      email:      l.email?.trim() || null,
      country:    l.country?.trim() || null,
    }));

  if (!rows.length) return NextResponse.json({ error: 'Ningún lead válido (requieren nombre y teléfono)' }, { status: 400 });

  const { data, error } = await admin.from('team_leads').insert(rows).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: data?.length ?? 0 });
}
