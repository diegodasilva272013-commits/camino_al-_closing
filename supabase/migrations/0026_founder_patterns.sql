-- Memoria estructurada del sistema de evolución Diego 2030
-- Patrones acumulados entre TODAS las evidencias

create table if not exists founder_patterns (
  id            uuid primary key default gen_random_uuid(),
  patron        text not null,
  tipo          text not null check (tipo in ('positivo','negativo','neutro')),
  capacidad     text not null,
  descripcion   text,
  count         int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  evidence_ids  uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique(patron, capacidad)
);

-- Comportamientos específicos (positivos y negativos) con frecuencia
create table if not exists founder_behaviors (
  id            uuid primary key default gen_random_uuid(),
  behavior      text not null,
  tipo          text not null check (tipo in ('positivo','negativo')),
  capacidad     text not null,
  count         int not null default 1,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique(behavior, capacidad)
);

alter table founder_patterns  enable row level security;
alter table founder_behaviors enable row level security;

do $$ begin create policy "admins_only" on founder_patterns  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on founder_behaviors for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;

create index if not exists founder_patterns_count  on founder_patterns(count desc);
create index if not exists founder_patterns_tipo   on founder_patterns(tipo, count desc);
create index if not exists founder_behaviors_count on founder_behaviors(count desc);
