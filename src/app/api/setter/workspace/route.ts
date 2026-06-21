import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getSetterWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[workspace] auth error:', authError.message);
      return NextResponse.json({ error: 'Error de autenticación', detail: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const workspace = await getSetterWorkspace(user.id);
    return NextResponse.json(workspace);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[workspace] unexpected error:', msg);
    return NextResponse.json({ error: 'Error interno', detail: msg }, { status: 500 });
  }
}
