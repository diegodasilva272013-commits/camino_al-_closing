-- ============================================================
-- 0042 · Fix sistémico: reabrir leads cerrados accidentalmente
-- Afecta a TODOS los setters.
-- Un lead solo debería tener is_closed=true si current_status='NO_CALIFICA'.
-- Cualquier otro caso es un cierre accidental.
-- ============================================================

-- Ver cuántos se van a reabrir antes de ejecutar
SELECT
  count(*)                                             AS total_a_reabrir,
  (SELECT full_name FROM public.profiles p WHERE p.id = l.assigned_to_user_id) AS setter,
  current_status
FROM public.leads l
WHERE is_closed = true
  AND current_status != 'NO_CALIFICA'
  AND assigned_to_user_id IS NOT NULL
GROUP BY assigned_to_user_id, current_status
ORDER BY total_a_reabrir DESC;

-- Ejecutar el fix
UPDATE public.leads
SET
  is_closed  = false,
  updated_at = now()
WHERE is_closed = true
  AND current_status != 'NO_CALIFICA'
  AND assigned_to_user_id IS NOT NULL;

-- Confirmar cuántos se reabrieron
SELECT count(*) AS leads_reabiertos FROM public.leads
WHERE batch_id IS NOT NULL OR updated_at > now() - interval '10 seconds';
