import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { sendPushToUser } from '@/lib/push';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint que Supabase Database Webhook llama cuando se inserta
 * una fila en public.notifications.
 *
 * Auth: header "x-webhook-secret" debe matchear PUSH_WEBHOOK_SECRET.
 *
 * Payload (Supabase webhook):
 * {
 *   type: 'INSERT',
 *   table: 'notifications',
 *   record: { id, user_id, type, title, body, link, ... },
 *   ...
 * }
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-webhook-secret') ?? '';
  if (!env.push.webhookSecret || secret !== env.push.webhookSecret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const record = payload?.record;
  if (!record?.user_id) {
    return NextResponse.json({ ok: true, skipped: 'no record' });
  }

  // Evitar reenvíos: si ya tiene pushed_at, salir
  if (record.pushed_at) {
    return NextResponse.json({ ok: true, skipped: 'already pushed' });
  }

  const title = String(record.title ?? 'Camino al Closing');
  const body = record.body ? String(record.body) : undefined;
  const url = record.link ? String(record.link) : '/dashboard';
  const tag = String(record.type ?? 'system');

  try {
    const res = await sendPushToUser(record.user_id, {
      title,
      body,
      url,
      tag,
    });

    // Marcar pushed_at
    const admin = createSupabaseAdminClient();
    await (admin as any)
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .eq('id', record.id);

    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'send failed' },
      { status: 500 }
    );
  }
}
