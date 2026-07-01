import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const profile = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile.data as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admins pueden subir archivos' }, { status: 403 });
  }

  const { filename } = await req.json() as { filename: string };
  if (!filename) return NextResponse.json({ error: 'filename requerido' }, { status: 400 });

  const ext  = (filename.split('.').pop() ?? 'bin').toLowerCase();
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const admin = createSupabaseAdminClient();
  const { data, error } = await (admin as any).storage.from('resources').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error creando URL' }, { status: 500 });

  const { data: pub } = (admin as any).storage.from('resources').getPublicUrl(path);

  return NextResponse.json({
    signedUrl:  data.signedUrl as string,
    token:      data.token     as string,
    path,
    publicUrl:  pub.publicUrl  as string,
  });
}
