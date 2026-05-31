import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { Users, BookOpen, Layers, GraduationCap, Calendar, FolderOpen, MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

const sections = [
  { href: '/admin/users', label: 'Usuarios', desc: 'Cambiar roles, ajustar puntos.', icon: Users },
  { href: '/admin/courses', label: 'Cursos', desc: 'Crear, publicar y editar cursos.', icon: BookOpen },
  { href: '/admin/modules', label: 'Módulos', desc: 'Estructura por curso.', icon: Layers },
  { href: '/admin/classes', label: 'Clases', desc: 'Lessons con video y orden.', icon: GraduationCap },
  { href: '/admin/events', label: 'Eventos', desc: 'Mentorías, prácticas, en vivo.', icon: Calendar },
  { href: '/admin/resources', label: 'Recursos', desc: 'Subir PDFs, plantillas, etc.', icon: FolderOpen },
  { href: '/admin/community', label: 'Comunidad', desc: 'Moderar posts y comentarios.', icon: MessageSquare },
];

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();

  const [users, lessons, posts, events, resources] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('start_time', new Date().toISOString()),
    supabase.from('resources').select('id', { count: 'exact', head: true }).eq('is_published', true),
  ]);

  const stats = [
    { label: 'Usuarios', value: users.count ?? 0 },
    { label: 'Clases publicadas', value: lessons.count ?? 0 },
    { label: 'Publicaciones', value: posts.count ?? 0 },
    { label: 'Eventos próximos', value: events.count ?? 0 },
    { label: 'Recursos publicados', value: resources.count ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Panel admin"
        title="Centro de control"
        description="Gestiona usuarios, cursos, clases, eventos, recursos y la comunidad."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card-premium">
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
              {s.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-brand-text">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="card-premium transition hover:border-[rgba(212,175,55,0.45)]"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
                Gestión
              </p>
              <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
                <Icon className="h-4 w-4 text-brand-gold" />
                {s.label}
              </h3>
              <p className="mt-2 text-sm text-brand-muted">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
