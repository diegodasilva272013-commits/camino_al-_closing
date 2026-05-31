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
import {
  OnboardingChecklist,
  type ChecklistStep,
} from './_components/onboarding-checklist';

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
          .select('full_name, points, bio, avatar_url, onboarding_completed, current_streak')
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

  const profile = profileRes.data as {
    full_name: string | null;
    points: number;
    bio: string | null;
    avatar_url: string | null;
    onboarding_completed: string[] | null;
    current_streak: number | null;
  } | null;
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

  // ---- Onboarding checklist ----
  const ob = new Set(profile?.onboarding_completed ?? []);
  // Auto-detect: si el usuario ya completó cosas reales, marcamos los pasos correspondientes
  const profileDone =
    ob.has('profile') ||
    (!!profile?.full_name && profile.full_name.trim().length > 1 && (profile.avatar_url || profile.bio));
  const firstLessonDone = ob.has('first_lesson') || completedCount >= 1;
  // Hace falta saber si publicó algo / unió chat
  let firstPostDone = ob.has('first_post');
  let joinedChatDone = ob.has('joined_chat');
  if (user) {
    const [{ count: pCount }, { count: cmCount }] = await Promise.all([
      supabase
        .from('community_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_deleted', false),
      supabase
        .from('chat_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);
    if ((pCount ?? 0) > 0) firstPostDone = true;
    if ((cmCount ?? 0) > 0) joinedChatDone = true;
  }
  const checklist: ChecklistStep[] = [
    {
      key: 'profile',
      label: 'Completá tu perfil',
      description: 'Foto, nombre y una breve bio',
      href: '/profile',
      done: !!profileDone,
    },
    {
      key: 'first_lesson',
      label: 'Mirá tu primera clase',
      description: 'Activá tu progreso',
      href: '/classes',
      done: firstLessonDone,
    },
    {
      key: 'first_post',
      label: 'Presentate en la comunidad',
      description: 'Tu primer post',
      href: '/community',
      done: firstPostDone,
    },
    {
      key: 'joined_chat',
      label: 'Entrá al chat',
      description: 'Conectá con otros',
      href: '/chat',
      done: joinedChatDone,
    },
  ];

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
        <OnboardingChecklist steps={checklist} />
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
