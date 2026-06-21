-- ── Sistema de Evolución del Fundador — Diego 2030 ──────────────────────────

-- Evidencias reales de Diego
create table if not exists founder_evidences (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null check (type in ('clase','mentoria_grupal','mentoria_individual','reunion_estrategica','reunion_equipo','reunion_lucas','audio','video','transcripcion','documento','conversacion','planificacion','discurso','presentacion','mensaje_equipo')),
  content_text  text,                   -- transcripción o texto del documento
  file_url      text,                   -- URL de archivo si aplica
  context       text,                   -- contexto adicional de Diego
  duration_min  int,                    -- duración en minutos (para audio/video)
  date_recorded date,
  analysis_status text default 'pending' check (analysis_status in ('pending','analyzing','ready','error')),
  created_at    timestamptz default now()
);

-- Análisis del Motor CAC CEO por evidencia
create table if not exists founder_analyses (
  id            uuid primary key default gen_random_uuid(),
  evidence_id   uuid references founder_evidences(id) on delete cascade unique,
  analysis      jsonb not null,          -- análisis completo del Motor CAC CEO
  capacities    jsonb not null,          -- scores por capacidad {claridad_ejecutiva: {score, nivel, observacion, ...}}
  patterns      jsonb,                   -- patrones detectados
  exercises     jsonb,                   -- ejercicios generados automáticamente
  created_at    timestamptz default now()
);

-- Ejercicios de evolución asignados a Diego
create table if not exists founder_exercises (
  id              uuid primary key default gen_random_uuid(),
  capacity        text not null,         -- capacidad que trabaja
  title           text not null,
  description     text not null,
  origin_analysis uuid references founder_analyses(id),
  status          text default 'pending' check (status in ('pending','in_progress','delivered','needs_correction','approved','repeat','validated')),
  assigned_at     timestamptz default now(),
  due_at          timestamptz,
  submission_text text,                  -- lo que entrega Diego
  submission_url  text,
  validation      jsonb,                 -- resultado de validación IA
  validated_at    timestamptz,
  created_at      timestamptz default now()
);

-- Reportes semanales automáticos
create table if not exists founder_weekly_reports (
  id          bigserial primary key,
  week_start  date not null,
  week_end    date not null,
  report      jsonb not null,
  meta        jsonb default '{}',
  created_at  timestamptz default now(),
  unique(week_start)
);

-- Snapshots diarios de capacidades (para gráficas de evolución)
create table if not exists founder_capacity_snapshots (
  id              bigserial primary key,
  snapshot_date   date not null unique,
  scores          jsonb not null,        -- {claridad_ejecutiva: 7.2, priorizacion: 5.1, ...}
  evidence_count  int default 0,
  avg_2030_dist   numeric(4,1),
  created_at      timestamptz default now()
);

-- RLS: solo admins pueden acceder
alter table founder_evidences          enable row level security;
alter table founder_analyses           enable row level security;
alter table founder_exercises          enable row level security;
alter table founder_weekly_reports     enable row level security;
alter table founder_capacity_snapshots enable row level security;

do $$ begin create policy "admins_only" on founder_evidences          for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on founder_analyses           for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on founder_exercises          for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on founder_weekly_reports     for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on founder_capacity_snapshots for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;

-- Índices
create index if not exists founder_evidences_created_at on founder_evidences(created_at desc);
create index if not exists founder_exercises_status on founder_exercises(status);
create index if not exists founder_capacity_snapshots_date on founder_capacity_snapshots(snapshot_date desc);
