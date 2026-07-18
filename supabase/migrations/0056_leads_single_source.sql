-- =====================================================================
-- 0056 · Una sola fuente de verdad para datos de leads
--
-- PROBLEMA: team_leads COPIABA first_name, last_name, phone, email,
-- country de la tabla leads en el momento de distribución.
-- Resultado: dos versiones del mismo dato, conteos contradictorios,
-- y el "sin asignar" contaba mal porque usaba un IN con miles de UUIDs.
--
-- SOLUCIÓN:
--   • team_leads pierde las columnas duplicadas (datos de contacto).
--   • Todos los datos de contacto se leen vía JOIN a leads.
--   • source_lead_id pasa a NOT NULL (siempre debe existir el vínculo).
--   • Dos funciones SQL reemplazan la lógica de IN enorme:
--       leads_sin_asignar_count()  → contador eficiente
--       leads_sin_asignar(limit)   → listado para preview
-- =====================================================================

-- ── 1. Eliminar huérfanos (team_leads sin vínculo a leads) ───────────
-- Solo pueden existir si fueron creados antes de la migración 0048.
DELETE FROM public.team_leads
WHERE source_lead_id IS NULL;

-- ── 2. source_lead_id nunca más puede ser NULL ───────────────────────
ALTER TABLE public.team_leads
  ALTER COLUMN source_lead_id SET NOT NULL;

-- ── 3. Eliminar columnas duplicadas de team_leads ────────────────────
-- El dato vive en leads. Leer vía JOIN, no via copia.
ALTER TABLE public.team_leads
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS country;

-- ── 4. Función: conteo de leads sin asignar ──────────────────────────
-- Reemplaza el IN gigante de la API. Usa NOT EXISTS que es O(1) con índice.
CREATE OR REPLACE FUNCTION public.leads_sin_asignar_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.leads l
  WHERE l.assigned_to_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.team_leads tl
      WHERE tl.source_lead_id = l.id
    );
$$;

GRANT EXECUTE ON FUNCTION public.leads_sin_asignar_count() TO authenticated;

-- ── 5. Función: leads disponibles para distribución ──────────────────
-- Para el pool de distribución y el preview de admin.
CREATE OR REPLACE FUNCTION public.leads_sin_asignar(p_limit int DEFAULT 20)
RETURNS TABLE (
  id         uuid,
  first_name text,
  last_name  text,
  phone      text,
  email      text,
  country    text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.first_name, l.last_name, l.phone, l.email, l.country, l.created_at
  FROM public.leads l
  WHERE l.assigned_to_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.team_leads tl
      WHERE tl.source_lead_id = l.id
    )
  ORDER BY l.created_at DESC
  LIMIT CASE WHEN p_limit > 0 THEN p_limit ELSE NULL END;
$$;

GRANT EXECUTE ON FUNCTION public.leads_sin_asignar(int) TO authenticated;
