import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminCommunityPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Moderación de comunidad" description="Fijar, ocultar o eliminar publicaciones y comentarios." />
      <PlaceholderCard title="Herramientas de moderación" description="Próxima etapa: cola de moderación y acciones rápidas." />
    </div>
  );
}
