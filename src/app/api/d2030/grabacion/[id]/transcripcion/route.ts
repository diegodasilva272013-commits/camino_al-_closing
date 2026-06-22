import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: p } = await (admin as any).from('profiles').select('role').eq('id', user.id).single();
  return (p as any)?.role === 'admin' ? admin : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await (admin as any)
    .from('transcripcion')
    .select('texto_completo, segmentos, speakers, modelo_usado')
    .eq('grabacion_id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ segmentos: [], speakers: [] });
  return NextResponse.json(data);
}
