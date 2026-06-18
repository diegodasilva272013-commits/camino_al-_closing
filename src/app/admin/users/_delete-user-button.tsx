'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteUserAction } from '@/app/admin/actions';

export function DeleteUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Borrar al usuario "${userName}"?\n\nEsta acción es IRREVERSIBLE. Se eliminará la cuenta y todos sus datos.`
    );
    if (!confirmed) return;

    const doubleCheck = window.confirm(
      `⚠️ ÚLTIMA CONFIRMACIÓN\n\n¿Estás seguro que querés borrar a "${userName}"?`
    );
    if (!doubleCheck) return;

    setLoading(true);
    setError('');
    const result = await deleteUserAction(userId);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // Si no hay error, la página se revalida automáticamente
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={handleDelete}
        disabled={loading}
        title="Borrar usuario"
        className="grid h-7 w-7 place-items-center rounded border border-red-900/40 bg-red-950/20 text-red-500 hover:border-red-700 hover:bg-red-900/30 disabled:opacity-40 transition"
      >
        {loading ? (
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border border-red-400 border-t-transparent" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
      {error && <p className="text-[9px] text-red-400 max-w-[60px] leading-tight">{error}</p>}
    </div>
  );
}
