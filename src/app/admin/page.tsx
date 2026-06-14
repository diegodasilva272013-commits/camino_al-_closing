import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AdminChartsRow } from './_components/admin-charts';
import {
  Users,
  BookOpen,
  Layers,
  GraduationCap,
  Calendar,
  FolderOpen,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  ClipboardList,
  Brain,
  Users2,
  BarChart2,
  FileText,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const sections = [
  { href: '/admin/users', label: 'Usuarios', desc: 'Cambiar roles, ajustar puntos.', icon: Users },
  { href: '/admin/courses', label: 'Cursos', desc: 'Crear, publicar y editar cursos.', icon: BookOpen },
  { href: '/admin/modules', label: 'Módulos', desc: 'Estructura por curso.', icon: Layers },
  { href: '/admin/classes', label: 'Clases', desc: 'Lessons con video y orden.', icon: GraduationCap },
  { href: '/admin/quizzes', label: 'Quizzes', desc: 'Evaluaciones por lección.', icon: HelpCircle },
  { href: '/admin/events', label: 'Eventos', desc: 'Mentorías, prácticas, en vivo.', icon: Calendar },
  { href: '/admin/resources', label: 'Recursos', desc: 'Subir PDFs, plantillas, etc.', icon: FolderOpen },
  { href: '/admin/community', label: 'Comunidad', desc: 'Moderar posts y comentarios.', icon: MessageSquare },
  { href: '/admin/audit', label: 'Auditoría', desc: 'Historial de acciones admin.', icon: ShieldCheck },
  {
    href: '/admin/setters-tareas',
    label: 'Tareas setters',
    desc: 'Formulario de propuesta para el ejercicio del 9/6/2026.',
    icon: ClipboardList,
  },
  {
    href: '/admin/trainer',
    label: 'Cerebro del Trainer',
    desc: 'Instrucciones, reglas y material para la IA del entrenamiento.',
    icon: Brain,
  },
  { href: '/admin/leads', label: 'Leads — Gestión', desc: 'Importar CSV y asignar leads a setters.', icon: Users2 },
  { href: '/admin/leads-dashboard', label: 'Leads — Dashboard', desc: 'Métricas globales y ranking de setters.', icon: BarChart2 },
  { href: '/admin/reportes', label: 'Reportes Diarios', desc: 'Ver reportes de jornada por usuario y fecha.', icon: FileText },
];

function buildDailyBuckets(rows: { created_at: string }[], days = 30) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const buckets: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    buckets.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  const index: Record<string, number> = {};
  buckets.forEach((b, idx) => (index[b.day] = idx));
  for (const r of rows) {
    if (!r?.created_at) continue;
    const key = String(r.created_at).slice(0, 10);
    if (index[key] !== undefined) buckets[index[key]].count++;
  }
  return buckets;
}

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceIso = since.toISOString();

  const [users, lessons, posts, events, resources, signups, lessonsDone, postsCreated] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('start_time', new Date().toISOString()),
    supabase.from('resources').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('profiles').select('created_at').gte('created_at', sinceIso),
    (supabase as any)
      .from('lesson_progress')
      .select('completed_at')
      .eq('completed', true)
      .gte('completed_at', sinceIso),
    supabase
      .from('community_posts')
      .select('created_at')
      .eq('is_deleted', false)
      .gte('created_at', sinceIso),
  ]);

  const stats = [
    { label: 'Usuarios', value: users.count ?? 0 },
    { label: 'Clases publicadas', value: lessons.count ?? 0 },
    { label: 'Publicaciones', value: posts.count ?? 0 },
    { label: 'Eventos próximos', value: events.count ?? 0 },
    { label: 'Recursos publicados', value: resources.count ?? 0 },
  ];

  const signupsBuckets = buildDailyBuckets((signups.data as any) ?? []);
  const lessonsBuckets = buildDailyBuckets(
    ((lessonsDone.data as any) ?? []).map((r: any) => ({ created_at: r.completed_at }))
  );
  const postsBuckets = buildDailyBuckets((postsCreated.data as any) ?? []);

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

      <AdminChartsRow
        series={[
          { label: 'Nuevos usuarios', data: signupsBuckets, color: '#d4af37' },
          { label: 'Clases completadas', data: lessonsBuckets, color: '#22c55e' },
          { label: 'Publicaciones', data: postsBuckets, color: '#3b82f6' },
        ]}
      />

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
