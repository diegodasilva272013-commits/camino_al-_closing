-- =====================================================================
-- 0052 · Tracking de actividad en leads de equipo (duplas)
--
-- PROBLEMA: lead_activities.lead_id tiene FK a leads(id).
-- Los team_leads son una tabla separada → no se pueden registrar ahí.
-- Todo el trabajo de los setters en duplas era invisible al ranking.
--
-- SOLUCIÓN: tabla team_lead_activities paralela a lead_activities,
-- referenciando team_leads. Las funciones SQL de ranking leen ambas.
--
-- Pegar en Supabase → SQL Editor → Run
-- =====================================================================

-- ── 1. Nueva tabla ───────────────────────────────────────────────────

create table if not exists public.team_lead_activities (
  id              uuid        primary key default gen_random_uuid(),
  team_lead_id    uuid        not null references public.team_leads(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id)   on delete cascade,
  type            text        not null,
  previous_status text,
  new_status      text,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists tla_user_created_idx on public.team_lead_activities(user_id, created_at desc);
create index if not exists tla_lead_idx         on public.team_lead_activities(team_lead_id, created_at desc);

alter table public.team_lead_activities enable row level security;

drop policy if exists "tla_admin_all"        on public.team_lead_activities;
create policy        "tla_admin_all"
  on public.team_lead_activities for all
  using  (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "tla_setter_read"      on public.team_lead_activities;
create policy        "tla_setter_read"
  on public.team_lead_activities for select
  using (auth.uid() = user_id);

drop policy if exists "tla_setter_insert"    on public.team_lead_activities;
create policy        "tla_setter_insert"
  on public.team_lead_activities for insert
  with check (auth.uid() = user_id);


-- ── 2. Reescribir setter_leaderboard: incluye AMBAS fuentes ──────────

drop function if exists public.setter_leaderboard(int);

create or replace function public.setter_leaderboard(p_days int)
returns table (
  user_id       uuid,
  full_name     text,
  avatar_url    text,
  score         int,
  leads_pts     int,
  meetings      int,
  contacts      int,
  notes_added   int,
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
  setters as (
    select id, full_name, avatar_url
    from public.profiles
    where role in ('setter', 'mentor')
  ),
  -- Puntos desde leads personales (tabla leads → lead_activities)
  personal_status as (
    select
      user_id,
      sum(case new_status
        when 'APERTURA_ENVIADA'     then 3
        when 'CONTACTADO'           then 5
        when 'NO_RESPONDE'          then 2
        when 'RESPONDIO'            then 10
        when 'INTERES_DETECTADO'    then 12
        when 'INVITADO_AL_GRUPO'    then 15
        when 'INGRESO_AL_GRUPO'     then 18
        when 'ACTIVO_EN_GRUPO'      then 20
        when 'DIAGNOSTICO_INICIADO' then 25
        when 'DIAGNOSTICO_PROFUNDO' then 30
        when 'REUNION_PROPUESTA'    then 35
        when 'REUNION_AGENDADA'     then 60
        else 0
      end)::int as pts,
      count(*) filter (where new_status = 'REUNION_AGENDADA')::int as meetings,
      count(*) filter (where new_status in ('CONTACTADO','APERTURA_ENVIADA'))::int as contacts
    from public.lead_activities
    where type = 'STATUS_CHANGE'
      and created_at >= (select ts from since)
    group by user_id
  ),
  personal_notes as (
    select user_id, count(*)::int as cnt
    from public.lead_activities
    where type = 'NOTE_ADDED'
      and created_at >= (select ts from since)
    group by user_id
  ),
  -- Puntos desde leads de equipo (tabla team_leads → team_lead_activities)
  team_status as (
    select
      user_id,
      sum(case new_status
        when 'APERTURA_ENVIADA'     then 3
        when 'CONTACTADO'           then 5
        when 'NO_RESPONDE'          then 2
        when 'RESPONDIO'            then 10
        when 'INTERES_DETECTADO'    then 12
        when 'INVITADO_AL_GRUPO'    then 15
        when 'INGRESO_AL_GRUPO'     then 18
        when 'ACTIVO_EN_GRUPO'      then 20
        when 'DIAGNOSTICO_INICIADO' then 25
        when 'DIAGNOSTICO_PROFUNDO' then 30
        when 'REUNION_PROPUESTA'    then 35
        when 'REUNION_AGENDADA'     then 60
        else 0
      end)::int as pts,
      count(*) filter (where new_status = 'REUNION_AGENDADA')::int as meetings,
      count(*) filter (where new_status in ('CONTACTADO','APERTURA_ENVIADA'))::int as contacts
    from public.team_lead_activities
    where type = 'STATUS_CHANGE'
      and created_at >= (select ts from since)
    group by user_id
  ),
  team_notes as (
    select user_id, count(*)::int as cnt
    from public.team_lead_activities
    where type = 'NOTE_ADDED'
      and created_at >= (select ts from since)
    group by user_id
  ),
  -- Formación
  conv as (
    select user_id, count(*)::int as cnt
    from public.conversation_analyses
    where status = 'ready' and created_at >= (select ts from since)
    group by user_id
  ),
  sess as (
    select user_id, count(*)::int as cnt
    from public.trainer_sessions
    where ended_at is not null and started_at >= (select ts from since)
    group by user_id
  ),
  forms as (
    select user_id, count(*)::int as cnt
    from public.reinforcement_submissions
    where status = 'analyzed' and submitted_at >= (select ts from since)
    group by user_id
  ),
  comm_posts as (
    select user_id, count(*)::int as cnt
    from public.community_posts
    where is_deleted = false and created_at >= (select ts from since)
    group by user_id
  ),
  comm_comments as (
    select user_id, count(*)::int as cnt
    from public.community_comments
    where is_deleted = false and created_at >= (select ts from since)
    group by user_id
  ),
  comm_likes as (
    select cp.user_id, count(*)::int as cnt
    from public.post_likes pl
    join public.community_posts cp on cp.id = pl.post_id
    where pl.user_id <> cp.user_id and pl.created_at >= (select ts from since)
    group by cp.user_id
  ),
  scored as (
    select
      s.id                                                                   as user_id,
      s.full_name,
      s.avatar_url,
      (coalesce(ps.pts,0) + coalesce(ts.pts,0))                             as leads_pts,
      (coalesce(ps.meetings,0) + coalesce(ts.meetings,0))                   as meetings,
      (coalesce(ps.contacts,0) + coalesce(ts.contacts,0))                   as contacts,
      (coalesce(pn.cnt,0)  + coalesce(tn.cnt,0))                            as notes_added,
      coalesce(conv.cnt, 0)                                                  as conversations,
      coalesce(sess.cnt, 0)                                                  as sessions,
      coalesce(forms.cnt, 0)                                                 as forms,
      (coalesce(cp.cnt,0)*5 + coalesce(cc.cnt,0)*2 + coalesce(cl.cnt,0))   as community_pts,
      (
        coalesce(ps.pts,0)  + coalesce(ts.pts,0)
        + (coalesce(pn.cnt,0) + coalesce(tn.cnt,0)) * 3
        + coalesce(conv.cnt,0) * 10
        + coalesce(sess.cnt,0) * 8
        + coalesce(forms.cnt,0) * 15
        + coalesce(cp.cnt,0)*5 + coalesce(cc.cnt,0)*2 + coalesce(cl.cnt,0)
      )::int as score
    from setters s
    left join personal_status ps  on ps.user_id  = s.id
    left join personal_notes  pn  on pn.user_id  = s.id
    left join team_status     ts  on ts.user_id  = s.id
    left join team_notes      tn  on tn.user_id  = s.id
    left join conv                on conv.user_id = s.id
    left join sess                on sess.user_id = s.id
    left join forms               on forms.user_id= s.id
    left join comm_posts      cp  on cp.user_id  = s.id
    left join comm_comments   cc  on cc.user_id  = s.id
    left join comm_likes      cl  on cl.user_id  = s.id
  )
  select
    sc.user_id, sc.full_name, sc.avatar_url, sc.score,
    sc.leads_pts, sc.meetings, sc.contacts, sc.notes_added,
    sc.conversations, sc.sessions, sc.forms, sc.community_pts,
    (rank() over (order by sc.score desc, sc.full_name asc nulls last))::int as rank
  from scored sc
  order by rank asc, sc.full_name asc nulls last;
$$;

grant execute on function public.setter_leaderboard(int) to authenticated;


-- ── 3. team_leaderboard: SOLO trabajo en leads del equipo ────────────
-- El score de la dupla refleja únicamente lo que hacen juntos
-- en sus team_leads. No mezcla historial personal de cada setter.

drop function if exists public.team_leaderboard(int);

create or replace function public.team_leaderboard(p_days int)
returns table (
  team_id        uuid,
  team_name      text,
  setter1_id     uuid,
  setter1_name   text,
  setter1_avatar text,
  setter2_id     uuid,
  setter2_name   text,
  setter2_avatar text,
  score          int,
  leads_pts      int,
  meetings       int,
  rank           int
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
  -- Puntos por trabajo en team_leads — ÚNICA fuente para el ranking de duplas
  team_pts as (
    select
      tla.user_id,
      sum(case tla.new_status
        when 'APERTURA_ENVIADA'     then 3
        when 'CONTACTADO'           then 5
        when 'NO_RESPONDE'          then 2
        when 'RESPONDIO'            then 10
        when 'INTERES_DETECTADO'    then 12
        when 'INVITADO_AL_GRUPO'    then 15
        when 'INGRESO_AL_GRUPO'     then 18
        when 'ACTIVO_EN_GRUPO'      then 20
        when 'DIAGNOSTICO_INICIADO' then 25
        when 'DIAGNOSTICO_PROFUNDO' then 30
        when 'REUNION_PROPUESTA'    then 35
        when 'REUNION_AGENDADA'     then 60
        else 0
      end)::int as pts,
      count(*) filter (where tla.new_status = 'REUNION_AGENDADA')::int as meetings,
      count(*) filter (where tla.type = 'NOTE_ADDED')::int             as notes
    from public.team_lead_activities tla
    where tla.created_at >= (select ts from since)
    group by tla.user_id
  ),
  profs as (
    select id, full_name, avatar_url from public.profiles
  )
  select
    t.id                                                                          as team_id,
    t.name                                                                        as team_name,
    t.setter1_id,
    p1.full_name                                                                  as setter1_name,
    p1.avatar_url                                                                 as setter1_avatar,
    t.setter2_id,
    p2.full_name                                                                  as setter2_name,
    p2.avatar_url                                                                 as setter2_avatar,
    (coalesce(tp1.pts,0) + coalesce(tp1.notes,0)*3
     + coalesce(tp2.pts,0) + coalesce(tp2.notes,0)*3)::int                       as score,
    (coalesce(tp1.pts,0) + coalesce(tp2.pts,0))::int                             as leads_pts,
    (coalesce(tp1.meetings,0) + coalesce(tp2.meetings,0))::int                   as meetings,
    (rank() over (
      order by (coalesce(tp1.pts,0) + coalesce(tp1.notes,0)*3
                + coalesce(tp2.pts,0) + coalesce(tp2.notes,0)*3) desc,
               t.name asc nulls last
    ))::int as rank
  from public.setter_teams t
  left join profs     p1  on p1.id  = t.setter1_id
  left join profs     p2  on p2.id  = t.setter2_id
  left join team_pts  tp1 on tp1.user_id = t.setter1_id
  left join team_pts  tp2 on tp2.user_id = t.setter2_id
  order by rank asc, t.name asc nulls last;
$$;

grant execute on function public.team_leaderboard(int) to authenticated;
