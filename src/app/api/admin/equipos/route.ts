import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

// GET — lista completa de equipos con perfiles + tareas hoy + strikes
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const admin = createSupabaseAdminClient() as any;

  const hoy = (() => {
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return now.toISOString().split('T')[0];
  })();

  const [teamsRes, profilesRes, tdrRes, strikesRes, cfgRes] = await Promise.all([
    admin.from('setter_teams').select('id, name, setter1_id, setter2_id, activa, created_at').order('created_at'),
    admin.from('profiles').select('id, full_name, email, avatar_url, role'),
    admin.from('tarea_diaria_resultado').select('*').eq('fecha', hoy),
    admin.from('strikes').select('setter_id, id'),
    admin.from('dupla_config').select('*'),
  ]);

  const profiles  = teamsRes.data && (profilesRes.data ?? []);
  const tdrByKey  = new Map<string, any>();
  for (const t of tdrRes.data ?? []) {
    tdrByKey.set(`${t.dupla_id}::${t.setter_id}`, t);
  }

  const strikeCount = new Map<string, number>();
  for (const s of strikesRes.data ?? []) {
    strikeCount.set(s.setter_id, (strikeCount.get(s.setter_id) ?? 0) + 1);
  }

  const cfgMap = new Map<string, any>();
  for (const c of cfgRes.data ?? []) cfgMap.set(c.dupla_id, c);

  const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

  const teams = (teamsRes.data ?? []).map((t: any) => ({
    ...t,
    setter1: profileMap.get(t.setter1_id) ?? null,
    setter2: profileMap.get(t.setter2_id) ?? null,
    config:  cfgMap.get(t.id) ?? null,
    estado_hoy: {
      setter1: tdrByKey.get(`${t.id}::${t.setter1_id}`) ?? null,
      setter2: tdrByKey.get(`${t.id}::${t.setter2_id}`) ?? null,
    },
    strikes_hoy: {
      setter1: strikeCount.get(t.setter1_id) ?? 0,
      setter2: strikeCount.get(t.setter2_id) ?? 0,
    },
  }));

  const setters = (profilesRes.data ?? []).filter((p: any) => p.role === 'setter');

  return NextResponse.json({ teams, setters, fecha: hoy });
}

// POST — crear equipo
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { name, setter1_id, setter2_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from('setter_teams')
    .insert({ name: name.trim(), setter1_id: setter1_id || null, setter2_id: setter2_id || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — editar equipo (nombre, setters, activa, config)
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const body = await req.json();
  const { id, name, setter1_id, setter2_id, activa, config } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const admin = createSupabaseAdminClient() as any;

  const teamUpdate: Record<string, unknown> = {};
  if (name       !== undefined) teamUpdate.name       = name.trim();
  if (setter1_id !== undefined) teamUpdate.setter1_id = setter1_id || null;
  if (setter2_id !== undefined) teamUpdate.setter2_id = setter2_id || null;
  if (activa     !== undefined) teamUpdate.activa     = activa;

  if (Object.keys(teamUpdate).length) {
    const { error } = await admin.from('setter_teams').update(teamUpdate).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (config) {
    await admin.from('dupla_config').upsert(
      {
        dupla_id:        id,
        aperturas_meta:  config.aperturas_meta   ?? 5,
        contactados_meta: config.contactados_meta ?? 5,
        conv_meta:       config.conv_meta         ?? 10,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'dupla_id' }
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE — desactivar equipo (no borrar datos)
export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { id } = await req.json();
  const admin = createSupabaseAdminClient() as any;
  await admin.from('setter_teams').update({ activa: false }).eq('id', id);
  return NextResponse.json({ ok: true });
}
