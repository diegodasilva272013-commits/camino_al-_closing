-- =====================================================================
-- 0051 · Ranking real: puntos desde trabajo REAL en leads
--
-- PROBLEMA ANTERIOR: el ranking solo contaba conversaciones analizadas,
-- formularios y actividad de comunidad — ignorando el trabajo central
-- del setter que es gestionar leads en el pipeline.
--
-- SOLUCIÓN: puntos calculados desde lead_activities (trabajo real) +
-- métricas de formación. Admin SIEMPRE excluido.
--
-- Pegar en Supabase → SQL Editor → Run
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- RANKING INDIVIDUAL DE SETTERS
-- ──────────────────────────────────────────────────────────────────────
-- Puntos por lead_activities (STATUS_CHANGE según new_status):
--   APERTURA_ENVIADA   → 3   (inicio de contacto)
--   CONTACTADO         → 5   (primer contacto real)
--   NO_RESPONDE        → 2   (seguimiento documentado)
--   RESPONDIO          → 10  (respuesta obtenida)
--   INTERES_DETECTADO  → 12
--   INVITADO_AL_GRUPO  → 15
--   INGRESO_AL_GRUPO   → 18
--   ACTIVO_EN_GRUPO    → 20
--   DIAGNOSTICO_INICIADO → 25
--   DIAGNOSTICO_PROFUNDO → 30
--   REUNION_PROPUESTA  → 35
--   REUNION_AGENDADA   → 60  (el gran logro del setter)
-- Puntos por NOTE_ADDED → 3 por nota (documentar el proceso)
-- Puntos de formación (siguen sumando):
--   conversación analizada → 10, sesión trainer → 8, formulario → 15
--   comunidad: post+5, comentario+2, like recibido+1

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
  -- SOLO setters y mentors — admin excluido siempre
  setters as (
    select id, full_name, avatar_url
    from public.profiles
    where role in ('setter', 'mentor')
  ),
  -- Puntos por cambios de estado en leads (trabajo real de pipeline)
  lead_status_pts as (
    select
      la.user_id,
      sum(
        case la.new_status
          when 'APERTURA_ENVIADA'    then 3
          when 'CONTACTADO'          then 5
          when 'NO_RESPONDE'         then 2
          when 'RESPONDIO'           then 10
          when 'INTERES_DETECTADO'   then 12
          when 'INVITADO_AL_GRUPO'   then 15
          when 'INGRESO_AL_GRUPO'    then 18
          when 'ACTIVO_EN_GRUPO'     then 20
          when 'DIAGNOSTICO_INICIADO'then 25
          when 'DIAGNOSTICO_PROFUNDO'then 30
          when 'REUNION_PROPUESTA'   then 35
          when 'REUNION_AGENDADA'    then 60
          else 0
        end
      )::int as pts,
      count(*) filter (where la.new_status = 'REUNION_AGENDADA')::int as meetings,
      count(*) filter (where la.new_status in ('CONTACTADO','APERTURA_ENVIADA'))::int as contacts
    from public.lead_activities la
    where la.type = 'STATUS_CHANGE'
      and la.created_at >= (select ts from since)
    group by la.user_id
  ),
  -- Puntos por notas agregadas (documentar el proceso)
  lead_notes_pts as (
    select
      user_id,
      count(*)::int as cnt
    from public.lead_activities
    where type = 'NOTE_ADDED'
      and created_at >= (select ts from since)
    group by user_id
  ),
  -- Métricas de formación (siguen siendo relevantes)
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
      s.id                                                               as user_id,
      s.full_name,
      s.avatar_url,
      -- leads
      coalesce(lsp.pts, 0)                                               as leads_pts,
      coalesce(lsp.meetings, 0)                                          as meetings,
      coalesce(lsp.contacts, 0)                                          as contacts,
      coalesce(lnp.cnt, 0)                                               as notes_added,
      -- formación
      coalesce(conv.cnt, 0)                                              as conversations,
      coalesce(sess.cnt, 0)                                              as sessions,
      coalesce(forms.cnt, 0)                                             as forms,
      (coalesce(cp.cnt,0)*5 + coalesce(cc.cnt,0)*2 + coalesce(cl.cnt,0)) as community_pts,
      -- score total
      (
        coalesce(lsp.pts, 0)
        + coalesce(lnp.cnt, 0) * 3
        + coalesce(conv.cnt, 0) * 10
        + coalesce(sess.cnt, 0) * 8
        + coalesce(forms.cnt, 0) * 15
        + coalesce(cp.cnt, 0) * 5
        + coalesce(cc.cnt, 0) * 2
        + coalesce(cl.cnt, 0) * 1
      )::int as score
    from setters s
    left join lead_status_pts lsp on lsp.user_id = s.id
    left join lead_notes_pts  lnp on lnp.user_id = s.id
    left join conv                on conv.user_id = s.id
    left join sess                on sess.user_id = s.id
    left join forms               on forms.user_id = s.id
    left join comm_posts      cp  on cp.user_id   = s.id
    left join comm_comments   cc  on cc.user_id   = s.id
    left join comm_likes      cl  on cl.user_id   = s.id
  )
  select
    sc.user_id,
    sc.full_name,
    sc.avatar_url,
    sc.score,
    sc.leads_pts,
    sc.meetings,
    sc.contacts,
    sc.notes_added,
    sc.conversations,
    sc.sessions,
    sc.forms,
    sc.community_pts,
    (rank() over (order by sc.score desc, sc.full_name asc nulls last))::int as rank
  from scored sc
  order by rank asc, sc.full_name asc nulls last;
$$;

grant execute on function public.setter_leaderboard(int) to authenticated;


-- ──────────────────────────────────────────────────────────────────────
-- RANKING DE EQUIPOS DUPLA
-- Suma los puntos de ambos setters del equipo.
-- ──────────────────────────────────────────────────────────────────────

drop function if exists public.team_leaderboard(int);

create or replace function public.team_leaderboard(p_days int)
returns table (
  team_id      uuid,
  team_name    text,
  setter1_id   uuid,
  setter1_name text,
  setter1_avatar text,
  setter2_id   uuid,
  setter2_name text,
  setter2_avatar text,
  score        int,
  leads_pts    int,
  meetings     int,
  rank         int
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
  -- puntos individuales por setter (solo trabajo en leads)
  setter_pts as (
    select
      la.user_id,
      sum(
        case la.new_status
          when 'APERTURA_ENVIADA'    then 3
          when 'CONTACTADO'          then 5
          when 'NO_RESPONDE'         then 2
          when 'RESPONDIO'           then 10
          when 'INTERES_DETECTADO'   then 12
          when 'INVITADO_AL_GRUPO'   then 15
          when 'INGRESO_AL_GRUPO'    then 18
          when 'ACTIVO_EN_GRUPO'     then 20
          when 'DIAGNOSTICO_INICIADO'then 25
          when 'DIAGNOSTICO_PROFUNDO'then 30
          when 'REUNION_PROPUESTA'   then 35
          when 'REUNION_AGENDADA'    then 60
          else 0
        end
      )::int as pts,
      count(*) filter (where la.new_status = 'REUNION_AGENDADA')::int as meetings
    from public.lead_activities la
    where la.type = 'STATUS_CHANGE'
      and la.created_at >= (select ts from since)
    group by la.user_id
  ),
  -- notas también suman al equipo
  setter_notes as (
    select user_id, count(*)::int as cnt
    from public.lead_activities
    where type = 'NOTE_ADDED'
      and created_at >= (select ts from since)
    group by user_id
  ),
  -- perfiles para nombres y avatares
  profs as (
    select id, full_name, avatar_url from public.profiles
  )
  select
    t.id                                                         as team_id,
    t.name                                                       as team_name,
    t.setter1_id,
    p1.full_name                                                 as setter1_name,
    p1.avatar_url                                                as setter1_avatar,
    t.setter2_id,
    p2.full_name                                                 as setter2_name,
    p2.avatar_url                                                as setter2_avatar,
    (
      coalesce(sp1.pts, 0) + coalesce(sn1.cnt, 0) * 3
      + coalesce(sp2.pts, 0) + coalesce(sn2.cnt, 0) * 3
    )::int                                                       as score,
    (coalesce(sp1.pts, 0) + coalesce(sp2.pts, 0))::int          as leads_pts,
    (coalesce(sp1.meetings, 0) + coalesce(sp2.meetings, 0))::int as meetings,
    (rank() over (
      order by (
        coalesce(sp1.pts,0) + coalesce(sn1.cnt,0)*3
        + coalesce(sp2.pts,0) + coalesce(sn2.cnt,0)*3
      ) desc, t.name asc nulls last
    ))::int as rank
  from public.setter_teams t
  left join profs         p1  on p1.id  = t.setter1_id
  left join profs         p2  on p2.id  = t.setter2_id
  left join setter_pts    sp1 on sp1.user_id = t.setter1_id
  left join setter_pts    sp2 on sp2.user_id = t.setter2_id
  left join setter_notes  sn1 on sn1.user_id = t.setter1_id
  left join setter_notes  sn2 on sn2.user_id = t.setter2_id
  order by rank asc, t.name asc nulls last;
$$;

grant execute on function public.team_leaderboard(int) to authenticated;
