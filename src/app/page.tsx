import Link from 'next/link';
import { ArrowRight, Target, Users, Calendar } from 'lucide-react';
import { brand } from '@/constants/branding';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.08),transparent_60%)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold-gradient text-[#0a0a0a] font-bold">
            C
          </div>
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

      <section className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-brand-gold">
          Centro de alto rendimiento
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-brand-text md:text-6xl">
          La sala privada de entrenamiento para{' '}
          <span className="text-brand-gold">closers</span> que quieren dominar
          la venta.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-brand-muted md:text-lg">
          Clases, comunidad, mentorías y prácticas — todo en un solo lugar.
          Foco, disciplina y resultados medibles.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="btn-gold">
            Entrar a la comunidad <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard" className="btn-ghost-gold">
            Ver dashboard
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
