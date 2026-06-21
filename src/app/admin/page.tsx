import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  UserCheck, Users, BookOpen, Layers, GraduationCap, Calendar,
  FolderOpen, MessageSquare, HelpCircle, ShieldCheck, ClipboardList,
  Brain, Users2, BarChart2, FileText, FileSpreadsheet, TrendingUp,
  Swords, FileSearch, Target, Inbox, Megaphone, Wifi,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const sections = [
  { href: '/admin/registros',              label: 'Registros',               desc: 'Ver quién se registró y cuándo.',                                   icon: UserCheck },
  { href: '/admin/users',                  label: 'Usuarios',                desc: 'Cambiar roles, ajustar puntos.',                                    icon: Users },
  { href: '/admin/courses',                label: 'Cursos',                  desc: 'Crear, publicar y editar cursos.',                                  icon: BookOpen },
  { href: '/admin/modules',                label: 'Módulos',                 desc: 'Estructura por curso.',                                             icon: Layers },
  { href: '/admin/classes',                label: 'Clases',                  desc: 'Lessons con video y orden.',                                        icon: GraduationCap },
  { href: '/admin/quizzes',                label: 'Quizzes',                 desc: 'Evaluaciones por lección.',                                         icon: HelpCircle },
  { href: '/admin/events',                 label: 'Eventos',                 desc: 'Mentorías, prácticas, en vivo.',                                    icon: Calendar },
  { href: '/admin/resources',              label: 'Recursos',                desc: 'Subir PDFs, plantillas, etc.',                                      icon: FolderOpen },
  { href: '/admin/community',              label: 'Comunidad',               desc: 'Moderar posts y comentarios.',                                      icon: MessageSquare },
  { href: '/admin/audit',                  label: 'Auditoría',               desc: 'Historial de acciones admin.',                                      icon: ShieldCheck },
  { href: '/admin/trainer',                label: 'Cerebro del Trainer',     desc: 'Instrucciones, reglas y material para la IA del entrenamiento.',    icon: Brain },
  { href: '/admin/leads',                  label: 'Leads — Gestión',         desc: 'Importar CSV y asignar leads a setters.',                           icon: Users2 },
  { href: '/admin/importar-leads',         label: 'Leads — Importar Excel',  desc: 'Subir .xlsx por setter, con asignación automática.',                icon: FileSpreadsheet },
  { href: '/admin/leads-dashboard',        label: 'Leads — Dashboard',       desc: 'Métricas globales y ranking de setters.',                           icon: BarChart2 },
  { href: '/admin/reportes',               label: 'Reportes Diarios',        desc: 'Ver reportes de jornada por usuario y fecha.',                      icon: FileText },
  { href: '/admin/inbox',                  label: 'Inbox global',            desc: 'Todas las conversaciones de prospección del equipo.',                icon: Inbox },
  { href: '/admin/campanas',               label: 'Campañas',                desc: 'Creá y gestioná campañas de prospección.',                          icon: Megaphone },
  { href: '/admin/evolution',              label: 'Evolution API',           desc: 'Conectá números de WhatsApp para envíos automáticos.',              icon: Wifi },
  { href: '/admin/prospeccion',            label: 'Prospección CAC',         desc: 'Dashboard de prospección: mensajes, respuestas, ranking.',           icon: Target },
  { href: '/admin/prospeccion/plantillas', label: 'Plantillas',              desc: 'Mensajes aprobados para el equipo con variables dinámicas.',         icon: FileText },
  { href: '/admin/comunicados',            label: 'Comunicados',             desc: 'Avisos, strikes, reuniones. Ves quién lo leyó.',                    icon: ClipboardList },
  { href: '/admin/trainer/historial',      label: 'Historial Trainer',       desc: 'Sesiones de entrenamiento por setter con análisis IA.',             icon: Swords },
  { href: '/admin/conversaciones',         label: 'Conversaciones',          desc: 'Evolución por setter: capacidades, patrones y aprendizajes.',        icon: FileSearch },
  { href: '/admin/forms',                  label: 'Formularios de refuerzo', desc: 'Formularios por clase con resultados analizados por el Motor CAC.',  icon: ClipboardList },
  { href: '/admin/setters-tareas',         label: 'Tareas setters',          desc: 'Formulario de propuesta para el equipo.',                           icon: ClipboardList },
  { href: '/admin/evolucion',              label: 'Evolución CAC',           desc: 'Seguimiento de capacidades, patrones e intervenciones.',             icon: TrendingUp },
];

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();

  const [usersRes, lessonsRes, postsRes, eventsRes, resourcesRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('start_time', new Date().toISOString()),
    supabase.from('resources').select('id', { count: 'exact', head: true }).eq('is_published', true),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <PageHeader
        eyebrow="Admin"
        title="Control Admin"
        description="Gestión general de la plataforma."
      />

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Plataforma</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Usuarios',          value: usersRes.count    ?? 0 },
            { label: 'Clases publicadas', value: lessonsRes.count  ?? 0 },
            { label: 'Publicaciones',     value: postsRes.count    ?? 0 },
            { label: 'Eventos próximos',  value: eventsRes.count   ?? 0 },
            { label: 'Recursos',          value: resourcesRes.count ?? 0 },
          ].map(s => (
            <div key={s.label} className="card-premium text-center">
              <p className="text-3xl font-semibold text-brand-text">{s.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-brand-gold">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Gestión</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={s.href}
                className="card-premium transition hover:border-[rgba(212,175,55,0.45)]"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">Gestión</p>
                <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
                  <Icon className="h-4 w-4 text-brand-gold" />
                  {s.label}
                </h3>
                <p className="mt-2 text-sm text-brand-muted">{s.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
