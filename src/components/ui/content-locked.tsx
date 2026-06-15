import { ShieldCheck } from 'lucide-react';

export function ContentLocked({ section = 'Este módulo' }: { section?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.07)]">
        <ShieldCheck className="h-8 w-8 text-brand-gold/60" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-brand-text tracking-tight">
        Acceso restringido
      </h2>
      <p className="mt-3 max-w-md text-sm text-brand-muted leading-relaxed">
        {section} es exclusivo para alumnos que han completado las etapas previas del programa.
        Nosotros evaluamos tu progreso y habilitamos tu acceso cuando estés listo para aprovecharlo al máximo.
      </p>
      <div className="mt-6 rounded-xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.05)] px-6 py-5 max-w-sm text-sm text-brand-muted/90 leading-relaxed">
        <p className="font-medium text-brand-gold mb-1">¿Qué podés hacer ahora?</p>
        Enfocate en el{' '}
        <span className="text-brand-gold font-medium">Entrenamiento</span>,
        trabajá tus <span className="text-brand-gold font-medium">Leads</span> y
        conectate con la <span className="text-brand-gold font-medium">Comunidad</span>.
        Eso es lo que construye el perfil de un closer de élite.
      </div>
    </div>
  );
}
