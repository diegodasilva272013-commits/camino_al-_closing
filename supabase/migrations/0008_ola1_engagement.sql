-- =====================================================================
-- Camino al Closing — Migración 0008 (Ola 1)
-- Onboarding, streaks, badges, comentarios en lecciones, notas,
-- quizzes, certificados, audit logs, theme y búsqueda full-text.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- =====================================================================
-- 1. profiles: theme, streaks, onboarding
-- =====================================================================
alter table public.profiles
  add column if not exists theme text not null default 'dark' check (theme in ('dark','light','system')),
  add column if not exists current_streak int not null default 0,
  add column if not exists longest_streak int not null default 0,
  add column if not exists last_active_date date,
  add column if not exists onboarding_completed text[] not null default '{}'::text[];

-- =====================================================================
-- 2. Badges: catálogo + asignados a usuarios
-- =====================================================================
create table if not exists public.badges (
  code text primary key,
  title text not null,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);
create index if not exists user_badges_user_idx on public.user_badges(user_id);

-- Catálogo base (idempotente)
insert into public.badges (code, title, description, icon) values
  ('first_lesson', 'Primer paso', 'Completaste tu primera clase', 'play'),
  ('ten_lessons', 'Estudiante constante', 'Completaste 10 clases', 'graduation-cap'),
  ('first_post', 'Primera publicación', 'Hiciste tu primer post en la comunidad', 'message-square'),
  ('ten_comments', 'Conversador', 'Dejaste 10 comentarios', 'message-circle'),
  ('streak_7', 'Racha de 7 días', '7 días seguidos activo', 'flame'),
  ('streak_30', 'Racha de 30 días', '30 días seguidos activo', 'flame'),
  ('profile_complete', 'Perfil completo', 'Completaste tu perfil', 'user-check'),
  ('quiz_master', 'Aprobado', 'Aprobaste tu primer quiz', 'check-circle'),
  ('course_finisher', 'Curso completado', 'Terminaste un curso entero', 'award'),
  ('first_sale', 'Primera venta', 'Reportaste tu primera venta', 'dollar-sign')
on conflict (code) do nothing;

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "badges_read_all" on public.badges;
create policy "badges_read_all" on public.badges for select using (true);
drop policy if exists "badges_admin_write" on public.badges;
create policy "badges_admin_write" on public.badges for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "user_badges_read_all" on public.user_badges;
create policy "user_badges_read_all" on public.user_badges for select using (auth.role() = 'authenticated');
drop policy if exists "user_badges_admin_write" on public.user_badges;
create policy "user_badges_admin_write" on public.user_badges for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 3. Función: otorgar badge (idempotente, sin error si ya lo tiene)
-- =====================================================================
create or replace function public.grant_badge(p_user uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new boolean := false;
  v_title text;
begin
  insert into public.user_badges (user_id, badge_code) values (p_user, p_code)
    on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new then
    select title into v_title from public.badges where code = p_code;
    insert into public.notifications (user_id, type, title, body, link)
    values (p_user, 'system', '🏅 Nuevo logro: ' || coalesce(v_title, p_code), 'Lo desbloqueaste recién', '/profile');
  end if;
  return v_new;
end;
$$;

-- =====================================================================
-- 4. Comentarios en lecciones
-- =====================================================================
create table if not exists public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.lesson_comments(id) on delete cascade,
  content text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lesson_comments_lesson_idx on public.lesson_comments(lesson_id, created_at desc);

alter table public.lesson_comments enable row level security;
drop policy if exists "lesson_comments_select" on public.lesson_comments;
create policy "lesson_comments_select" on public.lesson_comments for select
  using (auth.role() = 'authenticated' and is_deleted = false);
drop policy if exists "lesson_comments_insert_own" on public.lesson_comments;
create policy "lesson_comments_insert_own" on public.lesson_comments for insert
  with check (auth.uid() = user_id);
drop policy if exists "lesson_comments_update_own" on public.lesson_comments;
create policy "lesson_comments_update_own" on public.lesson_comments for update
  using (auth.uid() = user_id);
drop policy if exists "lesson_comments_admin_all" on public.lesson_comments;
create policy "lesson_comments_admin_all" on public.lesson_comments for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop trigger if exists set_updated_at on public.lesson_comments;
create trigger set_updated_at before update on public.lesson_comments
  for each row execute procedure public.set_updated_at();

-- =====================================================================
-- 5. Notas personales por lección
-- =====================================================================
create table if not exists public.lesson_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_notes enable row level security;
drop policy if exists "lesson_notes_own" on public.lesson_notes;
create policy "lesson_notes_own" on public.lesson_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- 6. Quizzes
-- =====================================================================
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid unique references public.lessons(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  title text not null,
  description text,
  passing_score int not null default 70,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lesson_id is not null or module_id is not null)
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  options jsonb not null,           -- [{"id":"a","label":"texto"}, ...]
  correct_option_id text not null,  -- "a"
  explanation text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, order_index);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score int not null,            -- 0-100
  passed boolean not null,
  answers jsonb not null,        -- {question_id: option_id}
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id, created_at desc);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts(quiz_id);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "quizzes_read" on public.quizzes;
create policy "quizzes_read" on public.quizzes for select
  using (auth.role() = 'authenticated' and is_published = true);
drop policy if exists "quizzes_admin" on public.quizzes;
create policy "quizzes_admin" on public.quizzes for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "quiz_questions_read" on public.quiz_questions;
create policy "quiz_questions_read" on public.quiz_questions for select
  using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published)
  );
drop policy if exists "quiz_questions_admin" on public.quiz_questions;
create policy "quiz_questions_admin" on public.quiz_questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "quiz_attempts_own_read" on public.quiz_attempts;
create policy "quiz_attempts_own_read" on public.quiz_attempts for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "quiz_attempts_own_insert" on public.quiz_attempts;
create policy "quiz_attempts_own_insert" on public.quiz_attempts for insert
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at on public.quizzes;
create trigger set_updated_at before update on public.quizzes
  for each row execute procedure public.set_updated_at();

-- Auto-grant badge cuando se aprueba primer quiz + auto-completar lección
create or replace function public._on_quiz_attempt_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson uuid;
begin
  if new.passed then
    perform public.grant_badge(new.user_id, 'quiz_master');
    select lesson_id into v_lesson from public.quizzes where id = new.quiz_id;
    if v_lesson is not null then
      insert into public.lesson_progress (user_id, lesson_id, completed, completed_at)
      values (new.user_id, v_lesson, true, now())
      on conflict (user_id, lesson_id) do update set completed = true, completed_at = now();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_quiz_attempt_insert on public.quiz_attempts;
create trigger on_quiz_attempt_insert
  after insert on public.quiz_attempts
  for each row execute function public._on_quiz_attempt_insert();

-- =====================================================================
-- 7. Certificados
-- =====================================================================
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  code text not null unique default ('CAC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists certificates_user_idx on public.certificates(user_id);

alter table public.certificates enable row level security;
drop policy if exists "certificates_read_all" on public.certificates;
create policy "certificates_read_all" on public.certificates for select using (true);
drop policy if exists "certificates_admin_write" on public.certificates;
create policy "certificates_admin_write" on public.certificates for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "certificates_own_insert" on public.certificates;
create policy "certificates_own_insert" on public.certificates for insert
  with check (auth.uid() = user_id);

-- Función: emitir certificado SI completó 100% del curso
create or replace function public.try_issue_certificate(p_user uuid, p_course uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_done int;
  v_cert uuid;
  v_title text;
begin
  select count(*) into v_total
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.course_id = p_course and l.is_published;

  if v_total = 0 then return null; end if;

  select count(*) into v_done
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where m.course_id = p_course and lp.user_id = p_user and lp.completed;

  if v_done < v_total then return null; end if;

  insert into public.certificates (user_id, course_id) values (p_user, p_course)
    on conflict do nothing
    returning id into v_cert;

  if v_cert is not null then
    perform public.grant_badge(p_user, 'course_finisher');
    select title into v_title from public.courses where id = p_course;
    insert into public.notifications (user_id, type, title, body, link)
    values (p_user, 'system', '🎓 ¡Curso completado!', 'Obtuviste tu certificado de "' || coalesce(v_title,'curso') || '"', '/profile');
  end if;
  return v_cert;
end;
$$;

-- =====================================================================
-- 8. Streaks + auto-badges on lesson completion
-- =====================================================================
create or replace function public._on_lesson_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid;
  v_completed_count int;
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
  v_streak int;
  v_longest int;
begin
  if new.completed is true and (tg_op = 'INSERT' or coalesce(old.completed, false) = false) then
    -- 1. actualizar streak
    select last_active_date, current_streak, longest_streak
      into v_last, v_streak, v_longest
      from public.profiles where id = new.user_id;

    if v_last is null or v_last < v_today - interval '1 day' then
      v_streak := 1;
    elsif v_last = v_today - interval '1 day' then
      v_streak := coalesce(v_streak,0) + 1;
    end if;
    v_longest := greatest(coalesce(v_longest,0), v_streak);

    update public.profiles
      set last_active_date = v_today,
          current_streak = v_streak,
          longest_streak = v_longest
      where id = new.user_id;

    if v_streak >= 7  then perform public.grant_badge(new.user_id, 'streak_7');  end if;
    if v_streak >= 30 then perform public.grant_badge(new.user_id, 'streak_30'); end if;

    -- 2. badges por clases completadas
    select count(*) into v_completed_count
      from public.lesson_progress
      where user_id = new.user_id and completed = true;
    if v_completed_count = 1  then perform public.grant_badge(new.user_id, 'first_lesson'); end if;
    if v_completed_count >= 10 then perform public.grant_badge(new.user_id, 'ten_lessons'); end if;

    -- 3. intentar emitir certificado del curso al que pertenece
    select m.course_id into v_course
      from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = new.lesson_id;
    if v_course is not null then
      perform public.try_issue_certificate(new.user_id, v_course);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_lesson_progress_change on public.lesson_progress;
create trigger on_lesson_progress_change
  after insert or update on public.lesson_progress
  for each row execute function public._on_lesson_progress_change();

-- Badge por primer post / comentarios
create or replace function public._on_post_for_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  select count(*) into v_n from public.community_posts where user_id = new.user_id and is_deleted = false;
  if v_n = 1 then perform public.grant_badge(new.user_id, 'first_post'); end if;
  return new;
end;
$$;
drop trigger if exists on_post_for_badge on public.community_posts;
create trigger on_post_for_badge after insert on public.community_posts
  for each row execute function public._on_post_for_badge();

create or replace function public._on_comment_for_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  select count(*) into v_n from public.community_comments where user_id = new.user_id and is_deleted = false;
  if v_n >= 10 then perform public.grant_badge(new.user_id, 'ten_comments'); end if;
  return new;
end;
$$;
drop trigger if exists on_comment_for_badge on public.community_comments;
create trigger on_comment_for_badge after insert on public.community_comments
  for each row execute function public._on_comment_for_badge();

-- =====================================================================
-- 9. Admin audit logs
-- =====================================================================
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,           -- e.g. 'user.role_change', 'course.delete'
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs enable row level security;
drop policy if exists "audit_admin_only" on public.admin_audit_logs;
create policy "audit_admin_only" on public.admin_audit_logs for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 10. Full-text search (community_posts, lessons, resources, events)
-- =====================================================================
alter table public.community_posts
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,''))) stored;
create index if not exists community_posts_search_idx on public.community_posts using gin(search_vector);

alter table public.lessons
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,''))) stored;
create index if not exists lessons_search_idx on public.lessons using gin(search_vector);

alter table public.resources
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,''))) stored;
create index if not exists resources_search_idx on public.resources using gin(search_vector);

alter table public.events
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,''))) stored;
create index if not exists events_search_idx on public.events using gin(search_vector);

-- RPC: búsqueda global unificada
create or replace function public.global_search(p_query text, p_limit int default 8)
returns table (
  kind text,
  id text,
  title text,
  snippet text,
  link text,
  rank real,
  created_at timestamptz
)
language sql
stable
security invoker
as $$
  with q as (select plainto_tsquery('spanish', p_query) as tsq)
  select 'post' as kind, p.id::text, coalesce(p.title, left(p.content,80)) as title,
         left(p.content,160) as snippet, '/community' as link,
         ts_rank(p.search_vector, q.tsq) as rank, p.created_at
    from public.community_posts p, q
    where p.is_deleted = false and p.search_vector @@ q.tsq
  union all
  select 'lesson', l.id::text, l.title, coalesce(left(l.description,160),''), '/classes/'||l.id::text,
         ts_rank(l.search_vector, q.tsq), l.created_at
    from public.lessons l, q
    where l.is_published and l.search_vector @@ q.tsq
  union all
  select 'resource', r.id::text, r.title, coalesce(left(r.description,160),''), '/resources',
         ts_rank(r.search_vector, q.tsq), r.created_at
    from public.resources r, q
    where r.is_published and r.search_vector @@ q.tsq
  union all
  select 'event', e.id::text, e.title, coalesce(left(e.description,160),''), '/calendar',
         ts_rank(e.search_vector, q.tsq), e.created_at
    from public.events e, q
    where e.status = 'active' and e.search_vector @@ q.tsq
  order by rank desc, created_at desc
  limit p_limit;
$$;

-- =====================================================================
-- 11. Bucket storage: certificados (público de lectura)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do update set public = true;

do $$
declare bucket_name text := 'certificates';
begin
  execute format('drop policy if exists "%s_read_all" on storage.objects', bucket_name);
  execute format('drop policy if exists "%s_write_admin" on storage.objects', bucket_name);
  execute format('create policy "%s_read_all" on storage.objects for select using (bucket_id = %L)', bucket_name, bucket_name);
  execute format('create policy "%s_write_admin" on storage.objects for insert with check (bucket_id = %L and public.is_admin(auth.uid()))', bucket_name, bucket_name);
end $$;

-- =====================================================================
-- 12. Onboarding helper
-- =====================================================================
create or replace function public.complete_onboarding_step(p_user uuid, p_step text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set onboarding_completed = (
      select coalesce(array_agg(distinct s), '{}'::text[])
      from unnest(onboarding_completed || array[p_step]) s
    )
    where id = p_user;
end;
$$;

-- =====================================================================
-- FIN migración 0008
-- =====================================================================
