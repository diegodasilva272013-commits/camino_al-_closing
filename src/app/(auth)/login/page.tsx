import Link from 'next/link';

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brand-text">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Accede a tu sala privada de entrenamiento.
      </p>

      <form className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
            Email
          </label>
          <input
            type="email"
            placeholder="tu@email.com"
            className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
            disabled
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-brand-muted">
            Contraseña
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full rounded-md border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
            disabled
          />
        </div>
        <button type="button" className="btn-gold w-full" disabled>
          Entrar (próxima etapa)
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-brand-muted">
        <Link href="/forgot-password" className="hover:text-brand-gold">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/register" className="hover:text-brand-gold">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
