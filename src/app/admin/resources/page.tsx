import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveResourceAction, deleteResourceAction } from '@/app/admin/actions';
import {
  AdminForm,
  Field,
  TextArea,
  SelectField,
  Checkbox,
  DeleteButton,
} from '@/app/admin/_components/admin-form';
import { ResourceUploadField } from '@/app/admin/_components/resource-upload-field';
import { RESOURCE_CATEGORIES } from '@/constants/categories';

export const dynamic = 'force-dynamic';

export default async function AdminResourcesPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('resources')
    .select('id, title, description, category, file_url, external_url, is_published, created_at')
    .order('created_at', { ascending: false });

  const items = (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    file_url: string | null;
    external_url: string | null;
    is_published: boolean;
    created_at: string;
  }>;

  const categoryOptions = RESOURCE_CATEGORIES.map((c) => ({ value: c, label: c }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Admin" title="Recursos" description="Subí PDFs, plantillas y materiales." />

      <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
        <section className="card-premium">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
            Nuevo recurso
          </h2>
          <AdminForm action={saveResourceAction} resetOnSuccess>
            <Field label="Título" name="title" required />
            <TextArea label="Descripción" name="description" />
            <SelectField label="Categoría" name="category" options={categoryOptions} required />
            <ResourceUploadField label="Archivo PDF / plantilla (opcional)" name="file_url" />
            <Field
              label="O enlace externo"
              name="external_url"
              placeholder="https://..."
              hint="Podés subir un archivo, poner un link externo, o ambos."
            />
            <Checkbox label="Publicado" name="is_published" defaultChecked />
          </AdminForm>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-muted">
            Recursos ({items.length})
          </h2>
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="card-premium text-sm text-brand-muted">Sin recursos aún.</p>
            ) : (
              items.map((r) => (
                <article key={r.id} className="card-premium">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-brand-gold">
                        {r.category} · {r.is_published ? 'Publicado' : 'Borrador'}
                      </p>
                      <h3 className="text-base font-semibold text-brand-text">{r.title}</h3>
                      {(r.file_url || r.external_url) && (
                        <a
                          href={r.file_url || r.external_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-brand-gold hover:underline"
                        >
                          Abrir
                        </a>
                      )}
                    </div>
                    <DeleteButton
                      action={deleteResourceAction.bind(null, r.id)}
                      confirm={`¿Eliminar el recurso "${r.title}"?`}
                    />
                  </div>
                  <AdminForm action={saveResourceAction} submitLabel="Actualizar">
                    <input type="hidden" name="id" value={r.id} />
                    <Field label="Título" name="title" defaultValue={r.title} required />
                    <TextArea label="Descripción" name="description" defaultValue={r.description} />
                    <SelectField
                      label="Categoría"
                      name="category"
                      options={categoryOptions}
                      defaultValue={r.category}
                      required
                    />
                    <ResourceUploadField label="Reemplazar archivo" name="file_url" />
                    <Field
                      label="Enlace externo"
                      name="external_url"
                      defaultValue={r.external_url}
                    />
                    <Checkbox
                      label="Publicado"
                      name="is_published"
                      defaultChecked={r.is_published}
                    />
                  </AdminForm>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
