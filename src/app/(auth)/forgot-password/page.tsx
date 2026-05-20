import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brand-text">
        Recuperar contraseña
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Te enviaremos un enlace para restablecerla.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-xs text-brand-muted">
        <Link href="/login" className="text-brand-gold hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
