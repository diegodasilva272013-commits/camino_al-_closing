'use server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeadsHealthPage() {
  const admin = createSupabaseAdminClient();

  // 1. Leads visibles/ocultos por setter
  const { data: setterRows } = await admin
    .from('leads')
    .select('assigned_to_user_id, is_closed, profiles!leads_assigned_to_user_id_fkey(full_name, role)')
    .not('assigned_to_user_id', 'is', null);

  type SetterStat = { name: string; visibles: number; ocultos: number };
  const bySetterMap = new Map<string, SetterStat>();
  for (const row of setterRows ?? []) {
    const prof = row.profiles as { full_name: string; role: string } | null;
    if (!prof || !['setter','admin','mentor'].includes(prof.role)) continue;
    const key = row.assigned_to_user_id as string;
    if (!bySetterMap.has(key)) bySetterMap.set(key, { name: prof.full_name, visibles: 0, ocultos: 0 });
    const s = bySetterMap.get(key)!;
    if (row.is_closed) s.ocultos++; else s.visibles++;
  }
  const setterStats = [...bySetterMap.values()].sort((a, b) => b.visibles + b.ocultos - (a.visibles + a.ocultos));

  // 2. Duplicados: mismo teléfono mismo setter
  const { data: allLeads } = await admin
    .from('leads')
    .select('assigned_to_user_id, phone')
    .not('phone', 'is', null)
    .not('assigned_to_user_id', 'is', null);

  const phoneKey = (phone: string) => phone.replace(/\D+/g, '');
  const dupMap = new Map<string, number>();
  for (const l of allLeads ?? []) {
    const k = `${l.assigned_to_user_id}__${phoneKey(l.phone)}`;
    dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
  }
  const dupCount = [...dupMap.values()].filter(v => v > 1).length;

  const totalOcultos = setterStats.reduce((s, r) => s + r.ocultos, 0);
  const todoOk = totalOcultos === 0 && dupCount === 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Salud de Leads</h1>

      {/* Resumen */}
      <div className={`rounded-xl border p-4 ${todoOk ? 'border-emerald-700 bg-emerald-950/30' : 'border-red-700 bg-red-950/30'}`}>
        <p className={`text-lg font-bold ${todoOk ? 'text-emerald-400' : 'text-red-400'}`}>
          {todoOk ? '✓ Todo en orden — todos los leads están visibles' : '✗ Hay leads ocultos o duplicados'}
        </p>
        <div className="mt-2 flex gap-6 text-sm text-zinc-400">
          <span>Leads ocultos (no NO_CALIFICA): <strong className={totalOcultos > 0 ? 'text-red-400' : 'text-emerald-400'}>{totalOcultos}</strong></span>
          <span>Teléfonos duplicados por setter: <strong className={dupCount > 0 ? 'text-yellow-400' : 'text-emerald-400'}>{dupCount}</strong></span>
        </div>
      </div>

      {/* Por setter */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Setter</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Visibles</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Ocultos*</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Total</th>
              <th className="text-center px-4 py-3 text-zinc-400 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {setterStats.map(s => (
              <tr key={s.name} className={s.ocultos > 0 ? 'bg-red-950/20' : ''}>
                <td className="px-4 py-2.5 text-zinc-200">{s.name}</td>
                <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{s.visibles}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  <span className={s.ocultos > 0 ? 'text-red-400' : 'text-zinc-600'}>{s.ocultos}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-400 font-mono">{s.visibles + s.ocultos}</td>
                <td className="px-4 py-2.5 text-center">
                  {s.ocultos === 0 ? <span className="text-emerald-400 text-xs font-bold">✓ OK</span>
                    : <span className="text-red-400 text-xs font-bold">✗ {s.ocultos} ocultos</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">* Ocultos = is_closed=true con status distinto a NO_CALIFICA. Los NO_CALIFICA son cierres legítimos del setter.</p>
    </div>
  );
}
