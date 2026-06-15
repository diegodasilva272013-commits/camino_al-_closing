import { Lock } from 'lucide-react';

export function ContentLocked({ section = 'este contenido' }: { section?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.05)]">
        <Lock className="h-8 w-8 text-brand-gold/50" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-brand-text">
        Contenido Bloqueado
      </h2>
      <p className="mt-3 max-w-sm text-sm text-brand-muted leading-relaxed">
        {section === 'este contenido'
          ? 'Este contenido estará disponible muy pronto.'
          : `${section} estará disponible muy pronto.`}
        <br />
        Tu acceso será habilitado por el administrador cuando el material esté listo.
      </p>
      <div className="mt-6 rounded-xl border border-[rgba(212,175,55,0.15)] bg-[rgba(212,175,55,0.04)] px-6 py-4 text-sm text-brand-muted/80">
        Mientras tanto podés practicar en{' '}
        <span className="text-brand-gold">Entrenamiento</span>,
        gestionar tus <span className="text-brand-gold">Leads</span> y
        participar en la <span className="text-brand-gold">Comunidad</span>.
      </div>
    </div>
  );
}
