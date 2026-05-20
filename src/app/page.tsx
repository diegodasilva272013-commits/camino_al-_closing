import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Target, Users, Calendar } from 'lucide-react';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.08),transparent_60%)]" />

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" priority />
          <div>
            <p className="text-sm font-semibold">{brand.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-brand-gold">
              {brand.tagline}
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost-gold">
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-gold">
            Crear cuenta
          </Link>
        </nav>
      </header>

      {/* HERO con la portada */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-10 lg:pt-16">
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] shadow-[0_30px_80px_-30px_rgba(212,175,55,0.25)]">
          <Image
            src="/portada.png"
            alt="Camino al Closing — Plataforma privada de entrenamiento"
            width={1920}
            height={1080}
            priority
            className="h-auto w-full object-cover"
          />
        </div>
        {/* CTAs debajo de la portada para no tapar la imagen */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
          <Link href="/register" className="btn-gold">
            Entrar a la comunidad <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-ghost-gold">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-6 pb-24 md:grid-cols-3">
        {[
          {
            icon: Target,
            title: 'Entrenamiento real',
            desc: 'Apertura, cualificación, objeciones y cierre. Estructura clara para escalar.',
          },
          {
            icon: Users,
            title: 'Comunidad privada',
            desc: 'Comparte llamadas, recibe feedback y crece con otros closers.',
          },
          {
            icon: Calendar,
            title: 'Mentorías en vivo',
            desc: 'Calendario semanal de prácticas, roleplays y revisiones.',
          },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="card-premium">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-[rgba(212,175,55,0.3)] bg-[#0d0d0d] text-brand-gold">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-brand-text">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-brand-muted">{f.desc}</p>
            </div>
          );
        })}
      </section>

      <footer className="relative z-10 border-t border-[rgba(212,175,55,0.1)] py-6 text-center text-xs text-brand-muted">
        © {new Date().getFullYear()} {brand.name}. Todos los derechos
        reservados.
      </footer>
    </div>
  );
}
