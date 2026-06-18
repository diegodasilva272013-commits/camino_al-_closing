import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { adjustUserPointsAction } from '@/app/admin/actions';
import { getLevel } from '@/lib/levels';
import { RoleSelect } from './_role-select';
import { DeleteUserButton } from './_delete-user-button';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, points, created_at, avatar_url')
    .order('created_at', { ascending: false })
    .limit(200);

  const users = (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: 'student' | 'mentor' | 'admin';
    points: number;
    created_at: string;
    avatar_url: string | null;
  }>;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Admin"
        title="Usuarios"
        description={`${users.length} usuarios registrados.`}
      />

      <div className="overflow-x-auto rounded-md border border-[rgba(212,175,55,0.15)]">
        <table className="min-w-full divide-y divide-[rgba(212,175,55,0.12)] text-sm">
          <thead className="bg-[#0d0d0d] text-xs uppercase tracking-widest text-brand-muted">
            <tr>
              <th className="px-3 py-2 text-left">Usuario</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Rol</th>
              <th className="px-3 py-2 text-left">Puntos / Nivel</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(212,175,55,0.06)] bg-[#0a0a0a]">
            {users.map((u) => {
              const lvl = getLevel(u.points);
              return (
                <tr key={u.id} className="hover:bg-[#111111]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#181818] text-xs text-brand-gold">
                          {(u.full_name || u.email || 'U')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-brand-text">{u.full_name || '—'}</p>
                        <p className="text-[10px] text-brand-muted">
                          {new Date(u.created_at).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-brand-muted">{u.email ?? '—'}</td>
                  <td className="px-3 py-2">
                    <RoleSelect userId={u.id} current={u.role} />
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-brand-text">{u.points} pts</p>
                    <p className="text-[10px] text-brand-muted">
                      Nivel {lvl.level} {lvl.emoji} {lvl.name}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <form action={adjustUserPointsAction.bind(null, u.id, 10)}>
                        <button className="rounded border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-2 py-1 text-[11px] text-brand-text hover:border-brand-gold hover:text-brand-gold">
                          +10
                        </button>
                      </form>
                      <form action={adjustUserPointsAction.bind(null, u.id, -10)}>
                        <button className="rounded border border-rose-900/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300 hover:border-rose-700">
                          -10
                        </button>
                      </form>
                      <DeleteUserButton
                        userId={u.id}
                        userName={u.full_name ?? u.email ?? u.id}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
