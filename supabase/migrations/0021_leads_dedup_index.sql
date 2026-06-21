-- =====================================================================
-- Camino al Closing — Migración 0021 (Leads: índice único por setter)
-- Previene duplicados del mismo teléfono para el mismo setter.
-- IMPORTANTE: Correr DESPUÉS de /api/admin/leads/dedup para limpiar dupes.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- Primero elimina duplicados vía SQL antes de crear el índice único.
-- Conserva el lead con más follow_ups (o más reciente) por (phone, assigned_to_user_id).
DO $$
DECLARE
  deleted_count INT;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          regexp_replace(phone, '[^0-9]', '', 'g'),
          COALESCE(assigned_to_user_id::text, '__unassigned__')
        ORDER BY follow_up_count DESC, updated_at DESC
      ) AS rn
    FROM public.leads
    WHERE phone IS NOT NULL AND phone != ''
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  DELETE FROM public.leads WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Leads duplicados eliminados: %', deleted_count;
END $$;

-- Índice único por (teléfono normalizado, setter).
-- Permite que dos setters distintos tengan el mismo teléfono (es válido),
-- pero impide que el mismo setter tenga el mismo teléfono dos veces.
-- Nota: usamos una función expression index — no se puede hacer UNIQUE con COALESCE
-- en un índice expression directamente de esta forma; usamos partial indices en su lugar.

-- Índice único para leads ASIGNADOS: (phone, assigned_to_user_id) no nulos
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_setter_unique
  ON public.leads (
    regexp_replace(phone, '[^0-9]', '', 'g'),
    assigned_to_user_id
  )
  WHERE assigned_to_user_id IS NOT NULL AND phone IS NOT NULL AND phone != '';

-- Índice único para leads SIN ASIGNAR: solo por teléfono normalizado
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unassigned_unique
  ON public.leads (
    regexp_replace(phone, '[^0-9]', '', 'g')
  )
  WHERE assigned_to_user_id IS NULL AND phone IS NOT NULL AND phone != '';

-- FIN migración 0021
