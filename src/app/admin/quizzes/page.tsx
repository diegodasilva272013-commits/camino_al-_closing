import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/current-user';
import {
  saveQuizAction,
  deleteQuizAction,
  saveQuizQuestionAction,
  deleteQuizQuestionAction,
} from '@/app/admin/actions';
import { QuizForm, QuestionForm, DeleteButton } from './_components';

export const dynamic = 'force-dynamic';

type Lesson = { id: string; title: string };
type Quiz = {
  id: string;
  title: string;
  description: string | null;
  lesson_id: string | null;
  module_id: string | null;
  passing_score: number;
  created_at: string;
};
type Question = {
  id: string;
  quiz_id: string;
  prompt: string;
  options: { id: string; label: string }[];
  correct_option_id: string;
  explanation: string | null;
  order_index: number;
};

export default async function AdminQuizzesPage() {
  await requireAdmin();
  const supabase = createSupabaseServerClient();

  const [quizzesRes, questionsRes, lessonsRes] = await Promise.all([
    (supabase as any).from('quizzes').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('quiz_questions').select('*').order('order_index', { ascending: true }),
    supabase.from('lessons').select('id, title').order('order_index', { ascending: true }),
  ]);

  const quizzes = ((quizzesRes.data as Quiz[]) ?? []);
  const questions = ((questionsRes.data as Question[]) ?? []);
  const lessons = ((lessonsRes.data as Lesson[]) ?? []);
  const lessonMap: Record<string, string> = {};
  for (const l of lessons) lessonMap[l.id] = l.title;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Quizzes"
        description={`${quizzes.length} quizzes — gestiona evaluaciones por lección.`}
      />

      <section className="card-premium">
        <h2 className="mb-4 text-lg font-semibold text-brand-text">Crear nuevo quiz</h2>
        <QuizForm action={saveQuizAction} lessons={lessons} />
      </section>

      <div className="space-y-6">
        {quizzes.map((quiz) => {
          const qs = questions.filter((q) => q.quiz_id === quiz.id);
          return (
            <section key={quiz.id} className="card-premium">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-brand-text">{quiz.title}</h3>
                  <p className="text-xs text-brand-muted">
                    Lección: {quiz.lesson_id ? lessonMap[quiz.lesson_id] ?? quiz.lesson_id.slice(0, 8) : '—'}
                    {' · '}Aprobar: {quiz.passing_score}%{' · '}Preguntas: {qs.length}
                  </p>
                  {quiz.description && (
                    <p className="mt-1 text-sm text-brand-muted">{quiz.description}</p>
                  )}
                </div>
                <DeleteButton id={quiz.id} action={deleteQuizAction} label="Eliminar quiz" />
              </div>

              <div className="mt-4 space-y-3">
                {qs.map((q) => (
                  <div
                    key={q.id}
                    className="rounded border border-white/5 bg-[#0a0a0a] p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-brand-text">
                          <span className="text-brand-gold">#{q.order_index}</span> {q.prompt}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {q.options.map((o) => (
                            <li
                              key={o.id}
                              className={
                                o.id === q.correct_option_id
                                  ? 'text-green-400'
                                  : 'text-brand-muted'
                              }
                            >
                              {o.id === q.correct_option_id ? '✓ ' : '· '}
                              <span className="font-mono">[{o.id}]</span> {o.label}
                            </li>
                          ))}
                        </ul>
                        {q.explanation && (
                          <p className="mt-1 text-[11px] italic text-brand-muted">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                      <DeleteButton
                        id={q.id}
                        action={deleteQuizQuestionAction}
                        label="Eliminar"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-brand-gold">
                  + Agregar pregunta
                </summary>
                <div className="mt-3">
                  <QuestionForm action={saveQuizQuestionAction} quizId={quiz.id} />
                </div>
              </details>
            </section>
          );
        })}

        {quizzes.length === 0 && (
          <p className="text-center text-brand-muted">Aún no hay quizzes.</p>
        )}
      </div>
    </div>
  );
}
