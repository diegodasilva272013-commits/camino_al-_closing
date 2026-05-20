import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

const modules = [
  { title: 'Día 1 — Apertura de llamada', desc: 'Cómo iniciar con autoridad.' },
  { title: 'Día 2 — Cualificación', desc: 'Detectar intención y capacidad.' },
  { title: 'Día 3 — Manejo de objeciones', desc: 'Resolver sin perder autoridad.' },
  { title: 'Día 4 — Cierre', desc: 'Avanzar hacia la decisión.' },
  { title: 'Día 5 — Simulación real', desc: 'Roleplay y plan de acción.' },
];

export default function ClassesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Biblioteca de clases"
        title="Lanzamiento Camino al Closing — 5 Días"
        description="Entrenamiento privado para dominar apertura, cualificación, objeciones y cierre."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m, i) => (
          <div key={m.title} className="card-premium">
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
              Módulo {i + 1}
            </p>
            <h3 className="mt-2 text-base font-semibold text-brand-text">
              {m.title}
            </h3>
            <p className="mt-2 text-sm text-brand-muted">{m.desc}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-brand-muted">
              <span>0 / 1 clases</span>
              <span className="text-brand-gold">Próximamente</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <PlaceholderCard
          title="Reproductor y progreso por clase"
          description="En la siguiente etapa cada clase tendrá video embebido, recursos adjuntos y botón para marcar como completada."
          hint="Próxima etapa: conexión con Supabase para cursos, módulos y lessons."
        />
      </div>
    </div>
  );
}
