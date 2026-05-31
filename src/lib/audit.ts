import { createSupabaseServerClient } from './supabase-server';

/**
 * Registra una acción en admin_audit_logs (silencioso, no falla).
 */
export async function logAdminAction(opts: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    await (supabase as any).from('admin_audit_logs').insert({
      admin_id: opts.adminId,
      action: opts.action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // best-effort
  }
}
