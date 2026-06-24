import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

// GET evidencia individual con análisis completo
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await (admin as any)
    .from('founder_evidences')
    .select(`
      *,
      founder_analyses(*)
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE evidencia — DESACTIVADO (F5-A: sistema 0025/0026 en modo lectura)
// La data histórica se conserva intacta. No se borra nada del sistema legacy.
export async function DELETE() {
  return NextResponse.json(
    { error: 'Sistema legacy desactivado. Las evidencias históricas no se eliminan.' },
    { status: 410 }
  );
}
