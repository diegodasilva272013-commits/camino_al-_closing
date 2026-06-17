'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function LimpiarDuplicados() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  async function handleClean() {
    if (!confirm('¿Eliminar todos los leads duplicados (mismo teléfono)? Se conserva el más antiguo.')) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/leads/dedup', { method: 'POST' });
      const data = await res.json();
      setResult(data.message ?? data.error ?? 'Listo');
    } catch {
      setResult('Error de red');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-4 rounded-xl border border-red-800/20 bg-red-950/10 p-4">
      <button
        onClick={handleClean}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 transition disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {loading ? 'Limpiando...' : 'Eliminar leads duplicados'}
      </button>
      {result && <p className="text-sm text-zinc-300">{result}</p>}
    </div>
  );
}
