-- ============================================================
-- 0038 · Constraint único (phone_norm, assigned_to_user_id)
-- Primero limpia duplicados existentes, luego crea el índice.
-- Regla: mismo teléfono normalizado no puede estar dos veces
-- asignado al mismo setter. (Puede estar en listas de dos setters distintos.)
-- ============================================================

-- Paso 1: borrar duplicados manteniendo el más activo por setter
-- (mayor follow_up_count → más reciente updated_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        regexp_replace(coalesce(phone, ''), '\D+', '', 'g'),
        assigned_to_user_id
      ORDER BY
        follow_up_count DESC NULLS LAST,
        updated_at       DESC NULLS LAST
    ) AS rn
  FROM public.leads
  WHERE phone IS NOT NULL
    AND phone != ''
    AND assigned_to_user_id IS NOT NULL
)
DELETE FROM public.leads
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Paso 2: índice único para prevenir futuros duplicados
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_setter_unique_idx
  ON public.leads (
    regexp_replace(coalesce(phone, ''), '\D+', '', 'g'),
    assigned_to_user_id
  )
  WHERE phone IS NOT NULL
    AND phone != ''
    AND assigned_to_user_id IS NOT NULL;
