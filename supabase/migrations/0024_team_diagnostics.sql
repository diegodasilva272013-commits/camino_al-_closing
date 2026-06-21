-- Historial de diagnósticos diarios del equipo
create table if not exists team_diagnostics (
  id            bigserial primary key,
  diagnosis     jsonb not null,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

alter table team_diagnostics enable row level security;

do $$ begin
  create policy "admins_all" on team_diagnostics
    for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "service_insert" on team_diagnostics
    for insert with check (true);
exception when duplicate_object then null; end $$;

-- Índice para traer el más reciente rápido
create index if not exists team_diagnostics_created_at_idx on team_diagnostics (created_at desc);
