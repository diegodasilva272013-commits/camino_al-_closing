import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  setter: 'Setter',
  mentor: 'Mentor',
  student: 'Alumno',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'text-brand-gold border-brand-gold/40 bg-brand-gold/10',
  setter: 'text-blue-300 border-blue-700/40 bg-blue-900/20',
  mentor: 'text-emerald-300 border-emerald-700/40 bg-emerald-900/20',
  student: 'text-brand-muted border-zinc-700 bg-zinc-800/40',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function RegistrosPage() {
  const admin = createSupabaseAdminClient();
  const { data: users } = await admin
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const newToday = (users ?? []).filter((u) => u.created_at >= todayIso).length;

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Admin · Usuarios"
        title="Registros"
        description={`${users?.length ?? 0} usuarios · ${newToday} nuevos hoy`}
      />

      <div className="mt-6 overflow-x-auto rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-[rgba(212,175,55,0.08)]">
              {['Nombre', 'Email', 'Rol', 'Registrado'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-brand-gold/50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(212,175,55,0.05)]">
            {(users ?? []).map((u) => {
              const isNew = u.created_at >= todayIso;
              return (
                <tr key={u.id} className={isNew ? 'bg-[rgba(212,175,55,0.04)]' : 'hover:bg-[rgba(212,175,55,0.02)]'}>
                  <td className="px-4 py-3 font-medium text-brand-text">
                    {u.full_name ?? '—'}
                    {isNew && (
                      <span className="ml-2 rounded-full bg-brand-gold/20 border border-brand-gold/40 px-1.5 py-0.5 text-[10px] text-brand-gold">
                        Nuevo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROLE_COLOR[u.role ?? 'student'] ?? ROLE_COLOR.student}`}>
                      {ROLE_LABEL[u.role ?? 'student'] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{u.created_at ? fmtDate(u.created_at) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
