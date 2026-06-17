'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2, Check, Search } from 'lucide-react';

type Usuario = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  role: string;
};

export function AgregarPersonaClient({ usuarios }: { usuarios: Usuario[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const filtered = usuarios.filter((u) => {
    const q = query.toLowerCase();
    return (
      !q ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  });

  async function agregar(u: Usuario) {
    setAdding(u.id);
    const res = await fetch('/api/admin/evolucion/agregar-persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: u.full_name ?? u.email ?? 'Sin nombre',
        email: u.email,
        fecha_ingreso: u.created_at.slice(0, 10),
        rol_actual: u.role,
      }),
    });
    setAdding(null);
    if (res.ok) {
      setDone((prev) => new Set(prev).add(u.id));
      startTransition(() => router.refresh());
    }
  }

  if (usuarios.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-[rgba(212,175,55,0.1)] bg-[rgba(212,175,55,0.03)] p-10 text-center max-w-lg">
        <p className="text-brand-muted text-sm">Todos los usuarios ya están en el sistema de evolución.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-xl">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted/50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] pl-9 pr-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/40 focus:border-brand-gold/50 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((u) => {
          const isDone = done.has(u.id);
          const isAdding = adding === u.id;
          return (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-text truncate">
                  {u.full_name ?? '(sin nombre)'}
                </p>
                <p className="text-[11px] text-brand-muted truncate">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400">
                  {u.role}
                </span>
                <button
                  type="button"
                  disabled={isDone || isAdding}
                  onClick={() => agregar(u)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
                    (isDone
                      ? 'border border-emerald-700/40 bg-emerald-950/30 text-emerald-400 cursor-default'
                      : 'border border-brand-gold/30 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 disabled:opacity-50')
                  }
                >
                  {isAdding && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isDone && <Check className="h-3 w-3" />}
                  {isDone ? 'Agregado' : isAdding ? 'Agregando…' : (
                    <><UserPlus className="h-3 w-3" /> Agregar</>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-xs text-brand-muted/50 py-4 text-center">
            No hay usuarios que coincidan con la búsqueda.
          </p>
        )}
      </div>
    </div>
  );
}
