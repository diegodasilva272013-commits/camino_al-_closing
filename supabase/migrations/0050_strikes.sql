-- Sistema de Strikes del equipo
-- Un strike es una advertencia formal emitida por admin cuando un setter viola el reglamento.

CREATE TABLE IF NOT EXISTS public.strikes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason      text NOT NULL,
  category    text,        -- 'puntualidad' | 'conducta' | 'rendimiento' | 'comunicacion' | 'otro'
  severity    int  NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 3),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strikes ENABLE ROW LEVEL SECURITY;

-- Setters pueden VER todos los strikes (vista de equipo)
CREATE POLICY "setters_read_strikes" ON public.strikes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admin puede INSERT / UPDATE / DELETE (usando service role en backend)
CREATE POLICY "admin_manage_strikes" ON public.strikes
  FOR ALL USING (false);   -- bloqueado para no-admin desde cliente directo; el backend usa service role
