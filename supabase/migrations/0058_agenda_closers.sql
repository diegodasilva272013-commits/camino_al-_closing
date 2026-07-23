-- =====================================================================
-- 0058 · Módulo Agenda de Closers
--
-- Agrega:
--   • rol 'closer' al constraint de profiles.role
--   • tabla closer_availability (franjas horarias semanales del closer)
--   • tabla reuniones (citas setter ↔ closer vinculadas al pipeline)
--   • RLS para ambas tablas
-- =====================================================================

-- ── 1. Agregar rol 'closer' ──────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'mentor', 'admin', 'setter', 'closer'));

-- ── 2. closer_availability ───────────────────────────────────────────
-- Franjas horarias semanales del closer.
-- hora_inicio y hora_fin se interpretan en America/Caracas.
CREATE TABLE IF NOT EXISTS public.closer_availability (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id   uuid    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia_semana  smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0 = domingo
  hora_inicio time    NOT NULL,
  hora_fin    time    NOT NULL CHECK (hora_fin > hora_inicio),
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_id, dia_semana, hora_inicio)
);

CREATE INDEX IF NOT EXISTS ca_closer_dia_idx ON public.closer_availability (closer_id, dia_semana);

ALTER TABLE public.closer_availability ENABLE ROW LEVEL SECURITY;

-- Closer: CRUD de sus propias franjas
DROP POLICY IF EXISTS ca_closer_own ON public.closer_availability;
CREATE POLICY ca_closer_own ON public.closer_availability FOR ALL
  USING  (closer_id = auth.uid())
  WITH CHECK (closer_id = auth.uid());

-- Setters y closers: pueden leer todas las disponibilidades (para ver slots)
DROP POLICY IF EXISTS ca_all_read ON public.closer_availability;
CREATE POLICY ca_all_read ON public.closer_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('setter', 'closer', 'admin')
    )
  );

-- Admin: control total
DROP POLICY IF EXISTS ca_admin ON public.closer_availability;
CREATE POLICY ca_admin ON public.closer_availability FOR ALL
  USING  (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── 3. reuniones ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reuniones (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid    REFERENCES public.leads(id)      ON DELETE SET NULL,
  team_lead_id          uuid    REFERENCES public.team_leads(id) ON DELETE SET NULL,
  closer_id             uuid    NOT NULL REFERENCES public.profiles(id),
  setter_id             uuid    NOT NULL REFERENCES public.profiles(id),
  inicio                timestamptz NOT NULL,
  duracion_min          integer NOT NULL DEFAULT 60,
  estado                text    NOT NULL DEFAULT 'agendada'
    CHECK (estado IN ('agendada', 'reprogramada', 'completada', 'no_show', 'cancelada')),
  conversacion_whatsapp text    NOT NULL,
  notas                 text,
  resultado             text,
  estado_lead_anterior  text,        -- current_status del lead antes de agendar
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (lead_id IS NOT NULL OR team_lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reuniones_closer_inicio ON public.reuniones (closer_id, inicio);
CREATE INDEX IF NOT EXISTS idx_reuniones_setter        ON public.reuniones (setter_id);
CREATE INDEX IF NOT EXISTS idx_reuniones_estado        ON public.reuniones (estado);

ALTER TABLE public.reuniones ENABLE ROW LEVEL SECURITY;

-- Admin: control total
DROP POLICY IF EXISTS reuniones_admin ON public.reuniones;
CREATE POLICY reuniones_admin ON public.reuniones FOR ALL
  USING  (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Setter: ve y crea sus propias reuniones
DROP POLICY IF EXISTS reuniones_setter_select ON public.reuniones;
CREATE POLICY reuniones_setter_select ON public.reuniones FOR SELECT
  USING (setter_id = auth.uid());

DROP POLICY IF EXISTS reuniones_setter_insert ON public.reuniones;
CREATE POLICY reuniones_setter_insert ON public.reuniones FOR INSERT
  WITH CHECK (setter_id = auth.uid());

DROP POLICY IF EXISTS reuniones_setter_update ON public.reuniones;
CREATE POLICY reuniones_setter_update ON public.reuniones FOR UPDATE
  USING (setter_id = auth.uid());

-- Closer: ve sus reuniones y puede actualizarlas (completar, no_show, resultado)
DROP POLICY IF EXISTS reuniones_closer_select ON public.reuniones;
CREATE POLICY reuniones_closer_select ON public.reuniones FOR SELECT
  USING (closer_id = auth.uid());

DROP POLICY IF EXISTS reuniones_closer_update ON public.reuniones;
CREATE POLICY reuniones_closer_update ON public.reuniones FOR UPDATE
  USING (closer_id = auth.uid());
