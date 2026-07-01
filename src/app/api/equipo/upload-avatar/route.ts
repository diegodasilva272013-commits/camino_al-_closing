import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  // Obtener equipo del setter
  const { data: team } = await admin
    .from('setter_teams')
    .select('id')
    .or(`setter1_id.eq.${user.id},setter2_id.eq.${user.id}`)
    .single();
  if (!team) return NextResponse.json({ error: 'No estás en ningún equipo' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Formato no soportado (JPG, PNG, WEBP, GIF)' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Máximo 5 MB' }, { status: 400 });

  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${team.id}/logo-${Date.now()}.${ext}`;
  const buf  = await file.arrayBuffer();

  const { error: upErr } = await admin.storage
    .from('team-avatars')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from('team-avatars').getPublicUrl(path);

  // Guardar en setter_teams
  await admin.from('setter_teams').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', team.id);

  return NextResponse.json({ avatar_url: publicUrl });
}
