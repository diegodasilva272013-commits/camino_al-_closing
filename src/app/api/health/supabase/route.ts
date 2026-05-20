import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Comprueba la conexión con Supabase desde el server.
 * GET /api/health/supabase
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('courses').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, stage: 'query', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'init',
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
