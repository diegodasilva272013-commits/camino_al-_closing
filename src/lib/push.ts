/**
 * Helper para enviar Web Push notifications usando web-push (VAPID).
 */
import webpush from 'web-push';
import { env } from './env';
import { createSupabaseAdminClient } from './supabase-server';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!env.push.publicKey || !env.push.privateKey) {
    throw new Error('[push] VAPID keys no configuradas.');
  }
  webpush.setVapidDetails(
    env.push.subject,
    env.push.publicKey,
    env.push.privateKey
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Envía un push a un user (todos sus dispositivos suscriptos).
 * Limpia automáticamente suscripciones inválidas (410/404).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured();
  const admin = createSupabaseAdminClient();

  const { data: subs, error } = await (admin as any)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !subs || subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const toRemove: string[] = [];

  await Promise.all(
    (subs as SubscriptionRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body
        );
        sent++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          toRemove.push(s.id);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[push] error sending', code, err?.body ?? err?.message);
        }
      }
    })
  );

  if (toRemove.length > 0) {
    await (admin as any)
      .from('push_subscriptions')
      .delete()
      .in('id', toRemove);
  }

  // marcar last_used_at
  await (admin as any)
    .from('push_subscriptions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { sent, removed: toRemove.length };
}

/**
 * Envía un push a múltiples usuarios en una sola query de suscripciones.
 */
export async function sendPushToMany(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  ensureConfigured();
  const admin = createSupabaseAdminClient();

  const { data: subs, error } = await (admin as any)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (error || !subs || subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const toRemove: string[] = [];

  await Promise.all(
    (subs as SubscriptionRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) toRemove.push(s.id);
        // eslint-disable-next-line no-console
        else console.warn('[push] error sending', code, err?.body ?? err?.message);
      }
    })
  );

  if (toRemove.length > 0) {
    await (admin as any).from('push_subscriptions').delete().in('id', toRemove);
  }

  return { sent, removed: toRemove.length };
}
