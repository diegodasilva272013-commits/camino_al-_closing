import { PageHeader } from '@/components/layout/page-header';
import { PlaceholderCard } from '@/components/ui/placeholder-card';

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Perfil"
        title="Tu perfil de Closer"
        description="Edita tu información, tu avatar y revisa tu progreso."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <div className="card-premium md:col-span-1">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,175,55,0.45)] bg-[#181818] text-xl font-semibold text-brand-gold">
              CC
            </div>
            <div>
              <h3 className="text-base font-semibold text-brand-text">
                Tu nombre
              </h3>
              <p className="text-xs text-brand-muted">Rol: Student</p>
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <PlaceholderCard
            title="Editor de perfil"
            description="Próxima etapa: formularios para nombre, bio, avatar y métricas de progreso."
          />
        </div>
      </div>
    </div>
  );
}
