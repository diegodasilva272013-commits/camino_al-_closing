-- =====================================================================
-- Camino al Closing — Perfiles enriquecidos + sistema de puntos/niveles.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Columnas adicionales en profiles -----------------------------------
alter table public.profiles
  add column if not exists points int not null default 0,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists is_public boolean not null default true;

create index if not exists profiles_points_idx on public.profiles(points desc);

-- 2. Función helper: nivel a partir de puntos --------------------------
-- 10 niveles. Thresholds elegidos para que progresar requiera aportes
-- consistentes (likes recibidos + posts/comentarios).
create or replace function public.community_level(p_points int)
returns int
language sql
immutable
as $$
  select case
    when p_points >= 8000 then 10
    when p_points >= 5500 then 9
    when p_points >= 3500 then 8
    when p_points >= 2000 then 7
    when p_points >= 1200 then 6
    when p_points >= 700  then 5
    when p_points >= 350  then 4
    when p_points >= 150  then 3
    when p_points >= 50   then 2
    else 1
  end;
$$;

-- 3. Triggers de puntos ------------------------------------------------
-- Reglas:
--   • +5 por crear un post
--   • +2 por crear un comentario
--   • +1 por cada like que reciben tus posts

-- 3.1 Posts -----------------------------------------------------------
create or replace function public._points_on_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set points = points + 5, updated_at = now()
    where id = new.user_id;
  return new;
end;
$$;

create or replace function public._points_on_post_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set points = greatest(points - 5, 0), updated_at = now()
    where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists points_on_post_insert on public.community_posts;
create trigger points_on_post_insert
  after insert on public.community_posts
  for each row execute function public._points_on_post_insert();

drop trigger if exists points_on_post_delete on public.community_posts;
create trigger points_on_post_delete
  after delete on public.community_posts
  for each row execute function public._points_on_post_delete();

-- 3.2 Comments --------------------------------------------------------
create or replace function public._points_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set points = points + 2, updated_at = now()
    where id = new.user_id;
  return new;
end;
$$;

create or replace function public._points_on_comment_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set points = greatest(points - 2, 0), updated_at = now()
    where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists points_on_comment_insert on public.community_comments;
create trigger points_on_comment_insert
  after insert on public.community_comments
  for each row execute function public._points_on_comment_insert();

drop trigger if exists points_on_comment_delete on public.community_comments;
create trigger points_on_comment_delete
  after delete on public.community_comments
  for each row execute function public._points_on_comment_delete();

-- 3.3 Likes -----------------------------------------------------------
create or replace function public._points_on_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.community_posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    update public.profiles
      set points = points + 1, updated_at = now()
      where id = v_author;
  end if;
  return new;
end;
$$;

create or replace function public._points_on_like_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from public.community_posts where id = old.post_id;
  if v_author is not null and v_author <> old.user_id then
    update public.profiles
      set points = greatest(points - 1, 0), updated_at = now()
      where id = v_author;
  end if;
  return old;
end;
$$;

drop trigger if exists points_on_like_insert on public.post_likes;
create trigger points_on_like_insert
  after insert on public.post_likes
  for each row execute function public._points_on_like_insert();

drop trigger if exists points_on_like_delete on public.post_likes;
create trigger points_on_like_delete
  after delete on public.post_likes
  for each row execute function public._points_on_like_delete();

-- 4. Backfill: recalcular puntos para usuarios existentes --------------
update public.profiles p
set points = coalesce(stats.total, 0)
from (
  select
    u.id,
    coalesce(p_posts.cnt, 0) * 5
      + coalesce(p_comments.cnt, 0) * 2
      + coalesce(p_likes.cnt, 0) * 1 as total
  from public.profiles u
  left join (
    select user_id, count(*) cnt from public.community_posts group by user_id
  ) p_posts on p_posts.user_id = u.id
  left join (
    select user_id, count(*) cnt from public.community_comments group by user_id
  ) p_comments on p_comments.user_id = u.id
  left join (
    select cp.user_id, count(*) cnt
    from public.post_likes pl
    join public.community_posts cp on cp.id = pl.post_id
    where pl.user_id <> cp.user_id
    group by cp.user_id
  ) p_likes on p_likes.user_id = u.id
) stats
where p.id = stats.id;

-- 5. Storage bucket: avatars -------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policies: lectura pública, escritura solo del dueño
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars_user_insert" on storage.objects;
create policy "avatars_user_insert"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_user_delete" on storage.objects;
create policy "avatars_user_delete"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
