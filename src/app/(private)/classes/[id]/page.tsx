import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { parseVideoUrl } from '@/lib/video';
import { markLessonCompleteAction, markLessonIncompleteAction } from '../actions';
import { LessonComments } from '../_components/lesson-comments';
import { LessonNotes } from '../_components/lesson-notes';
import { LessonQuiz } from '../_components/lesson-quiz';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lesson } = await supabase
    .from('lessons')
    .select(
      'id, title, description, video_url, duration_minutes, order_index, is_locked, is_published, module_id, modules(id, title, course_id, courses(id, title))'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!lesson || !(lesson as any).is_published) notFound();
  const l = lesson as any;
  if (l.is_locked) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={l.modules?.courses?.title ?? 'Curso'}
          title={l.title}
          description="Esta clase está bloqueada por el momento."
        />
        <Link href="/classes" className="btn-ghost-gold">
          <ArrowLeft className="h-4 w-4" /> Volver a clases
        </Link>
      </div>
    );
  }

  // Hermanas del mismo módulo
  const { data: siblingsRaw } = await supabase
    .from('lessons')
    .select('id, title, order_index, is_published')
    .eq('module_id', l.module_id)
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  const siblings = (siblingsRaw ?? []) as Array<{ id: string; title: string; order_index: number }>;
  const idx = siblings.findIndex((s) => s.id === l.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  // Datos del usuario / clase en paralelo
  const [progressRes, commentsRes, noteRes, quizRes, roleRes] = await Promise.all([
    user
      ? supabase
          .from('lesson_progress')
          .select('completed')
          .eq('user_id', user.id)
          .eq('lesson_id', l.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('lesson_comments')
      .select('id, user_id, parent_id, content, created_at, profiles:user_id(full_name, avatar_url)')
      .eq('lesson_id', l.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(200),
    user
      ? supabase
          .from('lesson_notes')
          .select('content')
          .eq('user_id', user.id)
          .eq('lesson_id', l.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('quizzes')
      .select('id, title, description, passing_score, is_published')
      .eq('lesson_id', l.id)
      .eq('is_published', true)
      .maybeSingle(),
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const completed = !!(progressRes.data as any)?.completed;
  const comments = (commentsRes.data ?? []) as any[];
  const noteContent = ((noteRes.data as any)?.content as string) ?? '';
  const quiz = (quizRes.data as any) ?? null;
  const isAdmin = ((roleRes.data as any)?.role as string) === 'admin';

  let questions: any[] = [];
  let lastAttempt: any = null;
  if (quiz) {
    const { data: qs } = await supabase
      .from('quiz_questions')
      .select('id, prompt, options, correct_option_id, explanation, order_index')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true });
    questions = (qs ?? []) as any[];
    if (user) {
      const { data: att } = await supabase
        .from('quiz_attempts')
        .select('score, passed, answers')
        .eq('user_id', user.id)
        .eq('quiz_id', quiz.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastAttempt = (att as any) ?? null;
    }
  }

  const video = parseVideoUrl(l.video_url);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/classes"
        className="inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-gold"
      >
        <ArrowLeft className="h-3 w-3" /> Biblioteca de clases
      </Link>

      <PageHeader
        eyebrow={`${l.modules?.courses?.title ?? 'Curso'} · ${l.modules?.title ?? ''}`}
        title={l.title}
        description={l.description ?? undefined}
        actions={
          user ? (
            <form
              action={
                completed
                  ? markLessonIncompleteAction.bind(null, l.id)
                  : markLessonCompleteAction.bind(null, l.id)
              }
            >
              <button type="submit" className={completed ? 'btn-ghost-gold' : 'btn-gold'}>
                {completed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Completada
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" /> Marcar completada
                  </>
                )}
              </button>
            </form>
          ) : null
        }
      />

      <div className="card-premium overflow-hidden p-0">
        {video.kind === 'youtube' || video.kind === 'vimeo' ? (
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={video.src}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={l.title}
            />
          </div>
        ) : video.kind === 'file' ? (
          <video
            controls
            preload="metadata"
            className="aspect-video w-full bg-black"
            src={video.src}
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-[#0a0a0a] text-sm text-brand-muted">
            Esta clase aún no tiene video.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          {prev ? (
            <Link href={`/classes/${prev.id}`} className="btn-ghost-gold">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span />
          )}
        </div>
        <div>
          {next ? (
            <Link href={`/classes/${next.id}`} className="btn-gold">
              Siguiente <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {quiz && questions.length > 0 ? (
        <LessonQuiz
          quizId={quiz.id}
          title={quiz.title}
          description={quiz.description}
          passingScore={quiz.passing_score ?? 70}
          questions={questions}
          lastAttempt={lastAttempt}
        />
      ) : null}

      {user ? <LessonNotes lessonId={l.id} initialContent={noteContent} /> : null}

      <LessonComments
        lessonId={l.id}
        comments={comments}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
