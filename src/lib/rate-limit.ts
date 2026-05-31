/**
 * Rate limiting in-memory simple (best effort, por instancia).
 * Para multi-instancia se reemplaza por Upstash Redis en el futuro.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

/**
 * Devuelve `true` si la petición está permitida.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = store.get(key);
  if (!cur || cur.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count++;
  return true;
}

/**
 * Helper para usar en server actions con userId.
 */
export function checkRateLimit(
  scope: string,
  userId: string | null | undefined,
  limit: number,
  windowMs: number
): { ok: boolean; error?: string } {
  if (!userId) return { ok: true };
  const key = `${scope}:${userId}`;
  const ok = rateLimit(key, limit, windowMs);
  if (!ok) {
    return {
      ok: false,
      error: 'Estás haciendo esto demasiado rápido. Esperá unos segundos.',
    };
  }
  return { ok: true };
}
