import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { getEvolutionInstance, evolutionGetQR } from '@/lib/evolution';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const instance = await getEvolutionInstance(params.id);
  if (!instance) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  try {
    const qr = await evolutionGetQR(instance);
    return NextResponse.json(qr);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error al obtener QR' }, { status: 500 });
  }
}
