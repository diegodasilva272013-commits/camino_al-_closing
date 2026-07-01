import { ResetPasswordForm } from './reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brand-text">Nueva contraseña</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Elegí tu nueva contraseña para acceder a la plataforma.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
