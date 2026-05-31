import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveLessonAction, deleteLessonAction } from '@/app/admin/actions';
import {
  AdminForm,
  Field,
  TextArea,
  SelectField,
  Checkbox,
  DeleteButton,
} from '@/app/admin/_components/admin-form';

export const dynamic = 'force-dynamic';

export default async function AdminClassesPage() {
  const supabase = createSupabaseServerClient();

  const [modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from('modules')
      .select('id, title, courses(title)')
      .order('order_index', { ascending: true }),
    supabase
      .from('lessons')
      .select(
        'id, module_id, title, description, video_url, duration_minutes, order_index, is_locked, is_published, modules(title, courses(title))'
      )
      .order('order_index', { ascending: true }),
  ]);

  const modules = (modulesRes.data ?? []) as Array<{
    id: string;
    title: string;
    courses: { title: string } | null;
  }>;

  const lessons = (lessonsRes.data ?? []) as Array<{
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    video_url: string | null;
    duration_minutes: number | null;
    order_index: number;
    is_locked: boolean;
    is_published: boolean;
    modules: { title: string; courses: { title: string } | null } | null;
  }>;

  const moduleOptions = modules.map((m) => ({
    value: m.id,
    label: `${m.courses?.title ?? '—'} · ${m.title}`,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Admin"
        title="Clases (lessons)"
        description="Cargá videos, duración y orden por módulo."
      />

      {modules.length === 0 ? (
        <div className="card-premium text-sm text-brand-muted">
          Primero creá al menos un módulo en{' '}
          <a href="/admin/modules" className="text-brand-gold underline">
            /admin/modules
          </a>
          .
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
          <section className="card-premium">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
              Nueva clase
            </h2>
            <AdminForm action={saveLessonAction} resetOnSuccess>
              <SelectField label="Módulo" name="module_id" options={moduleOptions} required />
              <Field label="Título" name="title" required />
              <TextArea label="Descripción" name="description" rows={3} />
              <Field
                label="URL de video"
                name="video_url"
                placeholder="YouTube, Vimeo o archivo MP4"
                hint="Acepta youtube.com, youtu.be, vimeo.com o un .mp4 directo."
              />
              <Field label="Duración (min)" name="duration_minutes" type="number" />
              <Field label="Orden" name="order_index" type="number" defaultValue={0} />
              <div className="flex gap-4">
                <Checkbox label="Publicada" name="is_published" defaultChecked />
                <Checkbox label="Bloqueada" name="is_locked" />
              </div>
            </AdminForm>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-muted">
              Clases ({lessons.length})
            </h2>
            <div className="space-y-3">
              {lessons.length === 0 ? (
                <p className="card-premium text-sm text-brand-muted">Sin clases aún.</p>
              ) : (
                lessons.map((l) => (
                  <article key={l.id} className="card-premium">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-widest text-brand-gold">
                          {l.modules?.courses?.title} · {l.modules?.title}
                        </p>
                        <h3 className="text-base font-semibold text-brand-text">{l.title}</h3>
                        <p className="text-[11px] text-brand-muted">
                          {l.duration_minutes ?? '?'} min · orden {l.order_index} ·{' '}
                          {l.is_published ? 'Publicada' : 'Borrador'}
                          {l.is_locked ? ' · 🔒' : ''}
                        </p>
                      </div>
                      <DeleteButton
                        action={deleteLessonAction.bind(null, l.id)}
                        confirm={`¿Eliminar la clase "${l.title}"?`}
                      />
                    </div>
                    <AdminForm action={saveLessonAction} submitLabel="Actualizar">
                      <input type="hidden" name="id" value={l.id} />
                      <SelectField
                        label="Módulo"
                        name="module_id"
                        options={moduleOptions}
                        defaultValue={l.module_id}
                        required
                      />
                      <Field label="Título" name="title" defaultValue={l.title} required />
                      <TextArea
                        label="Descripción"
                        name="description"
                        defaultValue={l.description}
                      />
                      <Field
                        label="URL de video"
                        name="video_url"
                        defaultValue={l.video_url}
                      />
                      <Field
                        label="Duración (min)"
                        name="duration_minutes"
                        type="number"
                        defaultValue={l.duration_minutes ?? ''}
                      />
                      <Field
                        label="Orden"
                        name="order_index"
                        type="number"
                        defaultValue={l.order_index}
                      />
                      <div className="flex gap-4">
                        <Checkbox
                          label="Publicada"
                          name="is_published"
                          defaultChecked={l.is_published}
                        />
                        <Checkbox label="Bloqueada" name="is_locked" defaultChecked={l.is_locked} />
                      </div>
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
