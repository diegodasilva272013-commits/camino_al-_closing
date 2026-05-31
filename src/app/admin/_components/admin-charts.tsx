'use client';

type Series = { label: string; data: { day: string; count: number }[]; color?: string };

function maxOf(data: { count: number }[]): number {
  return Math.max(1, ...data.map((d) => d.count));
}

export function AdminChartBar({ label, data, color = '#d4af37' }: Series) {
  const max = maxOf(data);
  return (
    <div className="card-premium">
      <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand-text">
        {data.reduce((s, d) => s + d.count, 0)}{' '}
        <span className="text-xs font-normal text-brand-muted">últimos 30 días</span>
      </p>
      <div className="mt-4 flex h-24 items-end gap-[2px]">
        {data.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.count}`}
            className="flex-1 rounded-sm transition hover:opacity-80"
            style={{
              height: `${(d.count / max) * 100}%`,
              minHeight: d.count > 0 ? '2px' : '1px',
              background: d.count > 0 ? color : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-brand-muted">
        <span>{data[0]?.day.slice(5) ?? ''}</span>
        <span>{data[data.length - 1]?.day.slice(5) ?? ''}</span>
      </div>
    </div>
  );
}

export function AdminChartsRow({ series }: { series: Series[] }) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-3">
      {series.map((s) => (
        <AdminChartBar key={s.label} {...s} />
      ))}
    </div>
  );
}
