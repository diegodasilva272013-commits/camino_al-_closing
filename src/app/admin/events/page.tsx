import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminEventsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Eventos" description="Crear, editar y eliminar eventos del calendario." />
      <PlaceholderCard title="CRUD de eventos" description="Próxima etapa: formularios con links externos de Meet/Zoom." />
    </div>
  );
}
