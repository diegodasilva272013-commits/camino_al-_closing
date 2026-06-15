import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { PlayCircle, CheckCircle2, Lock } from 'lucide-react';
import { ContentLocked } from '@/components/ui/content-locked';

export const dynamic = 'force-dynamic';

export default async function ClassesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role, content_unlocked')
    .eq('id', user?.id ?? '')
    .maybeSingle();
  const profile = profileRaw as { content_unlocked: boolean; role: string } | null;

  if (!profile?.content_unlocked && profile?.role !== 'admin') {
    return <ContentLocked section="Las clases" />;
  }

  const { data: coursesRaw } = await supabase
    .from('courses')
    .select(
      'id, title, description, cover_image_url, is_published, modules(id, title, description, order_index, lessons(id, title, description, video_url, duration_minutes, order_index, is_locked, is_published))'
    )
    .eq('is_published', true)
    .order('created_at', { ascending: true });

  const courses = (coursesRaw ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    modules: Array<{
      id: string;
      title: string;
      description: string | null;
      order_index: number;
      lessons: Array<{
        id: string;
        title: string;
        description: string | null;
        video_url: string | null;
        duration_minutes: number | null;
        order_index: number;
        is_locked: boolean;
        is_published: boolean;
      }>;
    }>;
  }>;

  let completedSet = new Set<string>();
  if (user) {
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', user.id)
      .eq('completed', true);
    completedSet = new Set((progress ?? []).map((p: any) => p.lesson_id));
  }

  let totalLessons = 0;
  let totalCompleted = 0;
  for (const c of courses) {
    for (const m of c.modules ?? []) {
      const lessons = (m.lessons ?? []).filter((l) => l.is_published);
      totalLessons += lessons.length;
      totalCompleted += lessons.filter((l) => completedSet.has(l.id)).length;
    }
  }
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Biblioteca de clases"
        title="Tus entrenamientos"
        description="Cursos, módulos y clases con progreso por usuario."
      />

      {totalLessons > 0 && (
        <div className="card-premium mb-8">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
              Progreso general
            </p>
            <span className="text-sm font-semibold text-brand-text">
              {totalCompleted} / {totalLessons} clases
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
            <div
              className="h-full bg-gold-gradient transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="card-premium text-center">
          <p className="text-sm text-brand-text">Aún no hay cursos publicados.</p>
          <p className="mt-1 text-xs text-brand-muted">
            El admin puede publicar cursos desde el panel.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {courses.map((course) => {
            const modules = (course.modules ?? []).sort(
              (a, b) => a.order_index - b.order_index
            );
            return (
              <section key={course.id}>
                <h2 className="mb-1 text-xl font-semibold text-brand-text">
                  {course.title}
                </h2>
                {course.description && (
                  <p className="mb-5 max-w-2xl text-sm text-brand-muted">
                    {course.description}
                  </p>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {modules.map((mod, mIdx) => {
                    const lessons = (mod.lessons ?? [])
                      .filter((l) => l.is_published)
                      .sort((a, b) => a.order_index - b.order_index);
                    const done = lessons.filter((l) => completedSet.has(l.id)).length;
                    const pct =
                      lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;

                    return (
                      <div key={mod.id} className="card-premium">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
                          Módulo {mIdx + 1}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-brand-text">
                          {mod.title}
                        </h3>
                        {mod.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-brand-muted">
                            {mod.description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between text-xs">
                          <span className="text-brand-muted">
                            {done} / {lessons.length} clases
                          </span>
                          <span className="text-brand-gold">{pct}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
                          <div
                            className="h-full bg-gold-gradient transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <ul className="mt-4 space-y-1">
                          {lessons.length === 0 ? (
                            <li className="text-xs text-brand-muted">
                              Aún no hay clases publicadas en este módulo.
                            </li>
                          ) : (
                            lessons.map((l) => {
                              const completed = completedSet.has(l.id);
                              const locked = l.is_locked;
                              return (
                                <li key={l.id}>
                                  <Link
                                    href={locked ? '#' : `/classes/${l.id}`}
                                    className={
                                      'flex items-center gap-2 rounded px-2 py-1.5 text-xs transition ' +
                                      (locked
                                        ? 'cursor-not-allowed text-brand-muted/70'
                                        : 'text-brand-text hover:bg-[#161616] hover:text-brand-gold')
                                    }
                                  >
                                    {locked ? (
                                      <Lock className="h-3 w-3 shrink-0" />
                                    ) : completed ? (
                                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                                    ) : (
                                      <PlayCircle className="h-3 w-3 shrink-0 text-brand-gold" />
                                    )}
                                    <span className="flex-1 truncate">{l.title}</span>
                                    {l.duration_minutes && (
                                      <span className="text-[10px] text-brand-muted">
                                        {l.duration_minutes} min
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
