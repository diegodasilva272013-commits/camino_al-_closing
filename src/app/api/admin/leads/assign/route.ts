import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { target_user_id, lead_ids, quantity } = await req.json() as {
      target_user_id: string;
      lead_ids?: string[];
      quantity?: number;
    };

    if (!target_user_id) return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });

    // Check pending leads warning
    const { count: pending } = await admin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to_user_id', target_user_id)
      .eq('is_closed', false);

    let ids = lead_ids ?? [];

    if (!ids.length && quantity) {
      const { data: unassigned } = await admin
        .from('leads')
        .select('id')
        .is('assigned_to_user_id', null)
        .order('created_at', { ascending: true })
        .limit(quantity);
      ids = (unassigned ?? []).map((l) => l.id);
    }

    if (!ids.length) {
      return NextResponse.json({ error: 'Sin leads para asignar' }, { status: 400 });
    }

    const { error } = await admin
      .from('leads')
      .update({
        assigned_to_user_id: target_user_id,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      assigned: ids.length,
      pending_warning: (pending ?? 0) > 0
        ? `Este usuario tiene ${pending} leads pendientes sin gestionar.`
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
