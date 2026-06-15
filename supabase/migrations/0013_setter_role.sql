-- =====================================================================
-- Camino al Closing — Migración 0013
-- Agrega rol 'setter' al check constraint de profiles.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'mentor', 'admin', 'setter'));

-- Resetear setters de prueba que quedaron con role='student'
-- (ajustá el email si querés ser más específico)
-- update public.profiles set role = 'setter' where access_code is not null and role = 'student';
