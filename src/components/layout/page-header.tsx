import { cn } from '@/lib/utils';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 border-b border-[rgba(212,175,55,0.12)] pb-6 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-brand-gold">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-brand-text md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-brand-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
