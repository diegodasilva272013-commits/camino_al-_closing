import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient() as any;

  const [teamRes, personalRes, profilesRes] = await Promise.all([
    admin.from('team_wins')
      .select('id, title, description, image_url, posted_by, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('personal_wins')
      .select('id, user_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('profiles')
      .select('id, full_name, avatar_url, role'),
  ]);

  return NextResponse.json({
    teamWins:    teamRes.data    ?? [],
    personalWins: personalRes.data ?? [],
    profiles:    profilesRes.data ?? [],
  });
}

// POST — win personal (cualquier usuario)
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from('personal_wins')
    .insert({ user_id: user.id, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — borrar win personal propio
export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await req.json();
  const admin = createSupabaseAdminClient() as any;

  const { data: win } = await admin.from('personal_wins').select('user_id').eq('id', id).single();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();

  if (win?.user_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  await admin.from('personal_wins').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
