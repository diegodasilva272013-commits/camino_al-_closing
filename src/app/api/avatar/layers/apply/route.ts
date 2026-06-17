import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { getLevel } from '@/lib/levels';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const layer_id = Number(body?.layer_id);
  const style    = body?.style ?? null;
  if (!layer_id) return NextResponse.json({ success: false, error: 'INVALID_REQUEST' }, { status: 400 });

  const admin = createSupabaseAdminClient();

  const adminAny = admin as any;
  const [{ data: profile }, { data: layer }, { data: existing }] = await Promise.all([
    admin.from('profiles').select('points, ai_avatar_credits, ai_avatar_url').eq('id', user.id).single(),
    adminAny.from('avatar_layers').select('*').eq('id', layer_id).eq('is_active', true).maybeSingle(),
    adminAny.from('user_avatar_layers').select('id').eq('user_id', user.id).eq('layer_id', layer_id).maybeSingle(),
  ]);

  if (!layer) return NextResponse.json({ success: false, error: 'LAYER_NOT_FOUND' }, { status: 404 });
  if (existing) return NextResponse.json({ success: false, error: 'LAYER_ALREADY_APPLIED' });

  const points    = (profile as any)?.points ?? 0;
  const credits   = (profile as any)?.ai_avatar_credits ?? 0;
  const userLevel = getLevel(points).level;

  if (credits < (layer as any).credit_cost) {
    return NextResponse.json({ success: false, error: 'INSUFFICIENT_CREDITS' });
  }
  if (userLevel < (layer as any).required_level) {
    return NextResponse.json({ success: false, error: 'LEVEL_TOO_LOW' });
  }

  const { error: rpcError } = await (admin as any).rpc('consume_ai_avatar_credit', { p_user: user.id });
  if (rpcError) return NextResponse.json({ success: false, error: 'CREDIT_ERROR' }, { status: 500 });

  await adminAny.from('user_avatar_layers').insert({
    user_id:          user.id,
    layer_id,
    avatar_style:     style,
    result_image_url: (profile as any)?.ai_avatar_url ?? null,
  });

  const new_balance   = credits - (layer as any).credit_cost;
  const new_avatar_url = (profile as any)?.ai_avatar_url ?? null;

  return NextResponse.json({
    success: true,
    new_balance,
    layer_applied: { id: (layer as any).id, name: (layer as any).name },
    new_avatar_url,
  });
}
