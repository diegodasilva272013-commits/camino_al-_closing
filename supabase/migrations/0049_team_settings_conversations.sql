-- Avatar + updated_at para equipos
ALTER TABLE public.setter_teams
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Bucket para fotos de equipo
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-avatars', 'team-avatars', true)
ON CONFLICT DO NOTHING;

-- Policies bucket team-avatars
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'team_avatars_public_read'
  ) THEN
    CREATE POLICY team_avatars_public_read ON storage.objects FOR SELECT USING (bucket_id = 'team-avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'team_avatars_member_insert'
  ) THEN
    CREATE POLICY team_avatars_member_insert ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'team-avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'team_avatars_member_update'
  ) THEN
    CREATE POLICY team_avatars_member_update ON storage.objects FOR UPDATE
      USING (bucket_id = 'team-avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Conversaciones de equipo
CREATE TABLE IF NOT EXISTS public.team_conversation_analyses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.setter_teams(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_text     text NOT NULL,
  analysis     jsonb,
  status       text NOT NULL DEFAULT 'analyzing',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_conversation_reflections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.team_conversation_analyses(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers     jsonb,
  evaluation  jsonb,
  xp_earned   int NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(analysis_id, user_id)
);

CREATE INDEX IF NOT EXISTS tca_team_id_idx  ON public.team_conversation_analyses(team_id);
CREATE INDEX IF NOT EXISTS tcr_analysis_idx ON public.team_conversation_reflections(analysis_id);
CREATE INDEX IF NOT EXISTS tcr_user_idx     ON public.team_conversation_reflections(user_id);

-- RLS: miembros del equipo pueden ver; cualquier autenticado puede hacer INSERT en su análisis
ALTER TABLE public.team_conversation_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_conversation_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY tca_team_member_select ON public.team_conversation_analyses
  FOR SELECT USING (
    team_id IN (
      SELECT id FROM public.setter_teams
      WHERE setter1_id = auth.uid() OR setter2_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY tca_team_member_insert ON public.team_conversation_analyses
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT id FROM public.setter_teams
      WHERE setter1_id = auth.uid() OR setter2_id = auth.uid()
    )
  );

CREATE POLICY tcr_own_select ON public.team_conversation_reflections
  FOR SELECT USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY tcr_own_insert ON public.team_conversation_reflections
  FOR INSERT WITH CHECK (user_id = auth.uid());
