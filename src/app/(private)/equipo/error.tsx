'use client';

import { useEffect } from 'react';

export default function EquipoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/equipo] crash:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 bg-[#080808] px-6 text-center">
      <p className="text-red-400 font-bold text-base">Error en la página de equipo</p>
      <p className="text-zinc-400 text-sm max-w-sm">{error.message || 'Error desconocido'}</p>
      {error.digest && (
        <p className="text-zinc-600 text-xs font-mono">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 transition"
      >
        Reintentar
      </button>
    </div>
  );
}
