-- ── Sistema Diego 2030 — Modelo de dominio completo ─────────────────────────
-- Prefijo d2030_ para separar del sistema anterior (founder_*)
-- Las tablas founder_* quedan intactas hasta migración completa de datos.

-- ── CAPACIDADES (tabla, no enum — insertar filas para agregar o cambiar) ─────
create table if not exists d2030_capacidades (
  id             serial primary key,
  clave          text unique not null,
  nombre         text not null,
  descripcion    text,
  nivel_objetivo int  not null default 10 check (nivel_objetivo between 1 and 10),
  orden          int  not null default 0,
  activa         bool not null default true,
  created_at     timestamptz not null default now()
);

-- Seed: las 6 capacidades actuales del Motor CAC CEO como filas configurables.
-- Para agregar una capacidad nueva: INSERT. Para renombrar: UPDATE. Sin migrations.
insert into d2030_capacidades (clave, nombre, descripcion, nivel_objetivo, orden) values
  ('claridad_ejecutiva',     'Claridad Ejecutiva',      'Convertir complejidad en claridad. Explicar ideas complejas con precisión y brevedad. Evitar sobreexplicación y desvíos.',                              10, 1),
  ('priorizacion',           'Priorización',            'Detectar lo esencial y eliminar ruido. Máximo 2 prioridades reales a la vez. Decidir qué NO hacer.',                                                  10, 2),
  ('delegacion',             'Delegación',              'Construir autonomía y evitar dependencia del fundador. Transferir pensamiento, no solo tareas. Definir dueño claro y resultado esperado.',             10, 3),
  ('seguimiento',            'Seguimiento',             'Cerrar ciclos y sostener ejecución. Registrar compromisos, verificar implementación real, detectar bloqueos temprano.',                               10, 4),
  ('comunicacion_ejecutiva', 'Comunicación Ejecutiva',  'Transmitir visión, decisiones y dirección con impacto. Mensaje corto, estructura clara, cierre con acción concreta.',                                10, 5),
  ('presencia',              'Presencia',               'Generar autoridad, atención y dominio en reuniones, clases y mentorías. Pausas intencionales, ritmo, lectura de audiencia.',                         10, 6)
on conflict (clave) do nothing;

-- ── PERFIL (raíz del sistema — UNA fila, estado calculado, nunca manual) ──────
-- estado_actual se escribe solo por el pipeline, no por el usuario.
create table if not exists d2030_perfil (
  id                     int primary key default 1,
  rol_objetivo           text not null default 'CAC CEO',
  estado_actual          jsonb,          -- snapshot derivado del pipeline
  cambio_vs_anterior     jsonb,          -- comparación vs período anterior
  capacidad_debil_clave  text references d2030_capacidades(clave),
  patron_dominante_id    uuid,           -- updated por pipeline
  intervencion_activa_id uuid,           -- updated por pipeline
  ultima_actualizacion   timestamptz default now()
);

insert into d2030_perfil (id) values (1) on conflict (id) do nothing;

-- ── EVIDENCIAS (INPUT — no protagonista, solo combustible del pipeline) ────────
create table if not exists d2030_evidencias (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,
  titulo       text not null,
  texto_crudo  text,
  fecha        date,
  contexto     text,
  fuente       text not null default 'manual' check (fuente in ('manual','auto_sync')),
  estado_proc  text not null default 'pending' check (estado_proc in ('pending','processing','ready','error')),
  error_msg    text,
  procesado_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ── COMPORTAMIENTOS (átomo del sistema — observación concreta de UNA evidencia) ─
-- Toda la cadena se construye sobre comportamientos, no sobre análisis monolíticos.
create table if not exists d2030_comportamientos (
  id           uuid primary key default gen_random_uuid(),
  evidencia_id uuid not null references d2030_evidencias(id) on delete cascade,
  descripcion  text not null,     -- observación concreta, sin juicio
  cita_textual text,              -- fragmento literal del texto fuente
  intensidad   text not null default 'media' check (intensidad in ('alta','media','baja')),
  fecha        date,
  created_at   timestamptz not null default now()
);

-- M:M comportamiento ↔ capacidad con valencia EN la relación.
-- Un comportamiento puede reforzar UNA capacidad y debilitar OTRA simultáneamente.
create table if not exists d2030_comportamiento_capacidades (
  comportamiento_id uuid not null references d2030_comportamientos(id) on delete cascade,
  capacidad_clave   text not null references d2030_capacidades(clave),
  valencia          text not null check (valencia in ('refuerza','debilita')),
  primary key (comportamiento_id, capacidad_clave)
);

-- ── MEDICIONES (append-only — base del timeline y comparaciones históricas) ────
-- NUNCA se sobreescriben. nivel_actual de una capacidad = último valor aquí.
-- Si pisás estas filas, perdés la historia. No lo hagás.
create table if not exists d2030_mediciones (
  id              uuid primary key default gen_random_uuid(),
  capacidad_clave text not null references d2030_capacidades(clave),
  valor           numeric(4,1) not null check (valor between 0 and 10),
  fecha           date not null,
  evidencia_id    uuid references d2030_evidencias(id),
  justificacion   text,
  confianza       text not null default 'media' check (confianza in ('alta','media','baja')),
  created_at      timestamptz not null default now()
);

-- ── PATRONES (recurrencias detectadas sobre comportamientos acumulados) ─────────
create table if not exists d2030_patrones (
  id                uuid primary key default gen_random_uuid(),
  descripcion       text not null,
  capacidad_clave   text not null references d2030_capacidades(clave),
  valencia          text not null check (valencia in ('positivo','negativo')),
  frecuencia        int  not null default 1,
  primera_aparicion date,
  ultima_aparicion  date,
  estado            text not null default 'activo' check (estado in ('activo','mejorando','resuelto')),
  created_at        timestamptz not null default now(),
  unique(descripcion, capacidad_clave)
);

-- M:M patrón ↔ comportamiento (los comportamientos son la evidencia del patrón)
create table if not exists d2030_patron_comportamientos (
  patron_id         uuid not null references d2030_patrones(id) on delete cascade,
  comportamiento_id uuid not null references d2030_comportamientos(id) on delete cascade,
  primary key (patron_id, comportamiento_id)
);

-- ── INTERVENCIONES (prescripción activa contra un patrón) ─────────────────────
create table if not exists d2030_intervenciones (
  id             uuid primary key default gen_random_uuid(),
  descripcion    text not null,
  patron_id      uuid references d2030_patrones(id),
  estado         text not null default 'propuesta' check (estado in ('propuesta','activa','completada','abandonada')),
  fecha_inicio   date,
  criterio_exito text,
  created_at     timestamptz not null default now()
);

-- FK diferida: perfil.intervencion_activa_id → d2030_intervenciones
alter table d2030_perfil add column if not exists intervencion_activa_fk uuid references d2030_intervenciones(id);

-- ── EJERCICIOS (práctica concreta para desarrollar una capacidad) ──────────────
create table if not exists d2030_ejercicios (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  descripcion      text not null,
  capacidad_clave  text not null references d2030_capacidades(clave),
  intervencion_id  uuid references d2030_intervenciones(id),
  estado           text not null default 'pendiente' check (estado in ('pendiente','en_curso','hecho','validado')),
  fecha_asignacion date not null default current_date,
  due_date         date,
  created_at       timestamptz not null default now()
);

-- ── VALIDACIONES (cierra el loop — distingue sistema de cuaderno de notas) ─────
-- Sin esto no hay aprendizaje: comprueba si la intervención cambió el comportamiento.
create table if not exists d2030_validaciones (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null check (tipo in ('intervencion','ejercicio')),
  referencia_id         uuid not null,
  evidencia_antes_id    uuid references d2030_evidencias(id),
  evidencia_despues_id  uuid references d2030_evidencias(id),
  resultado             text check (resultado in ('cambio','sin_cambio','empeoró')),
  notas                 text,
  created_at            timestamptz not null default now()
);

-- ── TIMELINE (append-only — hace posible "qué cambió el mes pasado") ───────────
create table if not exists d2030_timeline (
  id          bigserial primary key,
  tipo_evento text not null check (tipo_evento in (
    'evidencia_procesada',
    'comportamiento_extraido',
    'medicion_registrada',
    'patron_detectado',
    'patron_frecuencia_aumentada',
    'patron_resuelto',
    'intervencion_iniciada',
    'ejercicio_asignado',
    'validacion_completada',
    'capacidad_mejorada',
    'capacidad_empeorada'
  )),
  datos       jsonb not null,
  fecha       timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table d2030_capacidades                enable row level security;
alter table d2030_perfil                     enable row level security;
alter table d2030_evidencias                 enable row level security;
alter table d2030_comportamientos            enable row level security;
alter table d2030_comportamiento_capacidades enable row level security;
alter table d2030_mediciones                 enable row level security;
alter table d2030_patrones                   enable row level security;
alter table d2030_patron_comportamientos     enable row level security;
alter table d2030_intervenciones             enable row level security;
alter table d2030_ejercicios                 enable row level security;
alter table d2030_validaciones               enable row level security;
alter table d2030_timeline                   enable row level security;

do $$ begin create policy "admins_only" on d2030_capacidades                for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_perfil                     for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_evidencias                 for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_comportamientos            for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_comportamiento_capacidades for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_mediciones                 for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_patrones                   for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_patron_comportamientos     for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_intervenciones             for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_ejercicios                 for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_validaciones               for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins_only" on d2030_timeline                   for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin')); exception when duplicate_object then null; end $$;

-- ── ÍNDICES ───────────────────────────────────────────────────────────────────
create index if not exists d2030_mediciones_cap_fecha    on d2030_mediciones(capacidad_clave, fecha desc);
create index if not exists d2030_mediciones_fecha        on d2030_mediciones(fecha desc);
create index if not exists d2030_comportamientos_ev      on d2030_comportamientos(evidencia_id);
create index if not exists d2030_comp_cap_clave          on d2030_comportamiento_capacidades(capacidad_clave);
create index if not exists d2030_patrones_estado_freq    on d2030_patrones(estado, frecuencia desc);
create index if not exists d2030_patrones_cap            on d2030_patrones(capacidad_clave);
create index if not exists d2030_timeline_fecha          on d2030_timeline(fecha desc);
create index if not exists d2030_evidencias_estado       on d2030_evidencias(estado_proc);
