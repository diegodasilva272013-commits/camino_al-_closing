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

/**
 * GET /api/d2030/grabacion/[id]/upload-url
 * Devuelve una URL firmada para que el browser suba el video DIRECTO
 * a Supabase Storage sin pasar por Vercel.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const storagePath = `${params.id}/video.mp4`;

  const { data, error } = await (admin as any)
    .storage
    .from('grabaciones')
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Guardar el path en la base
  await (admin as any).from('grabacion').update({
    storage_path: storagePath,
    estado:       'subiendo',
    updated_at:   new Date().toISOString(),
  }).eq('id', params.id);

  return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, path: storagePath });
}
