import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';

export type ChecklistStep = {
  key: string;
  label: string;
  description?: string;
  href: string;
  done: boolean;
};

export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  if (completed === total) return null;

  return (
    <section className="card-premium md:col-span-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Empezar acá
          </p>
          <h3 className="mt-1 text-base font-semibold text-brand-text">
            Activá tu cuenta ({completed}/{total})
          </h3>
        </div>
        <div className="text-xs text-brand-muted">
          Completá los pasos y empezá a sumar puntos.
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <ChecklistItem key={s.key} step={s} />
        ))}
      </div>
    </section>
  );
}

function ChecklistItem({ step }: { step: ChecklistStep }) {
  const base = `flex items-start gap-3 rounded-lg border p-3 transition ${
    step.done
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : 'border-white/10 bg-black/20 hover:border-brand-gold/50'
  }`;
  const content = (
    <>
      {step.done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-brand-muted" />
      )}
      <div className="text-left">
        <p
          className={`text-sm font-medium ${
            step.done ? 'text-emerald-300 line-through' : 'text-white'
          }`}
        >
          {step.label}
        </p>
        {step.description ? (
          <p className="mt-0.5 text-[11px] text-brand-muted">{step.description}</p>
        ) : null}
      </div>
    </>
  );
  if (step.done) return <div className={base}>{content}</div>;
  return (
    <Link href={step.href} className={base}>
      {content}
    </Link>
  );
}
