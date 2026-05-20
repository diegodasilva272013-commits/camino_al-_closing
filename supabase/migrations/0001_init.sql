-- =====================================================================
-- Camino al Closing — Comunidad Privada
-- Migración inicial: schema, función de perfil, helper de admin y RLS.
-- Pegar este archivo COMPLETO en Supabase → SQL Editor → Run.
-- Es idempotente: se puede correr varias veces sin romper nada.
-- =====================================================================

-- Extensiones ----------------------------------------------------------
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. Tablas
-- =====================================================================

-- 1.1 profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  bio text,
  role text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.2 courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.3 modules
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists modules_course_id_idx on public.modules(course_id);

-- 1.4 lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  duration_minutes int,
  order_index int not null default 0,
  is_locked boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_module_id_idx on public.lessons(module_id);

-- 1.5 lesson_progress
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

-- 1.6 community_posts
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  content text not null,
  image_url text,
  is_pinned boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_created_at_idx on public.community_posts(created_at desc);
create index if not exists community_posts_category_idx on public.community_posts(category);

-- 1.7 community_comments
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_comments_post_id_idx on public.community_comments(post_id);

-- 1.8 post_likes
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

-- 1.9 events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null check (event_type in ('live_class', 'practice', 'mentoring', 'review', 'launch', 'roleplay')),
  start_time timestamptz not null,
  end_time timestamptz,
  meeting_url text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_start_time_idx on public.events(start_time);

-- 1.10 resources
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text,
  external_url text,
  category text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists resources_category_idx on public.resources(category);

-- =====================================================================
-- 2. Funciones
-- =====================================================================

-- 2.1 Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 2.2 Helper para validar admin (security definer evita recursion en RLS)
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

-- 2.3 Trigger genérico para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','courses','modules','lessons',
      'community_posts','community_comments','events','resources'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute procedure public.set_updated_at()', t
    );
  end loop;
end $$;

-- =====================================================================
-- 3. Row Level Security
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.courses             enable row level security;
alter table public.modules             enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.community_posts     enable row level security;
alter table public.community_comments  enable row level security;
alter table public.post_likes          enable row level security;
alter table public.events              enable row level security;
alter table public.resources           enable row level security;

-- 3.1 profiles
drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
on public.profiles for select
using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.2 courses
drop policy if exists "courses_select_published" on public.courses;
create policy "courses_select_published"
on public.courses for select
using (auth.role() = 'authenticated' and is_published = true);

drop policy if exists "courses_admin_all" on public.courses;
create policy "courses_admin_all"
on public.courses for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.3 modules
drop policy if exists "modules_select_authenticated" on public.modules;
create policy "modules_select_authenticated"
on public.modules for select
using (auth.role() = 'authenticated');

drop policy if exists "modules_admin_all" on public.modules;
create policy "modules_admin_all"
on public.modules for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.4 lessons
drop policy if exists "lessons_select_published" on public.lessons;
create policy "lessons_select_published"
on public.lessons for select
using (auth.role() = 'authenticated' and is_published = true);

drop policy if exists "lessons_admin_all" on public.lessons;
create policy "lessons_admin_all"
on public.lessons for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.5 lesson_progress
drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
create policy "lesson_progress_select_own"
on public.lesson_progress for select
using (auth.uid() = user_id);

drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
create policy "lesson_progress_insert_own"
on public.lesson_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "lesson_progress_update_own" on public.lesson_progress;
create policy "lesson_progress_update_own"
on public.lesson_progress for update
using (auth.uid() = user_id);

drop policy if exists "lesson_progress_admin_select" on public.lesson_progress;
create policy "lesson_progress_admin_select"
on public.lesson_progress for select
using (public.is_admin(auth.uid()));

-- 3.6 community_posts
drop policy if exists "posts_select_visible" on public.community_posts;
create policy "posts_select_visible"
on public.community_posts for select
using (auth.role() = 'authenticated' and is_deleted = false);

drop policy if exists "posts_insert_own" on public.community_posts;
create policy "posts_insert_own"
on public.community_posts for insert
with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.community_posts;
create policy "posts_update_own"
on public.community_posts for update
using (auth.uid() = user_id);

drop policy if exists "posts_admin_all" on public.community_posts;
create policy "posts_admin_all"
on public.community_posts for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.7 community_comments
drop policy if exists "comments_select_visible" on public.community_comments;
create policy "comments_select_visible"
on public.community_comments for select
using (auth.role() = 'authenticated' and is_deleted = false);

drop policy if exists "comments_insert_own" on public.community_comments;
create policy "comments_insert_own"
on public.community_comments for insert
with check (auth.uid() = user_id);

drop policy if exists "comments_update_own" on public.community_comments;
create policy "comments_update_own"
on public.community_comments for update
using (auth.uid() = user_id);

drop policy if exists "comments_admin_all" on public.community_comments;
create policy "comments_admin_all"
on public.community_comments for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.8 post_likes
drop policy if exists "likes_select_authenticated" on public.post_likes;
create policy "likes_select_authenticated"
on public.post_likes for select
using (auth.role() = 'authenticated');

drop policy if exists "likes_insert_own" on public.post_likes;
create policy "likes_insert_own"
on public.post_likes for insert
with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.post_likes;
create policy "likes_delete_own"
on public.post_likes for delete
using (auth.uid() = user_id);

-- 3.9 events
drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated"
on public.events for select
using (auth.role() = 'authenticated');

drop policy if exists "events_admin_all" on public.events;
create policy "events_admin_all"
on public.events for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3.10 resources
drop policy if exists "resources_select_published" on public.resources;
create policy "resources_select_published"
on public.resources for select
using (auth.role() = 'authenticated' and is_published = true);

drop policy if exists "resources_admin_all" on public.resources;
create policy "resources_admin_all"
on public.resources for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
