'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function markLessonCompleteAction(lessonId: string): Promise<void> {
  if (!lessonId) return;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('id, completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (existing) {
    await (supabase as any)
      .from('lesson_progress')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', (existing as any).id);
  } else {
    await (supabase as any).from('lesson_progress').insert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    });
  }

  revalidatePath('/classes');
  revalidatePath(`/classes/${lessonId}`);
  revalidatePath('/dashboard');
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
