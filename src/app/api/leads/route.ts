import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();

    // PostgREST limita a 1000 filas por default, ignorando .limit() mayores.
    // Paginamos con .range() para traer TODOS los leads del setter, sin importar cuántos sean.
    let allLeads: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await admin
        .from('leads')
        .select('*')
        .eq('assigned_to_user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data?.length) break;
      allLeads.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    return NextResponse.json(allLeads);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
