'use server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeadsHealthPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();

  // Profiles de setters
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('role', ['setter', 'admin', 'mentor']);

  const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p.full_name as string]));
  const setterIds = new Set(profileMap.keys());

  // Todos los leads asignados
  const { data: leads } = await admin
    .from('leads')
    .select('assigned_to_user_id, is_closed, current_status')
    .not('assigned_to_user_id', 'is', null);

  // Todos los leads con teléfono para chequear duplicados
  const { data: leadPhones } = await admin
    .from('leads')
    .select('assigned_to_user_id, phone')
    .not('phone', 'is', null)
    .not('assigned_to_user_id', 'is', null);

  // Agrupar por setter
  type SetterStat = { name: string; visibles: number; ocultos_nc: number; ocultos_error: number };
  const statMap = new Map<string, SetterStat>();

  for (const l of leads ?? []) {
    const uid = l.assigned_to_user_id as string;
    if (!setterIds.has(uid)) continue;
    if (!statMap.has(uid)) statMap.set(uid, { name: profileMap.get(uid) ?? uid, visibles: 0, ocultos_nc: 0, ocultos_error: 0 });
    const s = statMap.get(uid)!;
    if (!l.is_closed) {
      s.visibles++;
    } else if (l.current_status === 'NO_CALIFICA') {
      s.ocultos_nc++;   // cierre legítimo
    } else {
      s.ocultos_error++; // cierre accidental — NO debería haber ninguno después del fix
    }
  }

  const stats = [...statMap.values()].sort((a, b) => (b.visibles + b.ocultos_nc + b.ocultos_error) - (a.visibles + a.ocultos_nc + a.ocultos_error));

  // Duplicados: mismo teléfono mismo setter
  const phoneKey = (p: string) => p.replace(/\D+/g, '');
  const dupMap = new Map<string, number>();
  for (const l of leadPhones ?? []) {
    const k = `${l.assigned_to_user_id}__${phoneKey(l.phone as string)}`;
    dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
  }
  const dups = [...dupMap.entries()].filter(([, v]) => v > 1);

  const totalError = stats.reduce((s, r) => s + r.ocultos_error, 0);
  const todoOk = totalError === 0 && dups.length === 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Salud de Leads</h1>

      <div className={`rounded-xl border p-4 ${todoOk ? 'border-emerald-700 bg-emerald-950/30' : 'border-red-700 bg-red-950/30'}`}>
        <p className={`text-lg font-bold ${todoOk ? 'text-emerald-400' : 'text-red-400'}`}>
          {todoOk ? '✓ Todo en orden — todos los leads están visibles' : '✗ Hay leads con problemas'}
        </p>
        <div className="mt-2 flex gap-6 text-sm text-zinc-400">
          <span>Leads ocultos por error: <strong className={totalError > 0 ? 'text-red-400' : 'text-emerald-400'}>{totalError}</strong></span>
          <span>Teléfonos duplicados: <strong className={dups.length > 0 ? 'text-yellow-400' : 'text-emerald-400'}>{dups.length}</strong></span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Setter</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Visibles</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">NO_CALIFICA</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Error</th>
              <th className="text-center px-4 py-3 text-zinc-400 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {stats.map(s => (
              <tr key={s.name} className={s.ocultos_error > 0 ? 'bg-red-950/20' : ''}>
                <td className="px-4 py-2.5 text-zinc-200">{s.name}</td>
                <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{s.visibles}</td>
                <td className="px-4 py-2.5 text-right text-zinc-500 font-mono">{s.ocultos_nc}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  <span className={s.ocultos_error > 0 ? 'text-red-400 font-bold' : 'text-zinc-700'}>
                    {s.ocultos_error > 0 ? s.ocultos_error : '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {s.ocultos_error === 0
                    ? <span className="text-emerald-400 text-xs font-bold">✓ OK</span>
                    : <span className="text-red-400 text-xs font-bold">✗ {s.ocultos_error} ocultos</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dups.length > 0 && (
        <div className="rounded-xl border border-yellow-700/40 bg-yellow-950/20 p-4">
          <p className="text-yellow-400 font-semibold text-sm">⚠ {dups.length} teléfonos duplicados por setter</p>
          <p className="text-xs text-zinc-500 mt-1">La migración 0038 debería haberlos eliminado. Correr 0038 en SQL Editor si persisten.</p>
        </div>
      )}
    </div>
  );
}
