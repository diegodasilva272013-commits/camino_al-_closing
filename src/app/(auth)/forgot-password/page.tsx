import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brand-text">
        Recuperar contraseña
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Te enviaremos un enlace para restablecerla.
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
        <button type="button" className="btn-gold w-full" disabled>
          Enviar enlace (próxima etapa)
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-brand-muted">
        <Link href="/login" className="text-brand-gold hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
