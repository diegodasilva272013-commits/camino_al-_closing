import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Admin" title="Usuarios" description="Gestiona usuarios y roles." />
      <PlaceholderCard title="Tabla de usuarios" description="Próxima etapa: lista de usuarios con cambio de rol." />
    </div>
  );
}
