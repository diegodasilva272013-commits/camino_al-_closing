-- =====================================================================
-- 0055 · Fix: fuente de datos unificada para tareas y ranking de equipos
--
-- PROBLEMA RAÍZ: tres fuentes de datos distintas dando números distintos.
--
--   Personal leads  → leads          → lead_activities
--   Team leads      → team_leads     → team_lead_activities
--   Conv personales → conversation_analyses        (user_id)
--   Conv de equipo  → team_conversation_analyses   (submitted_by)
--
-- FUNCIONES ROTAS:
--
-- 1. get_setter_tarea_counts() solo leía lead_activities e ignoraba
--    team_lead_activities → setters de duplas tenían 0 en tareas diarias
--    aunque hubieran trabajado leads del equipo.
--
-- 2. team_leaderboard() leía team_leads.current_status (estado puntual del
--    lead, no actividad en el período). Resultado: puntos incoherentes
--    con el ranking individual.
--
-- FIX: ambas funciones leen de las tablas de actividad (lead_activities +
-- team_lead_activities), que son el registro real de trabajo hecho.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. get_setter_tarea_counts — ahora incluye AMBAS fuentes de actividad
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_setter_tarea_counts(
  p_setter_id uuid,
  p_fecha     date DEFAULT current_date
)
RETURNS TABLE (
  aperturas_count   int,
  contactados_count int,
  conv_count        int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- ── Aperturas: leads personales + leads de equipo ─────────────
    (
      SELECT COUNT(DISTINCT lead_id)::int
      FROM   public.lead_activities
      WHERE  user_id    = p_setter_id
        AND  type       = 'STATUS_CHANGE'
        AND  new_status = 'APERTURA_ENVIADA'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    )
    +
    (
      SELECT COUNT(DISTINCT team_lead_id)::int
      FROM   public.team_lead_activities
      WHERE  user_id    = p_setter_id
        AND  type       = 'STATUS_CHANGE'
        AND  new_status = 'APERTURA_ENVIADA'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    ) AS aperturas_count,

    -- ── Contactados: leads personales + leads de equipo ───────────
    (
      SELECT COUNT(DISTINCT lead_id)::int
      FROM   public.lead_activities
      WHERE  user_id    = p_setter_id
        AND  type       = 'STATUS_CHANGE'
        AND  new_status = 'CONTACTADO'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    )
    +
    (
      SELECT COUNT(DISTINCT team_lead_id)::int
      FROM   public.team_lead_activities
      WHERE  user_id    = p_setter_id
        AND  type       = 'STATUS_CHANGE'
        AND  new_status = 'CONTACTADO'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    ) AS contactados_count,

    -- ── Conversaciones: personales + las del equipo (submitted_by) ─
    (
      SELECT COUNT(*)::int
      FROM   public.conversation_analyses
      WHERE  user_id    = p_setter_id
        AND  status     = 'ready'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    )
    +
    (
      SELECT COUNT(*)::int
      FROM   public.team_conversation_analyses
      WHERE  submitted_by = p_setter_id
        AND  status       = 'ready'
        AND  created_at  >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at  <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    ) AS conv_count
$$;

GRANT EXECUTE ON FUNCTION public.get_setter_tarea_counts(uuid, date) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 2. team_leaderboard — usa team_lead_activities (actividad real en el
--    período), igual que setter_leaderboard usa lead_activities.
--    Antes leía team_leads.current_status que es estado puntual, no
--    trabajo hecho en el período pedido.
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.team_leaderboard(int);

CREATE OR REPLACE FUNCTION public.team_leaderboard(p_days int)
RETURNS TABLE (
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  since AS (
    SELECT CASE
      WHEN p_days > 0 THEN now() - (p_days || ' days')::interval
      ELSE '1970-01-01'::timestamptz
    END AS ts
  ),

  -- Puntos por actividades en leads de equipo (igual que setter_leaderboard
  -- usa lead_activities, acá usamos team_lead_activities)
  team_status AS (
    SELECT
      tl.team_id,
      tla.user_id,
      SUM(CASE tla.new_status
        WHEN 'APERTURA_ENVIADA'     THEN 3
        WHEN 'CONTACTADO'           THEN 5
        WHEN 'NO_RESPONDE'          THEN 2
        WHEN 'RESPONDIO'            THEN 10
        WHEN 'INTERES_DETECTADO'    THEN 12
        WHEN 'INVITADO_AL_GRUPO'    THEN 15
        WHEN 'INGRESO_AL_GRUPO'     THEN 18
        WHEN 'ACTIVO_EN_GRUPO'      THEN 20
        WHEN 'DIAGNOSTICO_INICIADO' THEN 25
        WHEN 'DIAGNOSTICO_PROFUNDO' THEN 30
        WHEN 'REUNION_PROPUESTA'    THEN 35
        WHEN 'REUNION_AGENDADA'     THEN 60
        ELSE 0
      END)::int AS pts,
      COUNT(*) FILTER (WHERE tla.new_status = 'REUNION_AGENDADA')::int AS meetings
    FROM   public.team_lead_activities tla
    JOIN   public.team_leads           tl  ON tl.id = tla.team_lead_id
    WHERE  tla.type       = 'STATUS_CHANGE'
      AND  tla.created_at >= (SELECT ts FROM since)
    GROUP  BY tl.team_id, tla.user_id
  ),

  -- Notas de equipo también suman
  team_notes AS (
    SELECT
      tl.team_id,
      tla.user_id,
      COUNT(*)::int AS cnt
    FROM   public.team_lead_activities tla
    JOIN   public.team_leads           tl  ON tl.id = tla.team_lead_id
    WHERE  tla.type       = 'NOTE_ADDED'
      AND  tla.created_at >= (SELECT ts FROM since)
    GROUP  BY tl.team_id, tla.user_id
  ),

  -- Score consolidado por equipo (suma setter1 + setter2)
  team_score AS (
    SELECT
      ts.team_id,
      SUM(ts.pts + COALESCE(tn.cnt, 0) * 3)::int AS score,
      SUM(ts.pts)::int                            AS leads_pts,
      SUM(ts.meetings)::int                       AS meetings
    FROM   team_status ts
    LEFT JOIN team_notes tn ON tn.team_id = ts.team_id
                            AND tn.user_id = ts.user_id
    GROUP  BY ts.team_id
  ),

  profs AS (
    SELECT id, full_name, avatar_url FROM public.profiles
  )

  SELECT
    t.id                               AS team_id,
    t.name                             AS team_name,
    t.setter1_id,
    p1.full_name                       AS setter1_name,
    p1.avatar_url                      AS setter1_avatar,
    t.setter2_id,
    p2.full_name                       AS setter2_name,
    p2.avatar_url                      AS setter2_avatar,
    COALESCE(ts.score,    0)::int      AS score,
    COALESCE(ts.leads_pts,0)::int      AS leads_pts,
    COALESCE(ts.meetings, 0)::int      AS meetings,
    (RANK() OVER (
      ORDER BY COALESCE(ts.score, 0) DESC, t.name ASC NULLS LAST
    ))::int                            AS rank
  FROM   public.setter_teams t
  LEFT JOIN profs       p1 ON p1.id = t.setter1_id
  LEFT JOIN profs       p2 ON p2.id = t.setter2_id
  LEFT JOIN team_score  ts ON ts.team_id = t.id
  ORDER  BY rank ASC, t.name ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.team_leaderboard(int) TO authenticated;
