import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminModulesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Módulos" description="Crear, editar y eliminar módulos por curso." />
      <PlaceholderCard title="CRUD de módulos" description="Próxima etapa: gestión de módulos por curso." />
    </div>
  );
}
