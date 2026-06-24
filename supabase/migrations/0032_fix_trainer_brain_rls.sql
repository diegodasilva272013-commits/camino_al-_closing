-- =====================================================================
-- Migración 0032 · F1: Cerrar lectura pública de trainer_brain
-- trainer_brain contiene los prompts internos del simulador CAC (IP).
-- Solo role='admin' puede leerlos. Los endpoints del trainer usan
-- service_role del lado del servidor, así que nada se rompe.
-- =====================================================================

drop policy if exists "trainer_brain_read_authenticated" on public.trainer_brain;

-- Solo queda trainer_brain_admin_all (for all using is_admin)
