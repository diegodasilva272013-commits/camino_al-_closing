'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function markLessonCompleteAction(lessonId: string): Promise<void> {
  if (!lessonId) return;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as any).from('lesson_progress').upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' }
  );

  revalidatePath('/classes');
  revalidatePath(`/classes/${lessonId}`);
  revalidatePath('/dashboard');
  revalidatePath('/profile');
}

export async function markLessonIncompleteAction(lessonId: string): Promise<void> {
  if (!lessonId) return;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as any)
    .from('lesson_progress')
    .update({ completed: false, completed_at: null })
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId);

  revalidatePath('/classes');
  revalidatePath(`/classes/${lessonId}`);
  revalidatePath('/dashboard');
}

// ---------- Comentarios de lección ----------
type CommentState = { ok?: boolean; error?: string };

export async function addLessonCommentAction(
  lessonId: string,
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const rl = checkRateLimit('lesson_comment.create', user.id, 10, 60_000);
  if (!rl.ok) return { error: rl.error ?? 'Demasiados comentarios.' };

  const content = String(formData.get('content') ?? '').trim();
  const parentId = String(formData.get('parent_id') ?? '').trim() || null;
  if (!content) return { error: 'Escribe algo' };
  if (content.length > 4000) return { error: 'Demasiado largo' };

  const { error } = await (supabase as any).from('lesson_comments').insert({
    lesson_id: lessonId,
    user_id: user.id,
    parent_id: parentId,
    content,
  });
  if (error) return { error: error.message };

  revalidatePath(`/classes/${lessonId}`);
  return { ok: true };
}

export async function deleteLessonCommentAction(
  commentId: string,
  lessonId: string
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase as any)
    .from('lesson_comments')
    .update({ is_deleted: true })
    .eq('id', commentId)
    .eq('user_id', user.id);
  revalidatePath(`/classes/${lessonId}`);
}

// ---------- Notas personales ----------
type NoteState = { ok?: boolean; error?: string };

export async function saveLessonNoteAction(
  lessonId: string,
  _prev: NoteState,
  formData: FormData
): Promise<NoteState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };
  const content = String(formData.get('content') ?? '');
  await (supabase as any).from('lesson_notes').upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' }
  );
  revalidatePath(`/classes/${lessonId}`);
  return { ok: true };
}

// ---------- Quiz submission ----------
type QuizState = {
  ok?: boolean;
  error?: string;
  score?: number;
  passed?: boolean;
};

export async function submitQuizAction(
  quizId: string,
  _prev: QuizState,
  formData: FormData
): Promise<QuizState> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { data: quiz } = await (supabase as any)
    .from('quizzes')
    .select('id, passing_score, lesson_id')
    .eq('id', quizId)
    .maybeSingle();
  if (!quiz) return { error: 'Quiz no encontrado' };

  const { data: questions } = await (supabase as any)
    .from('quiz_questions')
    .select('id, correct_option_id')
    .eq('quiz_id', quizId);
  const qs = (questions ?? []) as Array<{ id: string; correct_option_id: string }>;
  if (qs.length === 0) return { error: 'Quiz sin preguntas' };

  const answers: Record<string, string> = {};
  let correct = 0;
  for (const q of qs) {
    const ans = String(formData.get(`q:${q.id}`) ?? '');
    answers[q.id] = ans;
    if (ans && ans === q.correct_option_id) correct++;
  }
  const score = Math.round((correct / qs.length) * 100);
  const passed = score >= (quiz.passing_score ?? 70);

  await (supabase as any).from('quiz_attempts').insert({
    user_id: user.id,
    quiz_id: quizId,
    score,
    passed,
    answers,
  });

  if (quiz.lesson_id) revalidatePath(`/classes/${quiz.lesson_id}`);
  revalidatePath('/profile');
  return { ok: true, score, passed };
}
