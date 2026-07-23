-- Calendário compartilhado: todos los roles (setter/closer/admin) ven TODAS las reuniones.
-- Reemplaza las políticas SELECT individuales por una política compartida.

-- ── reuniones: reemplazar SELECT restringido por compartido ─────────────────
DROP POLICY IF EXISTS reuniones_setter_select ON public.reuniones;
DROP POLICY IF EXISTS reuniones_closer_select ON public.reuniones;

CREATE POLICY reuniones_shared_select ON public.reuniones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('setter', 'closer', 'admin')
    )
  );

-- ── closer_availability: ya tiene ca_all_read para setter/closer/admin ──────
-- Verificar que existe; si no, crearla.
DROP POLICY IF EXISTS ca_all_read ON public.closer_availability;
CREATE POLICY ca_all_read ON public.closer_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('setter', 'closer', 'admin')
    )
  );
