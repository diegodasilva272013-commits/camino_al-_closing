-- =====================================================================
-- Camino al Closing — Migración 0010 (Misiones diarias / semanales)
-- Sistema de challenges con +XP automático al completar.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- =====================================================================
-- 1. Catálogo de misiones
-- =====================================================================
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                       -- 'daily_comment_1'
  kind text not null check (kind in ('daily','weekly')),
  action text not null check (action in (
    'post','comment','like_given','lesson','streak_day'
  )),
  title text not null,
  description text,
  icon text,                                       -- emoji
  target int not null check (target > 0),
  reward_points int not null default 5,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists missions_active_idx on public.missions(kind, sort_order) where is_active;

alter table public.missions enable row level security;
drop policy if exists "missions_read_all" on public.missions;
create policy "missions_read_all" on public.missions for select using (true);
drop policy if exists "missions_admin_write" on public.missions;
create policy "missions_admin_write" on public.missions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 2. Progreso por usuario + período
-- =====================================================================
-- period_key:
--   daily  -> 'YYYY-MM-DD'  (UTC)
--   weekly -> 'YYYY-Www'    (ISO week)
create table if not exists public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  period_key text not null,
  progress int not null default 0,
  completed_at timestamptz,
  awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id, period_key)
);

create index if not exists user_missions_user_idx on public.user_missions(user_id, period_key);

alter table public.user_missions enable row level security;
drop policy if exists "user_missions_select_own" on public.user_missions;
create policy "user_missions_select_own" on public.user_missions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "user_missions_no_client_write" on public.user_missions;
create policy "user_missions_no_client_write" on public.user_missions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 3. Helpers de período
-- =====================================================================
create or replace function public.mission_period_key(p_kind text, p_at timestamptz default now())
returns text
language sql
immutable
as $$
  select case
    when p_kind = 'weekly' then to_char(p_at at time zone 'utc', 'IYYY-"W"IW')
    else to_char(p_at at time zone 'utc', 'YYYY-MM-DD')
  end;
$$;

-- =====================================================================
-- 4. Track progress — incrementa todas las misiones activas que matcheen
-- =====================================================================
create or replace function public.track_mission_progress(
  p_user uuid,
  p_action text,
  p_delta int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_period text;
  v_row public.user_missions%rowtype;
  v_new_progress int;
begin
  if p_user is null then return; end if;

  for m in
    select * from public.missions where is_active and action = p_action
  loop
    v_period := public.mission_period_key(m.kind);

    insert into public.user_missions (user_id, mission_id, period_key, progress)
    values (p_user, m.id, v_period, 0)
    on conflict (user_id, mission_id, period_key) do nothing;

    select * into v_row from public.user_missions
      where user_id = p_user and mission_id = m.id and period_key = v_period
      for update;

    -- Si ya completada, skip
    if v_row.completed_at is not null then
      continue;
    end if;

    v_new_progress := least(v_row.progress + p_delta, m.target);

    update public.user_missions
      set progress = v_new_progress,
          updated_at = now(),
          completed_at = case when v_new_progress >= m.target then now() else null end
      where id = v_row.id;

    -- Otorgar recompensa si recién se completa
    if v_new_progress >= m.target and not v_row.awarded then
      update public.profiles
        set points = points + m.reward_points, updated_at = now()
        where id = p_user;

      update public.user_missions set awarded = true where id = v_row.id;

      insert into public.notifications (user_id, type, title, body, link)
      values (
        p_user,
        'system',
        '🎯 Misión completada: ' || m.title,
        '+' || m.reward_points || ' XP — seguí así!',
        '/dashboard'
      );
    end if;
  end loop;
end;
$$;

-- =====================================================================
-- 5. Hooks en triggers existentes
-- =====================================================================

-- 5.1 Post creado
create or replace function public._missions_on_post_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.track_mission_progress(new.user_id, 'post', 1);
  return new;
end; $$;

drop trigger if exists missions_on_post_insert on public.community_posts;
create trigger missions_on_post_insert
  after insert on public.community_posts
  for each row execute function public._missions_on_post_insert();

-- 5.2 Comentario creado
create or replace function public._missions_on_comment_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.track_mission_progress(new.user_id, 'comment', 1);
  return new;
end; $$;

drop trigger if exists missions_on_comment_insert on public.community_comments;
create trigger missions_on_comment_insert
  after insert on public.community_comments
  for each row execute function public._missions_on_comment_insert();

-- 5.3 Like dado (al que clickea, no al autor)
create or replace function public._missions_on_like_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.track_mission_progress(new.user_id, 'like_given', 1);
  return new;
end; $$;

drop trigger if exists missions_on_like_insert on public.post_likes;
create trigger missions_on_like_insert
  after insert on public.post_likes
  for each row execute function public._missions_on_like_insert();

-- 5.4 Clase completada
create or replace function public._missions_on_lesson_complete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed and (old.completed is distinct from new.completed) then
    perform public.track_mission_progress(new.user_id, 'lesson', 1);
  end if;
  return new;
end; $$;

drop trigger if exists missions_on_lesson_complete on public.lesson_progress;
create trigger missions_on_lesson_complete
  after update on public.lesson_progress
  for each row execute function public._missions_on_lesson_complete();

create or replace function public._missions_on_lesson_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed then
    perform public.track_mission_progress(new.user_id, 'lesson', 1);
  end if;
  return new;
end; $$;

drop trigger if exists missions_on_lesson_insert on public.lesson_progress;
create trigger missions_on_lesson_insert
  after insert on public.lesson_progress
  for each row execute function public._missions_on_lesson_insert();

-- =====================================================================
-- 6. RPC: get_user_missions — devuelve misiones activas + progreso
-- =====================================================================
create or replace function public.get_user_missions(p_user uuid)
returns table (
  id uuid,
  code text,
  kind text,
  title text,
  description text,
  icon text,
  target int,
  reward_points int,
  progress int,
  completed boolean,
  period_key text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.code,
    m.kind,
    m.title,
    m.description,
    m.icon,
    m.target,
    m.reward_points,
    coalesce(um.progress, 0) as progress,
    coalesce(um.completed_at is not null, false) as completed,
    public.mission_period_key(m.kind) as period_key
  from public.missions m
  left join public.user_missions um
    on um.mission_id = m.id
   and um.user_id = p_user
   and um.period_key = public.mission_period_key(m.kind)
  where m.is_active
  order by m.kind, m.sort_order, m.title;
$$;

grant execute on function public.get_user_missions(uuid) to anon, authenticated;
grant execute on function public.track_mission_progress(uuid, text, int) to authenticated;

-- =====================================================================
-- 7. Seed inicial de misiones
-- =====================================================================
insert into public.missions (code, kind, action, title, description, icon, target, reward_points, sort_order)
values
  ('daily_comment_1',     'daily',  'comment',    'Dejá 1 comentario',           'Aportá en un post de la comunidad', '💬', 1, 5,  10),
  ('daily_like_3',        'daily',  'like_given', 'Dale ❤️ a 3 posts',           'Apoyá a otros closers',             '❤️', 3, 3,  20),
  ('daily_lesson_1',      'daily',  'lesson',     'Completá 1 clase',            'Aunque sea cortita',                '📚', 1, 10, 30),
  ('weekly_post_3',       'weekly', 'post',       'Posteá 3 veces',              'Compartí aprendizajes con la comunidad', '📝', 3, 25, 40),
  ('weekly_lesson_5',     'weekly', 'lesson',     'Completá 5 clases',           'Mantené el ritmo de aprendizaje',   '🎓', 5, 50, 50),
  ('weekly_comment_10',   'weekly', 'comment',    'Dejá 10 comentarios',         'La comunidad se construye conversando', '🗣️', 10, 30, 60)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  target = excluded.target,
  reward_points = excluded.reward_points,
  sort_order = excluded.sort_order,
  is_active = true;

-- =====================================================================
-- FIN migración 0010
-- =====================================================================
