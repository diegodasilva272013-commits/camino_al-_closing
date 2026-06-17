import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST → elimina filas duplicadas por teléfono, conserva la más antigua por setter
export async function POST() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // Traer todos los leads con teléfono
    const { data: all } = await admin
      .from('leads')
      .select('id, phone, assigned_to_user_id, created_at')
      .order('created_at', { ascending: true })
      .limit(50000);

    // Agrupar por teléfono → conservar el primero (más antiguo), borrar el resto
    const seen = new Map<string, string>(); // phone → id a conservar
    const toDelete: string[] = [];

    for (const lead of all ?? []) {
      if (!lead.phone) continue;
      if (seen.has(lead.phone)) {
        toDelete.push(lead.id);
      } else {
        seen.set(lead.phone, lead.id);
      }
    }

    if (!toDelete.length) {
      return NextResponse.json({ deleted: 0, message: 'No hay duplicados.' });
    }

    // Borrar en chunks
    const CHUNK = 200;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const chunk = toDelete.slice(i, i + CHUNK);
      const { error } = await admin.from('leads').delete().in('id', chunk);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deleted += chunk.length;
    }

    return NextResponse.json({ deleted, message: `${deleted} leads duplicados eliminados.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
