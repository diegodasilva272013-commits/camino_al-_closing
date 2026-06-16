import { PageHeader } from '@/components/layout/page-header';

export default function SetterCalendarioPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Setter · Reuniones"
        title="Agendar Reunión con Diego"
        description="Seleccioná el día y horario que mejor te quede."
      />

      <div className="mt-6 flex-1 overflow-hidden rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d]">
        <iframe
          src="https://calendly.com/diego_da_silva/30min"
          style={{ width: '100%', height: '700px', border: 'none' }}
          title="Agendar reunión con Diego"
          loading="lazy"
        />
      </div>
    </div>
  );
}
