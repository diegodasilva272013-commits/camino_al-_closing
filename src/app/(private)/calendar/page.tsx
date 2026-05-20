import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Calendario"
        title="Eventos y mentorías"
        description="Clases en vivo, prácticas, roleplays y revisiones. Todo en un solo lugar."
      />
      <PlaceholderCard
        title="Lista de eventos próximos"
        description="Próxima etapa: lista ordenada por fecha con badges por tipo de evento y link externo de Meet o Zoom."
        hint="Para el MVP no hay videollamadas internas. Solo links externos."
      />
    </div>
  );
}
