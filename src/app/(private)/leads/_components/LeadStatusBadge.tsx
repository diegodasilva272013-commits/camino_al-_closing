'use client';

import { cn } from '@/lib/utils';
import { LEAD_STATUSES, STATUS_LABELS, STATUS_COLORS, type LeadStatus } from '@/constants/leads';

interface Props {
  status: string;
  onChange?: (status: LeadStatus) => void;
  size?: 'sm' | 'md';
}

export function LeadStatusBadge({ status, onChange, size = 'sm' }: Props) {
  const s = status as LeadStatus;
  const color = STATUS_COLORS[s] ?? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40';
  const label = STATUS_LABELS[s] ?? status;

  if (!onChange) {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-medium whitespace-nowrap',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        color
      )}>
        {label}
      </span>
    );
  }

  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as LeadStatus)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'rounded-full border px-2 py-0.5 font-medium cursor-pointer appearance-none',
        'bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-gold/40',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        color
      )}
      style={{ backgroundImage: 'none' }}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-[#111] text-white">
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
