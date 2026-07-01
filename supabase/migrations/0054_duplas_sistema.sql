-- =====================================================================
-- 0054 · Sistema de Duplas y Tareas Diarias
--
-- Agrega:
--   • setter_teams.activa (boolean)
--   • profiles.bloqueado / bloqueado_at / bloqueado_motivo
--   • strikes.tipo / strikes.dupla_id
--   • tabla dupla_config (metas configurables por dupla)
--   • tabla tarea_diaria_resultado (tracking diario por setter)
--   • función get_setter_tarea_counts(p_setter_id, p_fecha)
-- =====================================================================

-- ── setter_teams ─────────────────────────────────────────────────────
ALTER TABLE public.setter_teams
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;

-- ── profiles: campos de bloqueo ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueado_at     timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_motivo text;

-- ── strikes: tipo y dupla_id ─────────────────────────────────────────
ALTER TABLE public.strikes
  ADD COLUMN IF NOT EXISTS tipo     text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS dupla_id uuid REFERENCES public.setter_teams(id) ON DELETE SET NULL;

-- tipo CHECK
ALTER TABLE public.strikes
  DROP CONSTRAINT IF EXISTS strikes_tipo_check;
ALTER TABLE public.strikes
  ADD CONSTRAINT strikes_tipo_check CHECK (tipo IN ('manual', 'tarea_diaria'));

-- ── dupla_config: metas configurables ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dupla_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dupla_id         uuid NOT NULL REFERENCES public.setter_teams(id) ON DELETE CASCADE,
  aperturas_meta   int  NOT NULL DEFAULT 5,
  contactados_meta int  NOT NULL DEFAULT 5,
  conv_meta        int  NOT NULL DEFAULT 10,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dupla_id)
);

ALTER TABLE public.dupla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY dupla_config_admin ON public.dupla_config FOR ALL
  USING  (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY dupla_config_setters_read ON public.dupla_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.setter_teams t
      WHERE t.id = dupla_id
        AND (t.setter1_id = auth.uid() OR t.setter2_id = auth.uid())
    )
  );

-- ── tarea_diaria_resultado ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarea_diaria_resultado (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dupla_id            uuid NOT NULL REFERENCES public.setter_teams(id) ON DELETE CASCADE,
  setter_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT current_date,
  aperturas_count     int  NOT NULL DEFAULT 0,
  contactados_count   int  NOT NULL DEFAULT 0,
  conv_count          int  NOT NULL DEFAULT 0,
  task_aperturas_ok   boolean NOT NULL DEFAULT false,
  task_contactados_ok boolean NOT NULL DEFAULT false,
  task_conv_ok        boolean NOT NULL DEFAULT false,
  all_tasks_ok        boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dupla_id, setter_id, fecha)
);

CREATE INDEX IF NOT EXISTS tdr_fecha_idx  ON public.tarea_diaria_resultado(fecha);
CREATE INDEX IF NOT EXISTS tdr_setter_idx ON public.tarea_diaria_resultado(setter_id);
CREATE INDEX IF NOT EXISTS tdr_dupla_idx  ON public.tarea_diaria_resultado(dupla_id);

ALTER TABLE public.tarea_diaria_resultado ENABLE ROW LEVEL SECURITY;

CREATE POLICY tdr_admin ON public.tarea_diaria_resultado FOR ALL
  USING  (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY tdr_setters_read ON public.tarea_diaria_resultado FOR SELECT
  USING (
    setter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.setter_teams t
      WHERE t.id = dupla_id
        AND (t.setter1_id = auth.uid() OR t.setter2_id = auth.uid())
    )
  );

-- ── función de conteo diario ─────────────────────────────────────────
-- Argentina = UTC-3 fija (sin horario de verano).
-- Día ART comienza a las 03:00 UTC.
CREATE OR REPLACE FUNCTION public.get_setter_tarea_counts(
  p_setter_id uuid,
  p_fecha     date DEFAULT current_date
)
RETURNS TABLE (
  aperturas_count   int,
  contactados_count int,
  conv_count        int
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    (
      SELECT COUNT(DISTINCT lead_id)::int
      FROM   public.lead_activities
      WHERE  user_id    = p_setter_id
        AND  type       = 'STATUS_CHANGE'
        AND  new_status = 'APERTURA_ENVIADA'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    ) AS aperturas_count,
    (
      SELECT COUNT(DISTINCT lead_id)::int
      FROM   public.lead_activities
      WHERE  user_id    = p_setter_id
        AND  type       = 'STATUS_CHANGE'
        AND  new_status = 'CONTACTADO'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    ) AS contactados_count,
    (
      SELECT COUNT(*)::int
      FROM   public.conversation_analyses
      WHERE  user_id    = p_setter_id
        AND  status     = 'ready'
        AND  created_at >= (p_fecha::text || 'T03:00:00Z')::timestamptz
        AND  created_at <  ((p_fecha + 1)::text || 'T03:00:00Z')::timestamptz
    ) AS conv_count
$$;
