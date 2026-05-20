import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';
import { COMMUNITY_CATEGORIES } from '@/constants/categories';

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Comunidad privada"
        title="Feed de la sala"
        description="Comparte llamadas, dudas y resultados. La autoridad se construye en público."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="card-premium h-fit">
          <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Categorías
          </p>
          <ul className="space-y-1 text-sm">
            {COMMUNITY_CATEGORIES.map((c) => (
              <li
                key={c}
                className="cursor-pointer rounded-md px-2 py-1.5 text-brand-muted transition hover:bg-[#181818] hover:text-brand-text"
              >
                {c}
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          <PlaceholderCard
            title="Publicaciones"
            description="Aquí verás el feed de la comunidad: anuncios, dudas, roleplays, resultados y feedback de llamadas."
            hint="Próxima etapa: composer, comments y likes conectados a Supabase."
          />
        </div>
      </div>
    </div>
  );
}
