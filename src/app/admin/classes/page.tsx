import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminClassesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Clases" description="Crear, editar y eliminar clases." />
      <PlaceholderCard title="CRUD de clases" description="Próxima etapa: gestión de lessons con video y orden." />
    </div>
  );
}
