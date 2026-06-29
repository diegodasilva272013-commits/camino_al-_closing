-- =====================================================================
-- 0044 · Fix setter_leaderboard: excluir role='admin' del ranking
-- El admin puede VER el ranking pero no debe aparecer en él.
-- =====================================================================

create or replace function public.setter_leaderboard(p_days int)
returns table (
  user_id       uuid,
  full_name     text,
  avatar_url    text,
  score         int,
  conversations int,
  sessions      int,
  forms         int,
  community_pts int,
  rank          int
)
language sql
stable
security definer
set search_path = public
as $$
  with
  since as (
    select case
      when p_days > 0 then now() - (p_days || ' days')::interval
      else '1970-01-01'::timestamptz
    end as ts
  ),
  -- solo setters y mentors — admin queda excluido
  setters as (
    select id, full_name, avatar_url
    from public.profiles
    where role in ('setter', 'mentor')
  ),
  conv as (
    select user_id, count(*)::int as cnt
    from public.conversation_analyses
    where status = 'ready'
      and created_at >= (select ts from since)
    group by user_id
  ),
  sess as (
    select user_id, count(*)::int as cnt
    from public.trainer_sessions
    where ended_at is not null
      and started_at >= (select ts from since)
    group by user_id
  ),
  forms as (
    select user_id, count(*)::int as cnt
    from public.reinforcement_submissions
    where status = 'analyzed'
      and submitted_at >= (select ts from since)
    group by user_id
  ),
  comm_posts as (
    select user_id, count(*)::int as cnt
    from public.community_posts
    where is_deleted = false
      and created_at >= (select ts from since)
    group by user_id
  ),
  comm_comments as (
    select user_id, count(*)::int as cnt
    from public.community_comments
    where is_deleted = false
      and created_at >= (select ts from since)
    group by user_id
  ),
  comm_likes as (
    select cp.user_id, count(*)::int as cnt
    from public.post_likes pl
    join public.community_posts cp on cp.id = pl.post_id
    where pl.user_id <> cp.user_id
      and pl.created_at >= (select ts from since)
    group by cp.user_id
  ),
  scored as (
    select
      s.id as user_id,
      s.full_name,
      s.avatar_url,
      coalesce(conv.cnt, 0)                                          as conversations,
      coalesce(sess.cnt, 0)                                          as sessions,
      coalesce(forms.cnt, 0)                                         as forms,
      (coalesce(cp.cnt,0)*5 + coalesce(cc.cnt,0)*2 + coalesce(cl.cnt,0)) as community_pts,
      (
        coalesce(conv.cnt, 0) * 10
        + coalesce(sess.cnt, 0) * 8
        + coalesce(forms.cnt, 0) * 15
        + coalesce(cp.cnt, 0) * 5
        + coalesce(cc.cnt, 0) * 2
        + coalesce(cl.cnt, 0) * 1
      )::int as score
    from setters s
    left join conv          on conv.user_id  = s.id
    left join sess          on sess.user_id  = s.id
    left join forms         on forms.user_id = s.id
    left join comm_posts cp on cp.user_id    = s.id
    left join comm_comments cc on cc.user_id = s.id
    left join comm_likes    cl on cl.user_id  = s.id
  )
  select
    sc.user_id,
    sc.full_name,
    sc.avatar_url,
    sc.score,
    sc.conversations,
    sc.sessions,
    sc.forms,
    sc.community_pts,
    (rank() over (order by sc.score desc, sc.full_name asc nulls last))::int as rank
  from scored sc
  where sc.score > 0
  order by rank asc, sc.full_name asc;
$$;

grant execute on function public.setter_leaderboard(int) to authenticated;
