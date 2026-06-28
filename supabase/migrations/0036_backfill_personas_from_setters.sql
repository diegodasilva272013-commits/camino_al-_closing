-- 0036: backfill personas para setters existentes + trigger para futuros
-- Regla: ON CONFLICT (user_id) DO NOTHING — no toca las 3 personas ya registradas

-- 1. Unique index (IF NOT EXISTS sí es válido para índices en PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS personas_user_id_unique_idx
  ON public.personas(user_id);

-- 2. Backfill: un INSERT por cada setter en profiles sin fila en personas
INSERT INTO public.personas (nombre, email, rol_actual, activo, user_id, fecha_ingreso)
SELECT
  COALESCE(p.full_name, p.email, 'Sin nombre'),
  COALESCE(p.email, ''),
  'setter',
  true,
  p.id,
  CURRENT_DATE
FROM public.profiles p
WHERE p.role = 'setter'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Trigger function: crea fila en personas cuando un profile pasa a rol setter
CREATE OR REPLACE FUNCTION public.fn_sync_setter_to_personas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role = 'setter' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'setter') THEN
    INSERT INTO public.personas (nombre, email, rol_actual, activo, user_id, fecha_ingreso)
    VALUES (
      COALESCE(NEW.full_name, NEW.email, 'Sin nombre'),
      COALESCE(NEW.email, ''),
      'setter',
      true,
      NEW.id,
      CURRENT_DATE
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger en profiles
DROP TRIGGER IF EXISTS trg_setter_to_personas ON public.profiles;
CREATE TRIGGER trg_setter_to_personas
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_setter_to_personas();
