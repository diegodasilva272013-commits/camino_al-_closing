-- =====================================================================
-- Camino al Closing — Migración 0014
-- Agrega columna email a leads (requerido por el importador de Excel).
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

alter table public.leads
  add column if not exists email text;
