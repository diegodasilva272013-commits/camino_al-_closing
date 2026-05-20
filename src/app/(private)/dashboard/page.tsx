import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  Users,
  Calendar,
  FolderOpen,
  PlayCircle,
  TrendingUp,
  Megaphone,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Bienvenido a tu sala"
        title="Hola, Closer."
        description="Tu plan de entrenamiento de hoy, próximos eventos y avances en un solo lugar."
        actions={
          <Link href="/classes" className="btn-gold">
            Ir a clases <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="card-premium md:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Próximo evento
          </p>
          <h3 className="mt-2 text-xl font-semibold text-brand-text">
            Mentoría en vivo — Manejo de objeciones
          </h3>
          <p className="mt-2 text-sm text-brand-muted">
            Jueves · 19:00 · Sala virtual. Trae 1 objeción real que te frenó esta
            semana.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/calendar" className="btn-gold">
              Ver calendario
            </Link>
            <button className="btn-ghost-gold" type="button">
              Recordarme
            </button>
          </div>
        </div>

        <div className="card-premium">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Tu progreso
          </p>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-3xl font-semibold text-brand-text">0%</span>
            <TrendingUp className="h-5 w-5 text-brand-gold" />
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
            <div
              className="h-full bg-gold-gradient transition-all"
              style={{ width: '0%' }}
            />
          </div>
          <p className="mt-3 text-xs text-brand-muted">
            Comienza tu primera clase para activar tu progreso.
          </p>
        </div>

        <div className="card-premium">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Última clase publicada
          </p>
          <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
            <PlayCircle className="h-4 w-4 text-brand-gold" />
            Día 1 — Apertura de llamada
          </h3>
          <p className="mt-2 text-sm text-brand-muted">
            Cómo iniciar una conversación de venta con autoridad.
          </p>
          <Link
            href="/classes"
            className="mt-4 inline-flex items-center gap-2 text-sm text-brand-gold hover:underline"
          >
            Ver clase <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="card-premium">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Anuncio fijado
          </p>
          <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
            <Megaphone className="h-4 w-4 text-brand-gold" />
            Bienvenido al lanzamiento
          </h3>
          <p className="mt-2 text-sm text-brand-muted">
            Presenta tu mejor cierre en la comunidad y empieza a recibir
            feedback.
          </p>
          <Link
            href="/community"
            className="mt-4 inline-flex items-center gap-2 text-sm text-brand-gold hover:underline"
          >
            Ir a comunidad <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="card-premium md:col-span-2 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Accesos rápidos
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { href: '/classes', label: 'Clases', icon: GraduationCap },
              { href: '/community', label: 'Comunidad', icon: Users },
              { href: '/calendar', label: 'Calendario', icon: Calendar },
              { href: '/resources', label: 'Recursos', icon: FolderOpen },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] px-3 py-3 text-sm text-brand-text transition hover:border-[rgba(212,175,55,0.45)] hover:text-brand-gold"
                >
                  <Icon className="h-4 w-4 text-brand-gold" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
