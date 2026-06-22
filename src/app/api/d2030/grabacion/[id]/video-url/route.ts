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

/** GET /api/d2030/grabacion/[id]/video-url — URL firmada para reproducir el video */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: grabacion } = await (admin as any)
    .from('grabacion')
    .select('storage_path')
    .eq('id', params.id)
    .single();

  if (!grabacion?.storage_path) return NextResponse.json({ url: null });

  const { data, error } = await (admin as any)
    .storage
    .from('grabaciones')
    .createSignedUrl(grabacion.storage_path, 3600); // 1 hora

  if (error) return NextResponse.json({ url: null });
  return NextResponse.json({ url: data.signedUrl });
}
