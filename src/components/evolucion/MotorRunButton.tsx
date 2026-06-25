'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';

interface Props {
  userId?: string; // undefined = todo el equipo
  label?: string;
}

export function MotorRunButton({ userId, label }: Props) {
  const router              = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/evolucion/motor/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(userId ? { user_id: userId } : {}),
      });
      let data: any = {};
      try { data = await res.json(); } catch {
        setResult(`Error ${res.status}: respuesta vacía del servidor — revisá los logs de Vercel`);
        return;
      }
      if (!res.ok) {
        setResult(`Error: ${data.error ?? res.statusText}`);
        return;
      }
      const ev = data.created?.evidencias     ?? 0;
      const co = data.created?.comportamientos ?? 0;
      setResult(`✓ ${ev} evidencia${ev !== 1 ? 's' : ''} · ${co} comportamiento${co !== 1 ? 's' : ''}`);
      router.refresh();
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-700/40 bg-blue-950/30 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-950/50 disabled:opacity-50 transition"
      >
        <Zap className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? 'Analizando…' : (label ?? 'Analizar ahora')}
      </button>
      {result && (
        <span className="text-[11px] text-brand-muted">{result}</span>
      )}
    </div>
  );
}
