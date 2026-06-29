-- =====================================================================
-- 0047 · Equipos de setters — trabajo en parejas
-- Crea setter_teams y team_leads separados de los leads personales.
-- =====================================================================

-- Equipos de 2 setters
CREATE TABLE IF NOT EXISTS public.setter_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  setter1_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  setter2_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Leads del equipo (totalmente separados de public.leads)
CREATE TABLE IF NOT EXISTS public.team_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES public.setter_teams(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text,
  phone           text NOT NULL,
  email           text,
  country         text,
  current_status  text NOT NULL DEFAULT 'NO_CONTACTADO',
  notes           text,
  is_closed       boolean NOT NULL DEFAULT false,
  handled_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_leads_team_idx ON public.team_leads(team_id);
CREATE INDEX IF NOT EXISTS setter_teams_setter1 ON public.setter_teams(setter1_id);
CREATE INDEX IF NOT EXISTS setter_teams_setter2 ON public.setter_teams(setter2_id);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.setter_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leads   ENABLE ROW LEVEL SECURITY;

-- Admin: control total
DROP POLICY IF EXISTS "setter_teams_admin" ON public.setter_teams;
CREATE POLICY "setter_teams_admin" ON public.setter_teams FOR ALL
  USING  (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Setters: ven su propio equipo
DROP POLICY IF EXISTS "setter_teams_members_select" ON public.setter_teams;
CREATE POLICY "setter_teams_members_select" ON public.setter_teams FOR SELECT
  USING (auth.uid() = setter1_id OR auth.uid() = setter2_id);

-- Admin: control total sobre team_leads
DROP POLICY IF EXISTS "team_leads_admin" ON public.team_leads;
CREATE POLICY "team_leads_admin" ON public.team_leads FOR ALL
  USING  (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Setters: ven y editan leads de su equipo
DROP POLICY IF EXISTS "team_leads_members_select" ON public.team_leads;
CREATE POLICY "team_leads_members_select" ON public.team_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.setter_teams t
      WHERE t.id = team_id
        AND (auth.uid() = t.setter1_id OR auth.uid() = t.setter2_id)
    )
  );

DROP POLICY IF EXISTS "team_leads_members_update" ON public.team_leads;
CREATE POLICY "team_leads_members_update" ON public.team_leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.setter_teams t
      WHERE t.id = team_id
        AND (auth.uid() = t.setter1_id OR auth.uid() = t.setter2_id)
    )
  );
