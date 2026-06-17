-- Sistema de Evolución CAC V1

-- TABLA: personas
create table if not exists public.personas (
  id            uuid primary key default gen_random_uuid(),
  nombre        varchar(100) not null,
  email         varchar(150) unique not null,
  fecha_ingreso date not null,
  rol_actual    varchar(50),
  objetivo_actual text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.personas enable row level security;
drop policy if exists "personas_admin_all" on public.personas;
create policy "personas_admin_all" on public.personas for all using (true);

-- TABLA: capacidades
create table if not exists public.capacidades (
  id          uuid primary key default gen_random_uuid(),
  nombre      varchar(100) not null,
  descripcion text,
  orden       integer,
  activo      boolean not null default true
);

alter table public.capacidades enable row level security;
drop policy if exists "capacidades_public_read" on public.capacidades;
create policy "capacidades_public_read" on public.capacidades for select using (true);

-- Insertar las 9 capacidades
insert into public.capacidades (nombre, descripcion, orden) values
  ('Escucha',                     'Capacidad de escuchar activamente antes de responder',                         1),
  ('Diagnóstico',                 'Capacidad de identificar el problema real detrás del síntoma',                 2),
  ('Comunicación',                'Capacidad de transmitir ideas con claridad y precisión',                       3),
  ('Generación de interés',       'Capacidad de despertar curiosidad genuina antes de proponer',                  4),
  ('Seguimiento',                 'Capacidad de dar continuidad sin perder conversaciones',                       5),
  ('Profesionalismo operativo',   'Capacidad de operar con orden, registro y cumplimiento',                       6),
  ('Adaptabilidad',               'Capacidad de ajustar enfoque cuando el contexto cambia',                       7),
  ('Criterio',                    'Capacidad de tomar decisiones razonables sin depender de instrucciones',        8),
  ('Profesionalismo de canal',    'Capacidad de operar WhatsApp con criterio y cuidar la reputación del canal',   9)
on conflict do nothing;

-- TABLA: catalogo_comportamientos
create table if not exists public.catalogo_comportamientos (
  id               uuid primary key default gen_random_uuid(),
  capacidad_id     uuid references public.capacidades(id),
  etiqueta         varchar(150) not null,
  descripcion      text,
  tipo             varchar(10) check (tipo in ('positivo', 'negativo')),
  estado_revision  varchar(15) not null default 'aprobado' check (estado_revision in ('aprobado', 'candidato', 'descartado')),
  veces_observado  integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.catalogo_comportamientos enable row level security;
drop policy if exists "catalogo_public_read" on public.catalogo_comportamientos;
create policy "catalogo_public_read" on public.catalogo_comportamientos for select using (true);
drop policy if exists "catalogo_admin_write" on public.catalogo_comportamientos;
create policy "catalogo_admin_write" on public.catalogo_comportamientos for all using (true);

-- Seed de comportamientos iniciales (requiere que las capacidades ya existan)
do $$
declare
  c_escucha     uuid;
  c_diagnostico uuid;
  c_comunica    uuid;
  c_interes     uuid;
  c_seguim      uuid;
  c_prof_op     uuid;
  c_adapt       uuid;
  c_criterio    uuid;
  c_canal       uuid;
begin
  select id into c_escucha     from public.capacidades where nombre = 'Escucha' limit 1;
  select id into c_diagnostico from public.capacidades where nombre = 'Diagnóstico' limit 1;
  select id into c_comunica    from public.capacidades where nombre = 'Comunicación' limit 1;
  select id into c_interes     from public.capacidades where nombre = 'Generación de interés' limit 1;
  select id into c_seguim      from public.capacidades where nombre = 'Seguimiento' limit 1;
  select id into c_prof_op     from public.capacidades where nombre = 'Profesionalismo operativo' limit 1;
  select id into c_adapt       from public.capacidades where nombre = 'Adaptabilidad' limit 1;
  select id into c_criterio    from public.capacidades where nombre = 'Criterio' limit 1;
  select id into c_canal       from public.capacidades where nombre = 'Profesionalismo de canal' limit 1;

  insert into public.catalogo_comportamientos (capacidad_id, etiqueta, tipo) values
    -- Escucha
    (c_escucha, 'Reformuló antes de responder',                        'positivo'),
    (c_escucha, 'Hizo preguntas abiertas para entender mejor',         'positivo'),
    (c_escucha, 'Esperó que el prospecto terminara antes de hablar',   'positivo'),
    (c_escucha, 'Interrumpió al prospecto',                            'negativo'),
    (c_escucha, 'Respondió sin escuchar lo que dijo el otro',          'negativo'),
    -- Diagnóstico
    (c_diagnostico, 'Identificó el problema real detrás del síntoma',            'positivo'),
    (c_diagnostico, 'Hizo preguntas de segundo nivel antes de proponer',         'positivo'),
    (c_diagnostico, 'Validó su lectura de la situación con el prospecto',        'positivo'),
    (c_diagnostico, 'Propuso solución sin diagnosticar',                         'negativo'),
    (c_diagnostico, 'Asumió el problema sin preguntar',                          'negativo'),
    -- Comunicación
    (c_comunica, 'Fue claro y conciso en el mensaje',                  'positivo'),
    (c_comunica, 'Usó ejemplos concretos y relevantes',                'positivo'),
    (c_comunica, 'Adaptó el lenguaje al nivel del interlocutor',       'positivo'),
    (c_comunica, 'El mensaje fue confuso o ambiguo',                   'negativo'),
    (c_comunica, 'Usó tecnicismos que el prospecto no entendió',       'negativo'),
    -- Generación de interés
    (c_interes, 'Despertó curiosidad antes de proponer',               'positivo'),
    (c_interes, 'Conectó el producto con el problema del prospecto',   'positivo'),
    (c_interes, 'Generó una necesidad antes de ofrecer la solución',   'positivo'),
    (c_interes, 'Ofreció el producto sin generar interés previo',      'negativo'),
    (c_interes, 'Presentó beneficios sin conectarlos con el prospecto','negativo'),
    -- Seguimiento
    (c_seguim, 'Retomó la conversación con contexto completo',        'positivo'),
    (c_seguim, 'Hizo seguimiento en el tiempo acordado',              'positivo'),
    (c_seguim, 'Dejó registrado el próximo paso antes de cerrar',     'positivo'),
    (c_seguim, 'Perdió el hilo de una conversación anterior',         'negativo'),
    (c_seguim, 'No hizo seguimiento en el momento adecuado',          'negativo'),
    -- Profesionalismo operativo
    (c_prof_op, 'Registró el estado del lead correctamente en el sistema',    'positivo'),
    (c_prof_op, 'Cumplió los tiempos de contacto acordados',                  'positivo'),
    (c_prof_op, 'Documentó el resultado de cada interacción',                 'positivo'),
    (c_prof_op, 'No actualizó el estado del lead después de contactar',       'negativo'),
    (c_prof_op, 'Olvidó hacer seguimiento programado',                        'negativo'),
    -- Adaptabilidad
    (c_adapt, 'Cambió el enfoque al detectar señales de resistencia',  'positivo'),
    (c_adapt, 'Ajustó el tono según el perfil del prospecto',          'positivo'),
    (c_adapt, 'Probó un camino diferente cuando el primero no funcionó','positivo'),
    (c_adapt, 'Siguió el script sin adaptarlo al contexto',            'negativo'),
    (c_adapt, 'No ajustó el mensaje ante señales claras de desinterés','negativo'),
    -- Criterio
    (c_criterio, 'Tomó una decisión autónoma sin necesitar instrucciones',    'positivo'),
    (c_criterio, 'Evaluó si el prospecto calificaba antes de avanzar',        'positivo'),
    (c_criterio, 'Detectó una oportunidad y la capitalizó sin que se le dijera','positivo'),
    (c_criterio, 'Preguntó por cosas que podría haber resuelto solo',         'negativo'),
    (c_criterio, 'Avanzó con un lead que claramente no calificaba',           'negativo'),
    -- Profesionalismo de canal
    (c_canal, 'Usó mensajes cortos y directos por WhatsApp',           'positivo'),
    (c_canal, 'Respetó los horarios de contacto del prospecto',        'positivo'),
    (c_canal, 'Cuidó la imagen del canal en cada interacción',         'positivo'),
    (c_canal, 'Envió mensajes largos y difíciles de leer',             'negativo'),
    (c_canal, 'Contactó en horarios inapropiados',                     'negativo')
  on conflict do nothing;
end;
$$;

-- TABLA: evidencias
create table if not exists public.evidencias (
  id                 uuid primary key default gen_random_uuid(),
  persona_id         uuid references public.personas(id) on delete cascade,
  tipo               varchar(20) check (tipo in ('conversacion', 'reporte', 'simulacion', 'reunion', 'evaluacion')),
  fecha              date not null,
  contenido_raw      text,
  contenido_resumen  text,
  contexto_adicional text,
  fuente_externa_id  varchar(100),
  created_at         timestamptz not null default now()
);

alter table public.evidencias enable row level security;
drop policy if exists "evidencias_admin_all" on public.evidencias;
create policy "evidencias_admin_all" on public.evidencias for all using (true);

-- TABLA: comportamientos
create table if not exists public.comportamientos (
  id                   uuid primary key default gen_random_uuid(),
  evidencia_id         uuid references public.evidencias(id) on delete cascade,
  persona_id           uuid references public.personas(id) on delete cascade,
  capacidad_id         uuid references public.capacidades(id),
  catalogo_id          uuid references public.catalogo_comportamientos(id),
  etiqueta             varchar(150) not null,
  tipo                 varchar(10) check (tipo in ('positivo', 'negativo')),
  momento_descripcion  text,
  registrado_por       varchar(10) check (registrado_por in ('lider', 'ia', 'auto')),
  created_at           timestamptz not null default now()
);

alter table public.comportamientos enable row level security;
drop policy if exists "comportamientos_admin_all" on public.comportamientos;
create policy "comportamientos_admin_all" on public.comportamientos for all using (true);

-- TABLA: patrones
create table if not exists public.patrones (
  id           uuid primary key default gen_random_uuid(),
  persona_id   uuid references public.personas(id) on delete cascade,
  capacidad_id uuid references public.capacidades(id),
  catalogo_id  uuid references public.catalogo_comportamientos(id),
  etiqueta     varchar(150) not null,
  frecuencia   integer not null default 0,
  primera_vez  date,
  ultima_vez   date,
  tendencia    varchar(15) check (tendencia in ('aumentando', 'estable', 'disminuyendo')),
  updated_at   timestamptz not null default now(),
  constraint patrones_persona_etiqueta_unique unique (persona_id, etiqueta)
);

alter table public.patrones enable row level security;
drop policy if exists "patrones_admin_all" on public.patrones;
create policy "patrones_admin_all" on public.patrones for all using (true);

-- TABLA: intervenciones
create table if not exists public.intervenciones (
  id                  uuid primary key default gen_random_uuid(),
  persona_id          uuid references public.personas(id) on delete cascade,
  patron_id           uuid references public.patrones(id),
  capacidad_id        uuid references public.capacidades(id),
  tipo                varchar(20) check (tipo in ('roleplay', 'simulacion_ia', 'correccion', 'clase', 'mentoria')),
  fecha               date not null,
  resultado_observado text,
  created_at          timestamptz not null default now()
);

alter table public.intervenciones enable row level security;
drop policy if exists "intervenciones_admin_all" on public.intervenciones;
create policy "intervenciones_admin_all" on public.intervenciones for all using (true);

-- Función automática para calcular patrones
create or replace function public.calcular_patrones()
returns void as $$
begin
  insert into public.patrones
    (persona_id, capacidad_id, catalogo_id, etiqueta, frecuencia, primera_vez, ultima_vez, tendencia)
  select
    c.persona_id,
    c.capacidad_id,
    c.catalogo_id,
    c.etiqueta,
    count(*)::integer                                                     as frecuencia,
    min(e.fecha)                                                          as primera_vez,
    max(e.fecha)                                                          as ultima_vez,
    case
      when count(*) filter (where e.fecha >= current_date - 7) >
           count(*) filter (where e.fecha >= current_date - 14 and e.fecha < current_date - 7)
        then 'aumentando'
      when count(*) filter (where e.fecha >= current_date - 7) <
           count(*) filter (where e.fecha >= current_date - 14 and e.fecha < current_date - 7)
        then 'disminuyendo'
      else 'estable'
    end                                                                   as tendencia
  from public.comportamientos c
  join public.evidencias e on c.evidencia_id = e.id
  group by c.persona_id, c.capacidad_id, c.catalogo_id, c.etiqueta
  on conflict (persona_id, etiqueta) do update set
    frecuencia  = excluded.frecuencia,
    ultima_vez  = excluded.ultima_vez,
    tendencia   = excluded.tendencia,
    updated_at  = now();
end;
$$ language plpgsql security definer;
