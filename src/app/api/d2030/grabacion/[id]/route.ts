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

/** GET /api/d2030/grabacion/[id] — polleado cada 3s por el browser */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await (admin as any)
    .from('grabacion')
    .select('id, titulo, tipo, fecha, estado, error_detalle, evidencia_id, video_url, duracion_segundos, archivo_comprimido_tamano')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  return NextResponse.json(data);
}

/** PATCH /api/d2030/grabacion/[id] — actualiza campos (tamano comprimido, estado) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const allowed = ['estado', 'archivo_comprimido_tamano', 'duracion_segundos', 'error_detalle', 'video_url', 'storage_path'];
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of allowed) { if (k in body) updates[k] = body[k]; }

  const { error } = await (admin as any).from('grabacion').update(updates).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
