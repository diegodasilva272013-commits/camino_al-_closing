import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveModuleAction, deleteModuleAction } from '@/app/admin/actions';
import {
  AdminForm,
  Field,
  TextArea,
  SelectField,
  DeleteButton,
} from '@/app/admin/_components/admin-form';

export const dynamic = 'force-dynamic';

export default async function AdminModulesPage() {
  const supabase = createSupabaseServerClient();

  const [coursesRes, modulesRes] = await Promise.all([
    supabase.from('courses').select('id, title').order('created_at', { ascending: true }),
    supabase
      .from('modules')
      .select('id, course_id, title, description, order_index, courses(title), lessons(id)')
      .order('order_index', { ascending: true }),
  ]);

  const courses = (coursesRes.data ?? []) as Array<{ id: string; title: string }>;
  const modules = (modulesRes.data ?? []) as Array<{
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    order_index: number;
    courses: { title: string } | null;
    lessons: Array<{ id: string }>;
  }>;

  const courseOptions = courses.map((c) => ({ value: c.id, label: c.title }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Admin" title="Módulos" description="Organizá los cursos por módulos." />

      {courses.length === 0 ? (
        <div className="card-premium text-sm text-brand-muted">
          Primero creá al menos un curso desde <a href="/admin/courses" className="text-brand-gold underline">/admin/courses</a>.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
          <section className="card-premium">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
              Nuevo módulo
            </h2>
            <AdminForm action={saveModuleAction} resetOnSuccess>
              <SelectField label="Curso" name="course_id" options={courseOptions} required />
              <Field label="Título" name="title" required />
              <TextArea label="Descripción" name="description" />
              <Field label="Orden" name="order_index" type="number" defaultValue={0} />
            </AdminForm>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-muted">
              Módulos ({modules.length})
            </h2>
            <div className="space-y-3">
              {modules.length === 0 ? (
                <p className="card-premium text-sm text-brand-muted">Sin módulos aún.</p>
              ) : (
                modules.map((m) => (
                  <article key={m.id} className="card-premium">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-widest text-brand-gold">
                          {m.courses?.title ?? 'Sin curso'}
                        </p>
                        <h3 className="text-base font-semibold text-brand-text">{m.title}</h3>
                        <p className="text-[11px] text-brand-muted">
                          {m.lessons.length} clases · orden {m.order_index}
                        </p>
                      </div>
                      <DeleteButton
                        action={deleteModuleAction.bind(null, m.id)}
                        confirm={`¿Eliminar el módulo "${m.title}"?`}
                      />
                    </div>
                    <AdminForm action={saveModuleAction} submitLabel="Actualizar">
                      <input type="hidden" name="id" value={m.id} />
                      <SelectField
                        label="Curso"
                        name="course_id"
                        options={courseOptions}
                        defaultValue={m.course_id}
                        required
                      />
                      <Field label="Título" name="title" defaultValue={m.title} required />
                      <TextArea label="Descripción" name="description" defaultValue={m.description} />
                      <Field
                        label="Orden"
                        name="order_index"
                        type="number"
                        defaultValue={m.order_index}
                      />
                    </AdminForm>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
