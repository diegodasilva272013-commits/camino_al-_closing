-- =====================================================================
-- Migración 0033 · F4: Agregar user_id a personas
-- La tabla personas (0016) vinculaba setters solo por email — frágil.
-- Esta migración agrega user_id como FK a profiles para vincular
-- correctamente. El campo email se conserva como dato informativo.
-- Proceso:
--   1. Agregar columna (nullable para no romper filas existentes)
--   2. Poblar cruzando por email (best-effort)
--   3. Las filas sin match quedan con user_id = NULL para revisión manual
-- =====================================================================

-- 1. Agregar columna (aditivo, no rompe nada existente)
alter table public.personas
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists personas_user_id_idx on public.personas(user_id);

-- 2. Poblar cruzando email (idempotente — solo toca filas que aún tienen NULL)
update public.personas p
set user_id = pr.id
from public.profiles pr
where lower(trim(p.email)) = lower(trim(pr.email))
  and p.user_id is null;

-- 3. Ver filas que NO matchearon (para revisión manual con Diego)
-- Ejecutar esto DESPUÉS de correr la migración y reportar el resultado:
-- SELECT id, nombre, email FROM public.personas WHERE user_id IS NULL AND activo = true;
