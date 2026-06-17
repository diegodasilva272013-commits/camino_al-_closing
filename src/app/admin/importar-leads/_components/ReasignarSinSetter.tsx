'use client';

import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';

type SetterOption = { id: string; name: string };

export function ReasignarSinSetter() {
  const [setters, setSetters] = useState<SetterOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    // Contar leads sin asignar
    fetch('/api/admin/leads?user_id=unassigned')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUnassignedCount(data.length); })
      .catch(() => {});

    // Obtener TODOS los setters (incluye los que tienen 0 leads)
    fetch('/api/admin/setters')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSetters(data.map((s: any) => ({ id: s.id, name: s.full_name ?? s.email })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleAssign() {
    if (!selectedId) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/leads/reasignar-sin-setter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setter_id: selectedId }),
      });
      const data = await res.json();
      if (data.updated !== undefined) {
        setResult(`✅ ${data.updated} leads asignados.`);
        setUnassignedCount(0);
      } else {
        setResult(`❌ ${data.error ?? 'Error desconocido'}`);
      }
    } catch {
      setResult('❌ Error de red.');
    } finally {
      setLoading(false);
    }
  }

  // No mostrar si no hay sin asignar o si ya se resolvió
  if (unassignedCount === 0) return null;
  if (unassignedCount === null) return null;

  return (
    <div className="mt-6 rounded-xl border border-orange-700/30 bg-orange-950/20 p-5">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="h-4 w-4 text-orange-400" />
        <p className="text-sm font-semibold text-orange-300">
          {unassignedCount} leads sin setter asignado
        </p>
      </div>
      <p className="text-xs text-zinc-400 mb-4">
        Hay leads en la BD que no pudieron matchearse con ningún setter al importar. Asignalos manualmente:
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
        >
          <option value="">— Seleccionar setter —</option>
          {setters.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={!selectedId || loading}
          className="rounded-lg border border-orange-500/40 bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-500/30 transition disabled:opacity-40"
        >
          {loading ? 'Asignando...' : 'Asignar todos'}
        </button>
      </div>
      {result && <p className="mt-3 text-sm">{result}</p>}
    </div>
  );
}
