-- 0037: Motor B — schema aditivo para análisis automático CAC
-- Aditivo puro: cero borrados, cero renombrados.

-- ── 1. Capacidades: clave (slug) + aliases configurables ─────────────────────
ALTER TABLE public.capacidades ADD COLUMN IF NOT EXISTS clave        text;
ALTER TABLE public.capacidades ADD COLUMN IF NOT EXISTS claves_alias text[] DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS capacidades_clave_unique
  ON public.capacidades(clave) WHERE clave IS NOT NULL;

-- Seed: claves y aliases para las 9 capacidades CAC
-- Solo sinónimos de comportamiento comercial — cero terminología de neurociencia
UPDATE public.capacidades SET clave = 'escucha',                   claves_alias = ARRAY[]::text[]                          WHERE nombre = 'Escucha';
UPDATE public.capacidades SET clave = 'diagnostico',               claves_alias = ARRAY['diagnostico']                     WHERE nombre = 'Diagnóstico';
UPDATE public.capacidades SET clave = 'comunicacion',              claves_alias = ARRAY['rapport','empatia_profesional']   WHERE nombre = 'Comunicación';
UPDATE public.capacidades SET clave = 'generacion_interes',        claves_alias = ARRAY['generacion_interes']              WHERE nombre = 'Generación de interés';
UPDATE public.capacidades SET clave = 'seguimiento',               claves_alias = ARRAY['seguimiento']                     WHERE nombre = 'Seguimiento';
UPDATE public.capacidades SET clave = 'profesionalismo_operativo', claves_alias = ARRAY['profesionalismo']                 WHERE nombre = 'Profesionalismo operativo';
UPDATE public.capacidades SET clave = 'adaptabilidad',             claves_alias = ARRAY[]::text[]                          WHERE nombre = 'Adaptabilidad';
UPDATE public.capacidades SET clave = 'criterio',                  claves_alias = ARRAY['criterio','intencion']            WHERE nombre = 'Criterio';
UPDATE public.capacidades SET clave = 'profesionalismo_canal',     claves_alias = ARRAY[]::text[]                          WHERE nombre = 'Profesionalismo de canal';

-- ── 2. Idempotencia del motor ─────────────────────────────────────────────────
ALTER TABLE public.conversation_analyses     ADD COLUMN IF NOT EXISTS motor_processed_at timestamptz;
ALTER TABLE public.reinforcement_submissions ADD COLUMN IF NOT EXISTS motor_processed_at timestamptz;
ALTER TABLE public.trainer_sessions          ADD COLUMN IF NOT EXISTS motor_processed_at timestamptz;

-- ── 3. Trazabilidad en evidencias ─────────────────────────────────────────────
-- fuente_externa_id ya existe (varchar 100) — lo reutilizamos para el ID de origen
ALTER TABLE public.evidencias ADD COLUMN IF NOT EXISTS fuente_tipo text
  CHECK (fuente_tipo IN ('conversation','formulario','trainer','manual'));

-- Índice único antiduplicado: misma fuente no puede crear dos evidencias para la misma persona
CREATE UNIQUE INDEX IF NOT EXISTS evidencias_fuente_unique
  ON public.evidencias(persona_id, fuente_tipo, fuente_externa_id)
  WHERE fuente_externa_id IS NOT NULL AND fuente_tipo IS NOT NULL;

-- ── 4. Razonamiento causal ────────────────────────────────────────────────────
ALTER TABLE public.comportamientos ADD COLUMN IF NOT EXISTS razonamiento text;
ALTER TABLE public.patrones        ADD COLUMN IF NOT EXISTS razonamiento text;
