import { cn } from '@/lib/utils';

export function PlaceholderCard({
  title,
  description,
  hint,
  className,
}: {
  title: string;
  description: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('card-premium', className)}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
        Próximamente
      </p>
      <h3 className="mt-2 text-lg font-semibold text-brand-text">{title}</h3>
      <p className="mt-2 text-sm text-brand-muted">{description}</p>
      {hint && (
        <p className="mt-4 rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-xs text-brand-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
