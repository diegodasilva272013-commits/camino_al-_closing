import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminCoursesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Cursos" description="Crear, editar y eliminar cursos." />
      <PlaceholderCard title="CRUD de cursos" description="Próxima etapa: formularios y listado conectados a Supabase." />
    </div>
  );
}
