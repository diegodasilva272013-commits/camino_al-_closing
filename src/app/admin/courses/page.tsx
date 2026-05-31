import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveCourseAction, deleteCourseAction } from '@/app/admin/actions';
import {
  AdminForm,
  Field,
  TextArea,
  Checkbox,
  DeleteButton,
} from '@/app/admin/_components/admin-form';

export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('courses')
    .select('id, title, description, cover_image_url, is_published, created_at, modules(id)')
    .order('created_at', { ascending: false });

  const courses = (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    is_published: boolean;
    created_at: string;
    modules: Array<{ id: string }>;
  }>;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Admin" title="Cursos" description="Crear y editar cursos." />

      <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
        <section className="card-premium">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
            Nuevo curso
          </h2>
          <AdminForm action={saveCourseAction} resetOnSuccess>
            <Field label="Título" name="title" required />
            <TextArea label="Descripción" name="description" rows={3} />
            <Field label="URL de portada" name="cover_image_url" placeholder="https://..." />
            <Checkbox label="Publicado" name="is_published" defaultChecked />
          </AdminForm>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-muted">
            Cursos existentes ({courses.length})
          </h2>
          <div className="space-y-3">
            {courses.length === 0 ? (
              <p className="card-premium text-sm text-brand-muted">
                Todavía no hay cursos. Creá el primero en el panel de la izquierda.
              </p>
            ) : (
              courses.map((c) => (
                <article key={c.id} className="card-premium">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-brand-text">{c.title}</h3>
                      <p className="text-[11px] text-brand-muted">
                        {c.modules.length} módulos · {c.is_published ? 'Publicado' : 'Borrador'}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteCourseAction.bind(null, c.id)}
                      confirm={`¿Eliminar el curso "${c.title}" y todos sus módulos/clases?`}
                    />
                  </div>
                  <AdminForm action={saveCourseAction} submitLabel="Actualizar">
                    <input type="hidden" name="id" value={c.id} />
                    <Field label="Título" name="title" defaultValue={c.title} required />
                    <TextArea label="Descripción" name="description" defaultValue={c.description} />
                    <Field
                      label="URL de portada"
                      name="cover_image_url"
                      defaultValue={c.cover_image_url}
                    />
                    <Checkbox
                      label="Publicado"
                      name="is_published"
                      defaultChecked={c.is_published}
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
