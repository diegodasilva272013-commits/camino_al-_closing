import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ logged_in: false, authError: authError?.message ?? null });
  }

  const { data: profileRLS, error: rlsError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const admin = createSupabaseAdminClient();
  const { data: profileAdmin, error: adminError } = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    logged_in: true,
    auth_user_id: user.id,
    auth_email: user.email,
    profile_via_rls_client: profileRLS,
    rls_error: rlsError?.message ?? null,
    profile_via_admin_client: profileAdmin,
    admin_error: adminError?.message ?? null,
  });
}
