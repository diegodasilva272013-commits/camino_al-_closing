-- =====================================================================
-- 0046 · Diagnóstico: visibilidad de leads por setter
-- Solo lectura — no modifica nada.
-- Correr en Supabase SQL Editor para entender el estado real.
-- =====================================================================

SELECT
  p.full_name                                              AS setter,
  count(*)                                                 AS total_leads,
  count(*) FILTER (WHERE l.current_status != 'NO_CALIFICA') AS kanban_visibles,
  count(*) FILTER (WHERE l.current_status  = 'NO_CALIFICA') AS no_califica_ocultos,
  count(*) FILTER (WHERE l.is_closed = true AND l.current_status != 'NO_CALIFICA') AS cerrados_error
FROM public.leads l
JOIN public.profiles p ON p.id = l.assigned_to_user_id
WHERE p.role IN ('setter', 'admin', 'mentor')
GROUP BY p.full_name
ORDER BY total_leads DESC;
