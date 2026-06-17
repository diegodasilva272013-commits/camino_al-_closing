import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { getLevel } from '@/lib/levels';

export const dynamic = 'force-dynamic';

const LEVEL_MIN = [0, 50, 150, 350, 700, 1200, 2000, 3500, 5500, 8000];

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('points, ai_avatar_credits')
    .eq('id', user.id)
    .single();

  const points  = (profile as any)?.points ?? 0;
  const credits = (profile as any)?.ai_avatar_credits ?? 0;
  const userLevel = getLevel(points).level;

  const adminAny = admin as any;
  const [{ data: layers }, { data: applied }] = await Promise.all([
    adminAny.from('avatar_layers').select('*').eq('is_active', true).order('sort_order'),
    adminAny.from('user_avatar_layers').select('layer_id, unlocked_at').eq('user_id', user.id),
  ]);

  const appliedSet = new Set((applied ?? []).map((a: any) => Number(a.layer_id)));
  const appliedMap = new Map((applied ?? []).map((a: any) => [Number(a.layer_id), a.unlocked_at]));

  const result = (layers ?? []).map((layer: any) => {
    if (appliedSet.has(layer.id)) {
      return { ...layer, status: 'applied', can_apply: false, unlocked_at: appliedMap.get(layer.id) };
    }
    if (userLevel < layer.required_level) {
      const threshold = LEVEL_MIN[layer.required_level - 1] ?? 99999;
      return {
        ...layer,
        status: 'locked_level',
        can_apply: false,
        points_to_unlock: Math.max(0, threshold - points),
      };
    }
    if (credits < layer.credit_cost) {
      return { ...layer, status: 'no_credits', can_apply: false };
    }
    return { ...layer, status: 'available', can_apply: true };
  });

  return NextResponse.json({ layers: result, credits, userLevel });
}
