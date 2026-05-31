'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { submitQuizAction } from '../actions';

type Question = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  correct_option_id: string;
  explanation: string | null;
};

type LastAttempt = { score: number; passed: boolean; answers: Record<string, string> } | null;

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar respuestas'}
    </button>
  );
}

export function LessonQuiz({
  quizId,
  title,
  description,
  passingScore,
  questions,
  lastAttempt,
}: {
  quizId: string;
  title: string;
  description: string | null;
  passingScore: number;
  questions: Question[];
  lastAttempt: LastAttempt;
}) {
  const action = submitQuizAction.bind(null, quizId);
  const [state, formAction] = useFormState(action, {} as {
    ok?: boolean;
    error?: string;
    score?: number;
    passed?: boolean;
  });

  const showResult = state.ok && typeof state.score === 'number';
  const score = showResult ? state.score! : lastAttempt?.score;
  const passed = showResult ? !!state.passed : lastAttempt?.passed;

  return (
    <section className="card-premium space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">📝 {title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-brand-muted">{description}</p>
          ) : null}
          <p className="mt-1 text-xs text-brand-muted">
            Nota mínima para aprobar: {passingScore}%
          </p>
        </div>
        {typeof score === 'number' ? (
          <div
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              passed
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {score}% {passed ? '— Aprobado' : '— No aprobado'}
          </div>
        ) : null}
      </div>

      <form action={formAction} className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-lg border border-white/5 p-3">
            <p className="mb-2 text-sm font-medium text-white">
              {idx + 1}. {q.prompt}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt) => {
                const isCorrect = showResult && opt.id === q.correct_option_id;
                const userPicked = lastAttempt?.answers?.[q.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                      isCorrect ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q:${q.id}`}
                      value={opt.id}
                      defaultChecked={userPicked}
                      required
                      className="accent-brand-gold"
                    />
                    <span className="text-white/90">{opt.label}</span>
                  </label>
                );
              })}
            </div>
            {showResult && q.explanation ? (
              <p className="mt-2 text-xs text-brand-muted">💡 {q.explanation}</p>
            ) : null}
          </div>
        ))}

        {state.error ? (
          <p className="text-xs text-red-400">{state.error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {lastAttempt && !showResult ? (
            <p className="text-xs text-brand-muted">
              Último intento: {lastAttempt.score}% — podés reintentarlo.
            </p>
          ) : (
            <span />
          )}
          <SubmitBtn />
        </div>
      </form>
    </section>
  );
}
