import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  Users,
  Calendar,
  FolderOpen,
  PlayCircle,
  TrendingUp,
  Megaphone,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getLevel } from '@/lib/levels';

export const dynamic = 'force-dynamic';

function formatShort(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, nextEventRes, lessonsRes, pinnedRes, lastLessonRes] = await Promise.all([
    user
      ? supabase
          .from('profiles')
          .select('full_name, points')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('events')
      .select('id, title, description, event_type, start_time, meeting_url')
      .gte('start_time', new Date().toISOString())
      .eq('status', 'active')
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lessons')
      .select('id, is_published')
      .eq('is_published', true),
    supabase
      .from('community_posts')
      .select('id, title, content')
      .eq('is_pinned', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lessons')
      .select('id, title, description, created_at, modules(title, courses(title))')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as { full_name: string | null; points: number } | null;
  const nextEvent = nextEventRes.data as any;
  const allLessons = (lessonsRes.data ?? []) as any[];
  const pinned = pinnedRes.data as any;
  const lastLesson = lastLessonRes.data as any;

  let completedCount = 0;
  if (user) {
    const { data: prog } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('completed', true);
    const completedSet = new Set((prog ?? []).map((p: any) => p.lesson_id));
    completedCount = allLessons.filter((l) => completedSet.has(l.id)).length;
  }
  const totalLessons = allLessons.length;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'Closer';
  const level = getLevel(profile?.points ?? 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Bienvenido a tu sala"
        title={`Hola, ${firstName}.`}
        description="Tu plan de entrenamiento de hoy, próximos eventos y avances en un solo lugar."
        actions={
          <Link href="/classes" className="btn-gold">
            Ir a clases <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="card-premium md:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Próximo evento
          </p>
          {nextEvent ? (
            <>
              <h3 className="mt-2 text-xl font-semibold text-brand-text">
                {nextEvent.title}
              </h3>
              <p className="mt-1 text-xs text-brand-muted">{formatShort(nextEvent.start_time)}</p>
              {nextEvent.description && (
                <p className="mt-2 text-sm text-brand-muted">{nextEvent.description}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                {nextEvent.meeting_url ? (
                  <Link
                    href={nextEvent.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-gold"
                  >
                    Unirse <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                <Link href="/calendar" className="btn-ghost-gold">
                  Ver calendario
                </Link>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-xl font-semibold text-brand-text">
                Sin eventos programados
              </h3>
              <p className="mt-2 text-sm text-brand-muted">
                Pronto se cargarán nuevas mentorías y prácticas en vivo.
              </p>
              <div className="mt-5">
                <Link href="/calendar" className="btn-ghost-gold">
                  Ver calendario
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="card-premium">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Tu progreso
          </p>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-3xl font-semibold text-brand-text">{pct}%</span>
            <TrendingUp className="h-5 w-5 text-brand-gold" />
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
            <div
              className="h-full bg-gold-gradient transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-brand-muted">
            {totalLessons === 0
              ? 'Aún no hay clases publicadas.'
              : `${completedCount} de ${totalLessons} clases completadas · Nivel ${level.level} ${level.emoji}`}
          </p>
        </div>

        <div className="card-premium">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Última clase publicada
          </p>
          {lastLesson ? (
            <>
              <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
                <PlayCircle className="h-4 w-4 text-brand-gold" />
                {lastLesson.title}
              </h3>
              <p className="mt-1 text-xs text-brand-muted">
                {lastLesson.modules?.courses?.title} · {lastLesson.modules?.title}
              </p>
              <Link
                href={`/classes/${lastLesson.id}`}
                className="mt-4 inline-flex items-center gap-2 text-sm text-brand-gold hover:underline"
              >
                Ver clase <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-brand-muted">Aún no hay clases publicadas.</p>
          )}
        </div>

        <div className="card-premium">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Anuncio fijado
          </p>
          {pinned ? (
            <>
              <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
                <Megaphone className="h-4 w-4 text-brand-gold" />
                {pinned.title || 'Anuncio'}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm text-brand-muted">{pinned.content}</p>
              <Link
                href="/community"
                className="mt-4 inline-flex items-center gap-2 text-sm text-brand-gold hover:underline"
              >
                Ir a comunidad <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-brand-muted">
              Cuando un admin fije un post, aparecerá aquí.
            </p>
          )}
        </div>

        <div className="card-premium md:col-span-2 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
            Accesos rápidos
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { href: '/classes', label: 'Clases', icon: GraduationCap },
              { href: '/community', label: 'Comunidad', icon: Users },
              { href: '/calendar', label: 'Calendario', icon: Calendar },
              { href: '/resources', label: 'Recursos', icon: FolderOpen },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] px-3 py-3 text-sm text-brand-text transition hover:border-[rgba(212,175,55,0.45)] hover:text-brand-gold"
                >
                  <Icon className="h-4 w-4 text-brand-gold" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
