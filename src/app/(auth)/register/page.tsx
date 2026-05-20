import Link from 'next/link';
import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brand-text">Crear cuenta</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Únete a la sala privada de closers.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-xs text-brand-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-brand-gold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
