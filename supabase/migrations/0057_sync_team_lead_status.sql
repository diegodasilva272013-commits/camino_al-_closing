-- =====================================================================
-- 0057 · Backfill: sincronizar team_leads.current_status → leads
--
-- PROBLEMA: cuando un setter movía un lead de equipo (ej. a CONTACTADO),
-- se actualizaba team_leads.current_status pero leads.current_status
-- quedaba en NO_CONTACTADO. El admin veía "cientos de no contactados"
-- que en realidad ya estaban avanzados en el pipeline del equipo.
--
-- FIX FORWARD: el PATCH de /api/equipo/[id] ahora sincroniza ambas tablas.
-- FIX BACKWARD (este archivo): backfill de todos los leads históricos.
--
-- Criterio: si el team_lead ya avanzó más allá de NO_CONTACTADO,
-- el lead fuente adopta ese estado (solo si el lead fuente está en
-- NO_CONTACTADO, para no pisar estados reales de leads personales).
-- =====================================================================

-- 1. Actualizar leads.current_status con el estado del team_lead
--    Solo cuando el team_lead avanzó y el lead fuente sigue en NO_CONTACTADO
UPDATE public.leads l
SET
  current_status = tl.current_status,
  last_action_at = tl.updated_at,
  updated_at     = now()
FROM public.team_leads tl
WHERE tl.source_lead_id  = l.id
  AND tl.current_status != 'NO_CONTACTADO'
  AND l.current_status   = 'NO_CONTACTADO';

-- 2. También: cuando el team_lead fue cerrado, marcar is_closed en leads
UPDATE public.leads l
SET
  is_closed  = true,
  updated_at = now()
FROM public.team_leads tl
WHERE tl.source_lead_id = l.id
  AND tl.is_closed      = true
  AND l.is_closed       = false;

-- Reporte de lo actualizado (visible en SQL Editor)
DO $$
DECLARE
  synced int;
BEGIN
  SELECT COUNT(*) INTO synced
  FROM public.leads l
  JOIN public.team_leads tl ON tl.source_lead_id = l.id
  WHERE tl.current_status != 'NO_CONTACTADO';

  RAISE NOTICE 'team_leads con estado avanzado vinculados a leads: %', synced;
END $$;
