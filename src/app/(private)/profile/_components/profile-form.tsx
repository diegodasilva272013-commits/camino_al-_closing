'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, Check, AlertCircle, Save } from 'lucide-react';
import { updateProfileAction, type ProfileActionState } from '../actions';

type ProfileInput = {
  full_name: string | null;
  bio: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  instagram: string | null;
  is_public: boolean;
};

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold inline-flex items-center gap-2"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Guardar cambios
    </button>
  );
}

const initial: ProfileActionState = {};

export function ProfileForm({ profile }: { profile: ProfileInput }) {
  const [state, formAction] = useFormState(updateProfileAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Nombre completo"
          name="full_name"
          defaultValue={profile.full_name ?? ''}
          placeholder="Ej: Juan Pérez"
          required
        />
        <Field
          label="Teléfono"
          name="phone"
          defaultValue={profile.phone ?? ''}
          placeholder="+54 9 ..."
        />
        <Field
          label="Ciudad"
          name="city"
          defaultValue={profile.city ?? ''}
          placeholder="Buenos Aires"
        />
        <Field
          label="País"
          name="country"
          defaultValue={profile.country ?? ''}
          placeholder="Argentina"
        />
        <Field
          label="Sitio web"
          name="website"
          defaultValue={profile.website ?? ''}
          placeholder="https://tu-sitio.com"
        />
        <Field
          label="Instagram (sin @)"
          name="instagram"
          defaultValue={profile.instagram ?? ''}
          placeholder="tu_usuario"
        />
      </div>

      <div>
        <label
          htmlFor="bio"
          className="mb-1.5 block text-[11px] uppercase tracking-wider text-brand-muted"
        >
          Biografía
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={profile.bio ?? ''}
          rows={4}
          maxLength={500}
          placeholder="Contale a la comunidad quién sos, en qué industria estás cerrando, qué buscás aprender…"
          className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
        />
        <p className="mt-1 text-right text-[10px] text-brand-muted">Máx 500 caracteres</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] p-3">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={profile.is_public}
          className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
        />
        <div>
          <p className="text-sm font-medium text-brand-text">
            Perfil público dentro de la comunidad
          </p>
          <p className="text-[11px] text-brand-muted">
            Otros miembros pueden ver tu perfil completo, tu nivel y tus publicaciones.
          </p>
        </div>
      </label>

      {state?.error && (
        <p className="inline-flex items-center gap-2 text-sm text-red-300">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p className="inline-flex items-center gap-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" /> {state.message}
        </p>
      )}

      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-[11px] uppercase tracking-wider text-brand-muted"
      >
        {label}
        {required && <span className="ml-0.5 text-brand-gold">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#0a0a0a] px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
      />
    </div>
  );
}
