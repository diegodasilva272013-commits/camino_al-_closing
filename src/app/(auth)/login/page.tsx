import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brand-text">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Accede a tu sala privada de entrenamiento.
      </p>

      <LoginForm />

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
