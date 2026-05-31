import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

type LogRow = {
  id: string;
  created_at: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function AdminAuditPage() {
  await requireAdmin();
  const supabase = createSupabaseServerClient();

  const { data: logs } = await (supabase as any)
    .from('admin_audit_logs')
    .select('id, created_at, admin_id, action, target_type, target_id, metadata')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (logs ?? []) as LogRow[];
  const adminIds = Array.from(new Set(rows.map((r) => r.admin_id).filter(Boolean))) as string[];

  let adminMap: Record<string, { full_name: string | null; email: string | null }> = {};
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', adminIds);
    for (const p of (profiles ?? []) as any[]) {
      adminMap[p.id] = { full_name: p.full_name, email: p.email };
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Admin"
        title="Auditoría"
        description={`Últimas ${rows.length} acciones administrativas registradas.`}
      />

      <div className="overflow-x-auto rounded-md border border-[rgba(212,175,55,0.15)]">
        <table className="min-w-full divide-y divide-[rgba(212,175,55,0.12)] text-sm">
          <thead className="bg-[#0d0d0d] text-xs uppercase tracking-widest text-brand-muted">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Admin</th>
              <th className="px-3 py-2 text-left">Acción</th>
              <th className="px-3 py-2 text-left">Objetivo</th>
              <th className="px-3 py-2 text-left">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(212,175,55,0.06)] bg-[#0a0a0a]">
            {rows.map((log) => {
              const admin = log.admin_id ? adminMap[log.admin_id] : null;
              return (
                <tr key={log.id} className="hover:bg-[#111111]">
                  <td className="px-3 py-2 text-brand-muted">
                    {new Date(log.created_at).toLocaleString('es-AR')}
                  </td>
                  <td className="px-3 py-2 text-brand-text">
                    {admin?.full_name || admin?.email || log.admin_id?.slice(0, 8) || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-[#181818] px-2 py-0.5 text-xs text-brand-gold">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-brand-muted">
                    {log.target_type ? (
                      <>
                        <span className="text-brand-text">{log.target_type}</span>
                        {log.target_id ? (
                          <span className="ml-1 text-[10px]">{log.target_id.slice(0, 8)}…</span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-brand-muted">
                    {log.metadata ? (
                      <code className="break-all">{JSON.stringify(log.metadata)}</code>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-brand-muted">
                  Aún no hay acciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
