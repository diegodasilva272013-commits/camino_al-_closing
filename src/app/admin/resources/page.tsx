import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminResourcesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Recursos" description="Subir, editar y eliminar recursos." />
      <PlaceholderCard title="CRUD de recursos" description="Próxima etapa: subida de archivos a Supabase Storage." />
    </div>
  );
}
