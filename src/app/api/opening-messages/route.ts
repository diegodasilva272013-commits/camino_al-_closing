import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('opening_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();

    const { count } = await admin
      .from('opening_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Máximo 5 aperturas activas permitidas' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, message, is_active } = body;
    if (!name || !message) {
      return NextResponse.json({ error: 'Nombre y mensaje son requeridos' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('opening_messages')
      .insert({ user_id: user.id, name, message, is_active: is_active ?? true })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
