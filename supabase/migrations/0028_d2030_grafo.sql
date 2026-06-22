-- ── Diego 2030 — Extensión del grafo ────────────────────────────────────────
-- Corre después de 0027_d2030_dominio.sql
-- Agrega: Insumos, Hipótesis, SeñalesEquipo + correcciones al schema

-- ── CORRECCIONES A 0027 ───────────────────────────────────────────────────────

-- BUG: aporte_neto puede ser negativo (Σdebilita > Σrefuerza).
-- El constraint original `between 0 and 10` rompe el pipeline en ese caso.
alter table d2030_mediciones drop constraint if exists d2030_mediciones_valor_check;
alter table d2030_mediciones add  constraint d2030_mediciones_valor_check
  check (valor between -10 and 10);

-- Multimodal: la misma evidencia puede tener texto, audio y video por capas.
-- La arquitectura no cambia entre fases — solo el extractor se vuelve más rico.
alter table d2030_evidencias add column if not exists audio_url     text;
alter table d2030_evidencias add column if not exists video_url     text;
alter table d2030_evidencias add column if not exists capa_analisis text not null default 'texto'
  check (capa_analisis in ('texto','audio','video'));

-- ── INSUMOS (lo que Diego consume — contexto, NO medición) ───────────────────
-- Regla: leer no es mejorar. El insumo genera hipótesis; la grabación prueba.
create table if not exists d2030_insumos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('youtube','audiolibro','libro','apunte','podcast','curso')),
  titulo        text not null,
  url           text,
  autor         text,
  fecha_consumo date,
  notas         text,   -- notas propias de Diego sobre el insumo
  created_at    timestamptz not null default now()
);

-- ── HIPÓTESIS (el puente insumo → comportamiento esperado) ────────────────────
-- "Después de estudiar X sobre delegación, espero ver Y en la próxima grabación."
-- Se confirma o refuta cuando aparece (o no) el comportamiento en una evidencia.
create table if not exists d2030_hipotesis (
  id                uuid primary key default gen_random_uuid(),
  insumo_id         uuid not null references d2030_insumos(id) on delete cascade,
  capacidad_clave   text not null references d2030_capacidades(clave),
  descripcion       text not null,  -- comportamiento concreto que se espera ver
  estado            text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','refutada','no_evaluada')),
  evidencia_id      uuid references d2030_evidencias(id),      -- la que la validó
  comportamiento_id uuid references d2030_comportamientos(id), -- comportamiento que la cerró
  evaluada_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- ── SEÑALES DEL EQUIPO (medición indirecta de Diego) ─────────────────────────
-- Si el equipo mejora, es señal de que el liderazgo funciona.
-- Es señal (con peso), no prueba absoluta — otros factores existen.
create table if not exists d2030_senales_equipo (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in (
    'resultado_setter',
    'reaccion_mentoria',
    'metrica_equipo',
    'diagnostico_equipo',
    'feedback_directo'
  )),
  descripcion text not null,
  fecha       date not null,
  fuente      text not null default 'manual'
    check (fuente in ('manual','auto_team_diagnostics')),
  datos       jsonb,   -- datos crudos (team_diagnostic.diagnosis, métricas, etc.)
  created_at  timestamptz not null default now()
);

-- M:M señal ↔ capacidad de Diego — la señal refuerza o debilita con peso bajo
-- (señal = evidencia suave, peso default 0.3 vs evidencia directa 0.5-1.0)
create table if not exists d2030_senal_capacidades (
  senal_id        uuid         not null references d2030_senales_equipo(id) on delete cascade,
  capacidad_clave text         not null references d2030_capacidades(clave),
  valencia        text         not null check (valencia in ('refuerza','debilita')),
  peso            decimal(3,2) not null default 0.3 check (peso between 0.05 and 0.5),
  justificacion   text,
  primary key (senal_id, capacidad_clave)
);

-- ── EXTENDER TIMELINE con nuevos tipos de evento ─────────────────────────────
alter table d2030_timeline drop constraint if exists d2030_timeline_tipo_evento_check;
alter table d2030_timeline add  constraint d2030_timeline_tipo_evento_check
  check (tipo_evento in (
    -- eventos de evidencia
    'evidencia_procesada',
    'comportamiento_extraido',
    'medicion_registrada',
    -- patrones
    'patron_detectado',
    'patron_frecuencia_aumentada',
    'patron_resuelto',
    -- intervenciones y ejercicios
    'intervencion_iniciada',
    'ejercicio_asignado',
    'validacion_completada',
    -- capacidades
    'capacidad_mejorada',
    'capacidad_empeorada',
    -- cadena causal (nuevos)
    'insumo_registrado',
    'hipotesis_generada',
    'hipotesis_confirmada',
    'hipotesis_refutada',
    'senal_equipo_registrada'
  ));

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table d2030_insumos           enable row level security;
alter table d2030_hipotesis         enable row level security;
alter table d2030_senales_equipo    enable row level security;
alter table d2030_senal_capacidades enable row level security;

do $$ begin create policy "admins_only" on d2030_insumos           for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_hipotesis         for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_senales_equipo    for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_senal_capacidades for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;

-- ── EXTENDER VALIDACIONES para cubrir la cadena causal completa ──────────────
-- 0027 solo tenía 'intervencion' y 'ejercicio'. La cadena también requiere validar
-- hipótesis (¿el insumo generó el comportamiento esperado?) y señales de equipo.
alter table d2030_validaciones drop constraint if exists d2030_validaciones_tipo_check;
alter table d2030_validaciones add constraint d2030_validaciones_tipo_check
  check (tipo in ('intervencion','ejercicio','hipotesis','senal_equipo'));

-- ── ÍNDICES ───────────────────────────────────────────────────────────────────
create index if not exists d2030_hipotesis_insumo  on d2030_hipotesis(insumo_id);
create index if not exists d2030_hipotesis_estado  on d2030_hipotesis(estado);
create index if not exists d2030_hipotesis_cap     on d2030_hipotesis(capacidad_clave);
create index if not exists d2030_senales_fecha     on d2030_senales_equipo(fecha desc);
create index if not exists d2030_senales_tipo      on d2030_senales_equipo(tipo);
create index if not exists d2030_senal_cap         on d2030_senal_capacidades(capacidad_clave);
