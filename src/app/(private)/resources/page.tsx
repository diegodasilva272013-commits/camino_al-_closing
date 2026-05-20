import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';
import { RESOURCE_CATEGORIES } from '@/constants/categories';

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Recursos"
        title="Biblioteca de materiales"
        description="PDFs, plantillas, guiones, ejercicios, grabaciones y bonos."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RESOURCE_CATEGORIES.map((c) => (
          <span
            key={c}
            className="rounded-full border border-[rgba(212,175,55,0.25)] bg-[#0d0d0d] px-3 py-1 text-xs text-brand-muted"
          >
            {c}
          </span>
        ))}
      </div>

      <PlaceholderCard
        title="Recursos descargables"
        description="Próxima etapa: cards de recursos con filtro por categoría y soporte para file_url o external_url."
      />
    </div>
  );
}
