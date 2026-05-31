import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveEventAction, deleteEventAction } from '@/app/admin/actions';
import {
  AdminForm,
  Field,
  TextArea,
  SelectField,
  DeleteButton,
} from '@/app/admin/_components/admin-form';
import { EVENT_TYPES } from '@/constants/categories';

export const dynamic = 'force-dynamic';

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminEventsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('events')
    .select('id, title, description, event_type, start_time, end_time, meeting_url, status')
    .order('start_time', { ascending: false });

  const events = (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    event_type: keyof typeof EVENT_TYPES;
    start_time: string;
    end_time: string | null;
    meeting_url: string | null;
    status: 'active' | 'cancelled' | 'finished';
  }>;

  const typeOptions = Object.entries(EVENT_TYPES).map(([value, label]) => ({ value, label }));
  const statusOptions = [
    { value: 'active', label: 'Activo' },
    { value: 'cancelled', label: 'Cancelado' },
    { value: 'finished', label: 'Finalizado' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Admin" title="Eventos" description="Programá clases en vivo, mentorías y prácticas." />

      <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
        <section className="card-premium">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-gold">
            Nuevo evento
          </h2>
          <AdminForm action={saveEventAction} resetOnSuccess>
            <Field label="Título" name="title" required />
            <TextArea label="Descripción" name="description" />
            <SelectField label="Tipo" name="event_type" options={typeOptions} required />
            <Field label="Inicio" name="start_time" type="datetime-local" required />
            <Field label="Fin (opcional)" name="end_time" type="datetime-local" />
            <Field
              label="Link de Meet/Zoom"
              name="meeting_url"
              placeholder="https://..."
            />
            <SelectField label="Estado" name="status" options={statusOptions} defaultValue="active" />
          </AdminForm>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-muted">
            Eventos ({events.length})
          </h2>
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="card-premium text-sm text-brand-muted">Sin eventos aún.</p>
            ) : (
              events.map((e) => (
                <article key={e.id} className="card-premium">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-brand-gold">
                        {EVENT_TYPES[e.event_type]} · {e.status}
                      </p>
                      <h3 className="text-base font-semibold text-brand-text">{e.title}</h3>
                      <p className="text-[11px] text-brand-muted">
                        {new Date(e.start_time).toLocaleString('es-AR')}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteEventAction.bind(null, e.id)}
                      confirm={`¿Eliminar el evento "${e.title}"?`}
                    />
                  </div>
                  <AdminForm action={saveEventAction} submitLabel="Actualizar">
                    <input type="hidden" name="id" value={e.id} />
                    <Field label="Título" name="title" defaultValue={e.title} required />
                    <TextArea label="Descripción" name="description" defaultValue={e.description} />
                    <SelectField
                      label="Tipo"
                      name="event_type"
                      options={typeOptions}
                      defaultValue={e.event_type}
                      required
                    />
                    <Field
                      label="Inicio"
                      name="start_time"
                      type="datetime-local"
                      defaultValue={toLocalInput(e.start_time)}
                      required
                    />
                    <Field
                      label="Fin (opcional)"
                      name="end_time"
                      type="datetime-local"
                      defaultValue={toLocalInput(e.end_time)}
                    />
                    <Field
                      label="Link de Meet/Zoom"
                      name="meeting_url"
                      defaultValue={e.meeting_url}
                    />
                    <SelectField
                      label="Estado"
                      name="status"
                      options={statusOptions}
                      defaultValue={e.status}
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
