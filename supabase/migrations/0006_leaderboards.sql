-- =====================================================================
-- Camino al Closing — Leaderboards (rankings 7d / 30d / all-time).
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- leaderboard_window(p_days):
--   p_days = 0  -> all-time, usa profiles.points (acumulado histórico)
--   p_days > 0  -> recalcula puntos a partir de eventos dentro de la ventana
-- Devuelve TODOS los usuarios con puntos > 0, ranking incluido,
-- ordenados por rank asc. El cliente toma top 10 y/o busca el del usuario.
create or replace function public.leaderboard_window(p_days int)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  points int,
  rank int
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      u.id as user_id,
      u.full_name,
      u.avatar_url,
      case
        when p_days is null or p_days <= 0 then coalesce(u.points, 0)
        else (
          coalesce((
            select count(*) * 5
            from public.community_posts cp
            where cp.user_id = u.id
              and cp.is_deleted = false
              and cp.created_at >= now() - (p_days || ' days')::interval
          ), 0)
          + coalesce((
            select count(*) * 2
            from public.community_comments cc
            where cc.user_id = u.id
              and cc.is_deleted = false
              and cc.created_at >= now() - (p_days || ' days')::interval
          ), 0)
          + coalesce((
            select count(*)
            from public.post_likes pl
            join public.community_posts cp on cp.id = pl.post_id
            where cp.user_id = u.id
              and pl.user_id <> cp.user_id
              and pl.created_at >= now() - (p_days || ' days')::interval
          ), 0)
        )
      end as points
    from public.profiles u
    where coalesce(u.is_public, true) = true
  )
  select
    b.user_id,
    b.full_name,
    b.avatar_url,
    b.points::int,
    (rank() over (order by b.points desc, b.full_name asc nulls last))::int as rank
  from base b
  where b.points > 0
  order by rank asc, b.full_name asc;
$$;

grant execute on function public.leaderboard_window(int) to authenticated, anon;
