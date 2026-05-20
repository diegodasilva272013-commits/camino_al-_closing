import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

const sections = [
  { href: '/admin/users', label: 'Usuarios' },
  { href: '/admin/courses', label: 'Cursos' },
  { href: '/admin/modules', label: 'Módulos' },
  { href: '/admin/classes', label: 'Clases' },
  { href: '/admin/events', label: 'Eventos' },
  { href: '/admin/resources', label: 'Recursos' },
  { href: '/admin/community', label: 'Comunidad' },
];

const stats = [
  { label: 'Usuarios totales', value: '—' },
  { label: 'Clases publicadas', value: '—' },
  { label: 'Publicaciones', value: '—' },
  { label: 'Eventos próximos', value: '—' },
];

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Panel admin"
        title="Centro de control"
        description="Gestiona usuarios, cursos, clases, eventos, recursos y la comunidad."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-premium">
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
              {s.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-brand-text">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card-premium transition hover:border-[rgba(212,175,55,0.45)]"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
              Gestión
            </p>
            <h3 className="mt-2 text-base font-semibold text-brand-text">
              {s.label}
            </h3>
            <p className="mt-2 text-sm text-brand-muted">
              Crear, editar y eliminar {s.label.toLowerCase()}.
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <PlaceholderCard
          title="Protección por rol y CRUDs admin"
          description="Próxima etapa: middleware que verifique role = admin desde Supabase y formularios CRUD para cada sección."
        />
      </div>
    </div>
  );
}
