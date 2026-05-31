'use client';

import { useEffect, useState } from 'react';
import { Calendar, Lock } from 'lucide-react';

function format(diffMs: number): string {
  if (diffMs <= 0) return 'comenzó';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `en ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.floor(hours / 24);
  return `en ${days} día${days === 1 ? '' : 's'}`;
}

export function EventBanner({
  title,
  startTimeIso,
}: {
  title: string;
  startTimeIso: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(startTimeIso).getTime();
  const txt = format(target - now);
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-brand-muted">
      <Calendar className="h-3.5 w-3.5 text-brand-gold" />
      <Lock className="h-3 w-3" />
      <span>
        <span className="font-medium text-brand-text">{title}</span> está sucediendo {txt}
      </span>
    </div>
  );
}
