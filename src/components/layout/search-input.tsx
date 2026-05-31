'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';

export function SearchInput({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar clases, recursos, publicaciones..."
        className="w-full rounded-md border border-[rgba(212,175,55,0.15)] bg-[#111111] py-2 pl-9 pr-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.45)] focus:outline-none"
      />
    </form>
  );
}
