'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/current-user';
import { logAdminAction } from '@/lib/audit';
import { COMMUNITY_CATEGORIES, RESOURCE_CATEGORIES, EVENT_TYPES } from '@/constants/categories';

export type AdminState = { ok?: boolean; error?: string };

function clean(v: FormDataEntryValue | null, max = 500): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === 'on' || v === 'true' || v === '1';
}

// =====================================================================
// USERS
// =====================================================================

export async function updateUserRoleAction(
  userId: string,
  role: 'student' | 'mentor' | 'admin'
): Promise<void> {
  const ctx = await requireAdmin();
  if (!['student', 'mentor', 'admin'].includes(role)) return;
  const supabase = createSupabaseServerClient();
  await (supabase as any)
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);
  await logAdminAction({
    adminId: ctx.userId,
    action: 'user.role_change',
    targetType: 'user',
    targetId: userId,
    metadata: { new_role: role },
  });
  revalidatePath('/admin/users');
}

export async function deleteUserAction(userId: string): Promise<{ error?: string }> {
  const ctx = await requireAdmin();
  if (!userId) return { error: 'ID requerido' };
  if (userId === ctx.userId) return { error: 'No podés borrar tu propia cuenta' };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  await logAdminAction({
    adminId: ctx.userId,
    action: 'user.delete',
    targetType: 'user',
    targetId: userId,
  });
  revalidatePath('/admin/users');
  return {};
}

export async function adjustUserPointsAction(
  userId: string,
  delta: number
): Promise<void> {
  const ctx = await requireAdmin();
  if (!Number.isFinite(delta) || delta === 0) return;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .maybeSingle();
  const current = (data as any)?.points ?? 0;
  const next = Math.max(0, current + delta);
  await (supabase as any)
    .from('profiles')
    .update({ points: next, updated_at: new Date().toISOString() })
    .eq('id', userId);
  await logAdminAction({
    adminId: ctx.userId,
    action: 'user.points_adjust',
    targetType: 'user',
    targetId: userId,
    metadata: { delta, previous: current, next },
  });
  revalidatePath('/admin/users');
  revalidatePath('/leaderboard');
}

// =====================================================================
// COURSES
// =====================================================================

export async function saveCourseAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
  const id = clean(formData.get('id'));
  const title = clean(formData.get('title'), 120);
  const description = clean(formData.get('description'), 2000);
  const cover = clean(formData.get('cover_image_url'), 500);
  const is_published = bool(formData.get('is_published'));
  if (!title) return { error: 'El título es obligatorio.' };

  const supabase = createSupabaseServerClient();
  const payload: any = { title, description, cover_image_url: cover, is_published };

  if (id) {
    const { error } = await (supabase as any).from('courses').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await (supabase as any).from('courses').insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath('/admin/courses');
  revalidatePath('/classes');
  return { ok: true };
}

export async function deleteCourseAction(id: string): Promise<void> {
  const ctx = await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('courses').delete().eq('id', id);
  await logAdminAction({ adminId: ctx.userId, action: 'course.delete', targetType: 'course', targetId: id });
  revalidatePath('/admin/courses');
  revalidatePath('/classes');
}

// =====================================================================
// MODULES
// =====================================================================

export async function saveModuleAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
  const id = clean(formData.get('id'));
  const course_id = clean(formData.get('course_id'));
  const title = clean(formData.get('title'), 120);
  const description = clean(formData.get('description'), 2000);
  const order_index = Number(formData.get('order_index') ?? 0) || 0;
  if (!course_id) return { error: 'Curso requerido.' };
  if (!title) return { error: 'Título requerido.' };

  const supabase = createSupabaseServerClient();
  const payload: any = { course_id, title, description, order_index };
  if (id) {
    const { error } = await (supabase as any).from('modules').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await (supabase as any).from('modules').insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath('/admin/modules');
  revalidatePath('/classes');
  return { ok: true };
}

export async function deleteModuleAction(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('modules').delete().eq('id', id);
  revalidatePath('/admin/modules');
  revalidatePath('/classes');
}

// =====================================================================
// LESSONS (CLASSES)
// =====================================================================

export async function saveLessonAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
  const id = clean(formData.get('id'));
  const module_id = clean(formData.get('module_id'));
  const title = clean(formData.get('title'), 200);
  const description = clean(formData.get('description'), 4000);
  const video_url = clean(formData.get('video_url'), 500);
  const duration_minutes = Number(formData.get('duration_minutes') ?? 0) || null;
  const order_index = Number(formData.get('order_index') ?? 0) || 0;
  const is_locked = bool(formData.get('is_locked'));
  const is_published = bool(formData.get('is_published'));
  if (!module_id) return { error: 'Módulo requerido.' };
  if (!title) return { error: 'Título requerido.' };

  const supabase = createSupabaseServerClient();
  const payload: any = {
    module_id,
    title,
    description,
    video_url,
    duration_minutes,
    order_index,
    is_locked,
    is_published,
  };
  if (id) {
    const { error } = await (supabase as any).from('lessons').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await (supabase as any).from('lessons').insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath('/admin/classes');
  revalidatePath('/classes');
  return { ok: true };
}

export async function deleteLessonAction(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('lessons').delete().eq('id', id);
  revalidatePath('/admin/classes');
  revalidatePath('/classes');
}

// =====================================================================
// EVENTS
// =====================================================================

export async function saveEventAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
  const id = clean(formData.get('id'));
  const title = clean(formData.get('title'), 200);
  const description = clean(formData.get('description'), 4000);
  const event_type = clean(formData.get('event_type'));
  const start_time_raw = clean(formData.get('start_time'));
  const end_time_raw = clean(formData.get('end_time'));
  const meeting_url = clean(formData.get('meeting_url'), 500);
  const status = (clean(formData.get('status')) ?? 'active') as 'active' | 'cancelled' | 'finished';

  if (!title) return { error: 'Título requerido.' };
  if (!event_type || !(event_type in EVENT_TYPES)) {
    return { error: 'Tipo de evento inválido.' };
  }
  if (!start_time_raw) return { error: 'Fecha de inicio requerida.' };
  const start_time = new Date(start_time_raw).toISOString();
  const end_time = end_time_raw ? new Date(end_time_raw).toISOString() : null;
  if (!['active', 'cancelled', 'finished'].includes(status)) {
    return { error: 'Estado inválido.' };
  }

  const supabase = createSupabaseServerClient();
  const payload: any = {
    title,
    description,
    event_type,
    start_time,
    end_time,
    meeting_url,
    status,
  };
  if (id) {
    const { error } = await (supabase as any).from('events').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await (supabase as any).from('events').insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath('/admin/events');
  revalidatePath('/calendar');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteEventAction(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('events').delete().eq('id', id);
  revalidatePath('/admin/events');
  revalidatePath('/calendar');
}

// =====================================================================
// RESOURCES
// =====================================================================

const RESOURCES_BUCKET = 'resources';
const MAX_RESOURCE_BYTES = 100 * 1024 * 1024; // 100 MB

export async function saveResourceAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
  const id = clean(formData.get('id'));
  const title = clean(formData.get('title'), 200);
  const description = clean(formData.get('description'), 4000);
  const category = clean(formData.get('category'));
  const external_url = clean(formData.get('external_url'), 500);
  const is_published = bool(formData.get('is_published'));
  const file = formData.get('file') as File | null;

  if (!title) return { error: 'Título requerido.' };
  if (!category || !(RESOURCE_CATEGORIES as readonly string[]).includes(category)) {
    return { error: 'Categoría inválida.' };
  }

  const supabase = createSupabaseServerClient();
  let file_url: string | null = null;

  if (file && file.size > 0) {
    if (file.size > MAX_RESOURCE_BYTES) {
      return { error: 'El archivo supera 100 MB.' };
    }
    const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(RESOURCES_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
    if (upErr) return { error: `Error subiendo: ${upErr.message}` };
    const { data: pub } = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
    file_url = pub.publicUrl;
  }

  const payload: any = {
    title,
    description,
    category,
    external_url,
    is_published,
  };
  if (file_url) payload.file_url = file_url;

  if (id) {
    const { error } = await (supabase as any).from('resources').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await (supabase as any)
      .from('resources')
      .insert({ ...payload, file_url: file_url ?? null });
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/resources');
  revalidatePath('/resources');
  return { ok: true };
}

export async function deleteResourceAction(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('resources').delete().eq('id', id);
  revalidatePath('/admin/resources');
  revalidatePath('/resources');
}

// =====================================================================
// COMMUNITY MODERATION
// =====================================================================

export async function moderatorDeletePostAction(postId: string): Promise<void> {
  await requireAdmin();
  if (!postId) return;
  const supabase = createSupabaseServerClient();
  await (supabase as any)
    .from('community_posts')
    .update({ is_deleted: true })
    .eq('id', postId);
  revalidatePath('/admin/community');
  revalidatePath('/community');
}

export async function moderatorRestorePostAction(postId: string): Promise<void> {
  await requireAdmin();
  if (!postId) return;
  const supabase = createSupabaseServerClient();
  await (supabase as any)
    .from('community_posts')
    .update({ is_deleted: false })
    .eq('id', postId);
  revalidatePath('/admin/community');
  revalidatePath('/community');
}

export async function moderatorTogglePinAction(
  postId: string,
  pinned: boolean
): Promise<void> {
  await requireAdmin();
  if (!postId) return;
  const supabase = createSupabaseServerClient();
  await (supabase as any)
    .from('community_posts')
    .update({ is_pinned: pinned })
    .eq('id', postId);
  revalidatePath('/admin/community');
  revalidatePath('/community');
  revalidatePath('/dashboard');
}

export async function moderatorDeleteCommentAction(commentId: string): Promise<void> {
  await requireAdmin();
  if (!commentId) return;
  const supabase = createSupabaseServerClient();
  await (supabase as any)
    .from('community_comments')
    .update({ is_deleted: true })
    .eq('id', commentId);
  revalidatePath('/admin/community');
  revalidatePath('/community');
}

// =====================================================================
// QUIZZES
// =====================================================================

export async function saveQuizAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const ctx = await requireAdmin();
  const id = clean(formData.get('id'));
  const title = clean(formData.get('title'), 200);
  const description = clean(formData.get('description'), 1000);
  const lesson_id = clean(formData.get('lesson_id'));
  const module_id = clean(formData.get('module_id'));
  const pass_score_raw = clean(formData.get('passing_score')) ?? clean(formData.get('pass_score'));
  const passing_score = pass_score_raw ? Math.max(0, Math.min(100, parseInt(pass_score_raw, 10) || 70)) : 70;
  if (!title) return { error: 'El título es obligatorio.' };
  if (!lesson_id && !module_id) return { error: 'Debes asociar el quiz a una lección o módulo.' };

  const supabase = createSupabaseServerClient();
  const payload: any = { title, description, lesson_id, module_id, passing_score };

  if (id) {
    const { error } = await (supabase as any).from('quizzes').update(payload).eq('id', id);
    if (error) return { error: error.message };
    await logAdminAction({ adminId: ctx.userId, action: 'quiz.update', targetType: 'quiz', targetId: id });
  } else {
    const { data, error } = await (supabase as any).from('quizzes').insert(payload).select('id').single();
    if (error) return { error: error.message };
    await logAdminAction({ adminId: ctx.userId, action: 'quiz.create', targetType: 'quiz', targetId: data?.id });
  }
  revalidatePath('/admin/quizzes');
  return { ok: true };
}

export async function deleteQuizAction(id: string): Promise<void> {
  const ctx = await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('quizzes').delete().eq('id', id);
  await logAdminAction({ adminId: ctx.userId, action: 'quiz.delete', targetType: 'quiz', targetId: id });
  revalidatePath('/admin/quizzes');
}

export async function saveQuizQuestionAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const ctx = await requireAdmin();
  const id = clean(formData.get('id'));
  const quiz_id = clean(formData.get('quiz_id'));
  const prompt = clean(formData.get('prompt'), 1000) ?? clean(formData.get('question'), 1000);
  const explanation = clean(formData.get('explanation'), 1000);
  const order_raw = clean(formData.get('order_index'));
  const order_index = order_raw ? parseInt(order_raw, 10) || 0 : 0;
  const optionsRaw = clean(formData.get('options'), 4000);
  const correct = clean(formData.get('correct_option_id'), 50);
  if (!quiz_id || !prompt || !optionsRaw || !correct) {
    return { error: 'Faltan campos obligatorios.' };
  }
  let options: { id: string; label: string }[] = [];
  try {
    const parsed = JSON.parse(optionsRaw);
    if (!Array.isArray(parsed)) throw new Error('Opciones deben ser un array.');
    options = parsed
      .map((o: any) => ({ id: String(o.id ?? '').trim(), label: String(o.label ?? '').trim() }))
      .filter((o) => o.id && o.label);
  } catch {
    return { error: 'Las opciones deben ser JSON válido: [{"id":"a","label":"..."}]' };
  }
  if (options.length < 2) return { error: 'Mínimo 2 opciones.' };
  if (!options.some((o) => o.id === correct)) return { error: 'El id correcto no está en las opciones.' };

  const supabase = createSupabaseServerClient();
  const payload: any = { quiz_id, prompt, explanation, options, correct_option_id: correct, order_index };
  if (id) {
    const { error } = await (supabase as any).from('quiz_questions').update(payload).eq('id', id);
    if (error) return { error: error.message };
    await logAdminAction({ adminId: ctx.userId, action: 'quiz_question.update', targetType: 'quiz_question', targetId: id });
  } else {
    const { error } = await (supabase as any).from('quiz_questions').insert(payload);
    if (error) return { error: error.message };
    await logAdminAction({ adminId: ctx.userId, action: 'quiz_question.create', targetType: 'quiz', targetId: quiz_id });
  }
  revalidatePath('/admin/quizzes');
  return { ok: true };
}

export async function deleteQuizQuestionAction(id: string): Promise<void> {
  const ctx = await requireAdmin();
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from('quiz_questions').delete().eq('id', id);
  await logAdminAction({ adminId: ctx.userId, action: 'quiz_question.delete', targetType: 'quiz_question', targetId: id });
  revalidatePath('/admin/quizzes');
}
