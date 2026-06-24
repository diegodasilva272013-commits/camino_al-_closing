-- =====================================================================
-- Migración 0035 · F5-B: trazabilidad y razonamiento en senal_equipo
-- Tres columnas aditivas — ningún dato existente se modifica.
-- =====================================================================

alter table public.senal_equipo
  add column if not exists razonamiento       text,
  add column if not exists a_revisar          boolean not null default false,
  add column if not exists team_diagnostic_id bigint
    references public.team_diagnostics(id) on delete set null;

create index if not exists idx_senal_team_diag
  on public.senal_equipo(team_diagnostic_id);
