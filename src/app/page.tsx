import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { brand } from '@/constants/branding';
import { BrandLogo } from '@/components/brand/brand-logo';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.08),transparent_60%)]" />

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo size="md" priority />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold sm:text-base">{brand.name}</p>
            <p className="hidden text-[10px] uppercase tracking-widest text-brand-gold sm:block">
              {brand.tagline}
            </p>
          </div>
        </div>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full border border-brand-gold/40 px-3 py-2 text-xs font-medium text-brand-text hover:bg-brand-gold/10 sm:px-4 sm:text-sm"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-brand-gold px-3 py-2 text-xs font-semibold text-brand-black hover:opacity-90 sm:px-4 sm:text-sm"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      {/* HERO con la portada */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-20 sm:pt-10 lg:pt-16">
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] shadow-[0_30px_80px_-30px_rgba(212,175,55,0.25)]">
          <Image
            src="/portada.png"
            alt="Camino al Closing — Plataforma privada de entrenamiento"
            width={1920}
            height={1080}
            priority
            className="h-auto w-full object-cover"
          />
          {/* CTA flotante solo en desktop */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-end pb-8 pr-[7%] sm:flex lg:pb-10 lg:pr-[7%]">
            <div className="pointer-events-auto flex items-center gap-3">
              <Link href="/register" className="btn-gold">
                Entrar a la comunidad <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="btn-ghost-gold">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>

        {/* CTAs debajo de la portada SOLO en mobile */}
        <div className="mt-5 flex flex-col gap-3 sm:hidden">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-black hover:opacity-90"
          >
            Entrar a la comunidad <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center rounded-full border border-brand-gold/40 px-5 py-3 text-sm font-medium text-brand-text hover:bg-brand-gold/10"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-6 px-4 pb-24 sm:px-6 md:grid-cols-3">
        {[
          {
            image: '/calendario.png',
            title: 'Entrenamiento real',
            desc: 'Apertura, cualificación, objeciones y cierre. Estructura clara para escalar.',
          },
          {
            image: '/comunidad.png',
            title: 'Comunidad privada',
            desc: 'Comparte llamadas, recibe feedback y crece con otros closers.',
          },
          {
            image: '/meentorias.png',
            title: 'Mentorías en vivo',
            desc: 'Calendario semanal de prácticas, roleplays y revisiones.',
          },
        ].map((f) => (
          <div
            key={f.title}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] shadow-[0_20px_60px_-30px_rgba(212,175,55,0.25)] transition-all hover:border-[rgba(212,175,55,0.4)] hover:shadow-[0_25px_70px_-25px_rgba(212,175,55,0.4)]"
          >
            <div className="relative aspect-video w-full overflow-hidden">
              <Image
                src={f.image}
                alt={f.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-base font-semibold text-brand-gold">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </section>

      <footer className="relative z-10 border-t border-[rgba(212,175,55,0.1)] py-6 text-center text-xs text-brand-muted">
        © {new Date().getFullYear()} {brand.name}. Todos los derechos
        reservados.
      </footer>
    </div>
  );
}
