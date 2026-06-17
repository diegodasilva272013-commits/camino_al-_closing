'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <p className="text-red-400 font-bold text-lg mb-2">Error en el dashboard:</p>
      <pre className="bg-zinc-900 border border-red-800/40 rounded-lg p-4 text-xs text-red-300 whitespace-pre-wrap break-all">
        {error?.message ?? 'Sin mensaje'}
        {'\n\n'}
        {error?.stack ?? ''}
      </pre>
      <button
        onClick={reset}
        className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
      >
        Reintentar
      </button>
    </div>
  );
}
