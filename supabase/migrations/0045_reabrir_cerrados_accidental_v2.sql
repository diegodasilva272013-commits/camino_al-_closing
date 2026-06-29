-- =====================================================================
-- 0045 · Fix v2: volver a abrir cualquier lead con is_closed=true
--        que no sea NO_CALIFICA (aplica a todos los setters).
--        La misma lógica que 0042 pero seguro correrla de nuevo —
--        si no hay nada para arreglar no hace daño.
-- =====================================================================

-- Ver cuántos hay antes de correr
SELECT
  p.full_name                       AS setter,
  l.current_status,
  count(*)                          AS cerrados_accidental
FROM public.leads l
JOIN public.profiles p ON p.id = l.assigned_to_user_id
WHERE l.is_closed = true
  AND l.current_status != 'NO_CALIFICA'
GROUP BY p.full_name, l.current_status
ORDER BY cerrados_accidental DESC;

-- Fix
UPDATE public.leads
SET
  is_closed  = false,
  updated_at = now()
WHERE is_closed = true
  AND current_status != 'NO_CALIFICA';

-- Confirmar
SELECT count(*) AS leads_reabiertos
FROM public.leads
WHERE is_closed = false
  AND updated_at > now() - interval '5 seconds';
