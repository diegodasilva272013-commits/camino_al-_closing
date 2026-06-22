-- ── Diego 2030 — Ecosistema del Fundador — Schema Definitivo ─────────────────
-- REEMPLAZA las migraciones 0027 y 0028.
-- Si no corriste 0027 ni 0028 todavía: corré SOLO este.
-- Si los corriste: primero dropear las tablas d2030_* (o contactar para migrar).

-- ── PERFIL (raíz del sistema — una sola fila, Diego) ─────────────────────────
CREATE TABLE IF NOT EXISTS perfil (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL DEFAULT 'Diego',
  rol_objetivo    TEXT NOT NULL DEFAULT 'CAC CEO',
  estado_resumen  TEXT,        -- generado por IA, nunca escrito a mano
  ultima_actualizacion TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO perfil (nombre, rol_objetivo) VALUES ('Diego', 'CAC CEO')
ON CONFLICT DO NOTHING;

-- ── OBJETIVO_CRECIMIENTO (las capacidades — editables desde la app) ───────────
-- Para agregar o cambiar una capacidad: INSERT/UPDATE desde la app. Sin migrations.
-- El prompt de análisis se genera DINÁMICAMENTE desde esta tabla en cada extracción.
CREATE TABLE IF NOT EXISTS objetivo_crecimiento (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             UUID NOT NULL REFERENCES perfil(id) ON DELETE CASCADE,
  nombre                TEXT NOT NULL,          -- clave interna: 'delegacion'
  nombre_display        TEXT NOT NULL,          -- nombre legible: 'Delegación'
  definicion            TEXT NOT NULL,          -- qué significa esta capacidad
  meta_2030             TEXT NOT NULL,          -- cómo se ve dominar esto en 2030
  criterios_evaluacion  TEXT NOT NULL,          -- qué busca la IA al analizar
  nivel_actual          NUMERIC(4,1),           -- cache rolling, nunca manual
  peso_relativo         NUMERIC NOT NULL DEFAULT 1.0,
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  orden                 INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: las 6 capacidades del Motor CAC CEO como filas editables
DO $$
DECLARE p_id UUID;
BEGIN
  SELECT id INTO p_id FROM perfil LIMIT 1;
  INSERT INTO objetivo_crecimiento
    (perfil_id, nombre, nombre_display, definicion, meta_2030, criterios_evaluacion, orden)
  VALUES
    (p_id, 'claridad_ejecutiva', 'Claridad Ejecutiva',
     'Convertir complejidad en claridad. Explicar ideas complejas con precisión y brevedad. Evitar sobreexplicación y desvíos.',
     'Que cualquier indicación mía se entienda sin repreguntas. Cero ambigüedad en dirección.',
     'Buscar si Diego articula qué hay que hacer, por qué y con qué prioridad. ¿Terminó con una instrucción clara? ¿O se fue por las ramas?',
     1),
    (p_id, 'priorizacion', 'Priorización',
     'Detectar lo esencial y eliminar ruido. Máximo 2 prioridades reales a la vez. Decidir qué NO hacer.',
     'Que el equipo siempre sepa qué es lo más importante de la semana y por qué. Que no desperdicie energía en low-leverage.',
     'Buscar si Diego nombra prioridades explícitas, si descarta cosas deliberadamente, si evita dispersión.',
     2),
    (p_id, 'delegacion', 'Delegación',
     'Construir autonomía y evitar dependencia del fundador. Transferir pensamiento, no solo tareas. Definir dueño claro y resultado esperado.',
     'Que el 80% de lo operativo lo ejecute el equipo sin que yo intervenga. Que confíe sin controlar cada paso.',
     'Buscar si Diego asignó responsabilidades con dueño claro, si soltó o retomó el control, si transfirió el razonamiento o solo la tarea.',
     3),
    (p_id, 'seguimiento', 'Seguimiento',
     'Cerrar ciclos y sostener ejecución. Registrar compromisos, verificar implementación real, detectar bloqueos temprano.',
     'Que nada quede sin cerrar. Que los compromisos de una reunión se cumplan y yo lo sepa.',
     'Buscar si Diego preguntó por avances de tareas anteriores, si cerró loops abiertos, si detectó bloqueos o dejó cosas en el aire.',
     4),
    (p_id, 'comunicacion_ejecutiva', 'Comunicación Ejecutiva',
     'Transmitir visión, decisiones y dirección con impacto. Mensaje corto, estructura clara, cierre con acción concreta.',
     'Que mis mensajes generen movimiento inmediato. Que nunca haya que repreguntar qué hacer después de escucharme.',
     'Buscar si Diego estructuró bien su mensaje, si fue directo, si terminó con una acción concreta, si fue demasiado largo o vago.',
     5),
    (p_id, 'presencia', 'Presencia',
     'Generar autoridad, atención y dominio en reuniones, clases y mentorías. Pausas intencionales, ritmo, lectura de audiencia.',
     'Que cuando entre a un cuarto o empiece a hablar, el ambiente cambie. Presencia que no necesita volumen para tener autoridad.',
     'Buscar si Diego usó pausas, si mantuvo el ritmo, si leyó a la audiencia, si habló con autoridad o se dispersó.',
     6)
  ON CONFLICT DO NOTHING;
END $$;

-- ── EVIDENCIA (input al pipeline — se crea desde la grabación o directo) ──────
CREATE TABLE IF NOT EXISTS evidencia (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    UUID NOT NULL REFERENCES perfil(id),
  grabacion_id UUID,           -- FK a grabacion; se agrega con ALTER luego (evitar circular)
  tipo         TEXT NOT NULL,
  texto        TEXT NOT NULL,  -- la transcripción completa
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  estado       TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'error')),
  error_detalle TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── COMPORTAMIENTO (el átomo del sistema) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS comportamiento (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidencia_id      UUID NOT NULL REFERENCES evidencia(id) ON DELETE CASCADE,
  descripcion       TEXT NOT NULL,
  cita              TEXT NOT NULL,
  timestamp_inicio  NUMERIC,    -- segundo del video donde ocurre
  timestamp_fin     NUMERIC,
  speaker_contexto  TEXT,       -- con quién interactuaba Diego
  tonalidad         TEXT,       -- tono del momento
  fecha             DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- M:M comportamiento ↔ capacidad, con valencia y peso EN la relación
CREATE TABLE IF NOT EXISTS comportamiento_capacidad (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comportamiento_id UUID NOT NULL REFERENCES comportamiento(id) ON DELETE CASCADE,
  capacidad_id      UUID NOT NULL REFERENCES objetivo_crecimiento(id),
  valencia          TEXT NOT NULL CHECK (valencia IN ('refuerza', 'debilita')),
  peso              NUMERIC NOT NULL CHECK (peso BETWEEN 0.1 AND 1.0),
  justificacion     TEXT
);

-- ── MEDICION (append-only — base del timeline y comparaciones históricas) ──────
-- NUNCA se sobreescriben. nivel_actual = cache rolling sobre mediciones.
CREATE TABLE IF NOT EXISTS medicion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacidad_id    UUID NOT NULL REFERENCES objetivo_crecimiento(id),
  evidencia_id    UUID REFERENCES evidencia(id),
  valor           NUMERIC NOT NULL CHECK (valor BETWEEN -10 AND 10),  -- aporte neto
  nivel_acumulado NUMERIC,    -- cache del nivel después de esta medición
  justificacion   TEXT,
  fecha           DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── GRABACION (el video completo con audio, guardado en Cloudflare R2) ─────────
CREATE TABLE IF NOT EXISTS grabacion (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id                 UUID NOT NULL REFERENCES perfil(id),
  titulo                    TEXT NOT NULL,
  tipo                      TEXT NOT NULL CHECK (tipo IN ('reunion', 'clase', 'mentoria', 'otro')),
  fecha                     DATE NOT NULL DEFAULT CURRENT_DATE,
  participantes             TEXT,

  -- Video en R2 (comprimido desde el browser con ffmpeg.wasm)
  storage_path              TEXT,       -- key en el bucket R2
  video_url                 TEXT,       -- URL pública para reproducir
  duracion_segundos         INTEGER,
  archivo_original_nombre   TEXT,
  archivo_original_tamano   BIGINT,
  archivo_comprimido_tamano BIGINT,

  -- Relación con el pipeline
  evidencia_id              UUID REFERENCES evidencia(id),

  -- Estado del procesamiento
  estado                    TEXT NOT NULL DEFAULT 'comprimiendo'
    CHECK (estado IN ('comprimiendo', 'subiendo', 'transcribiendo',
                      'analizando', 'completada', 'error')),
  error_detalle             TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK circular resuelta: evidencia → grabacion
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS grabacion_fk UUID REFERENCES grabacion(id);

-- ── TRANSCRIPCION (output de Whisper — con timestamps y speakers) ─────────────
CREATE TABLE IF NOT EXISTS transcripcion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grabacion_id    UUID NOT NULL REFERENCES grabacion(id) ON DELETE CASCADE,
  texto_completo  TEXT NOT NULL,
  segmentos       JSONB NOT NULL,   -- [{speaker, start, end, text}]
  speakers        JSONB,            -- [{nombre, tiempo_total, porcentaje}]
  modelo_usado    TEXT NOT NULL DEFAULT 'whisper-large-v3',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PATRON (comportamiento recurrente detectado sobre múltiples evidencias) ─────
CREATE TABLE IF NOT EXISTS patron (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         UUID NOT NULL REFERENCES perfil(id),
  descripcion       TEXT NOT NULL,
  frecuencia        INTEGER NOT NULL DEFAULT 1,
  primera_aparicion DATE,
  ultima_aparicion  DATE,
  estado            TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'mejorando', 'resuelto')),
  capacidad_raiz    UUID REFERENCES objetivo_crecimiento(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- M:M patrón ↔ comportamiento
CREATE TABLE IF NOT EXISTS patron_comportamiento (
  patron_id         UUID NOT NULL REFERENCES patron(id) ON DELETE CASCADE,
  comportamiento_id UUID NOT NULL REFERENCES comportamiento(id) ON DELETE CASCADE,
  PRIMARY KEY (patron_id, comportamiento_id)
);

-- ── INTERVENCION (prescripción activa contra un patrón) ──────────────────────
CREATE TABLE IF NOT EXISTS intervencion (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id        UUID NOT NULL REFERENCES perfil(id),
  patron_id        UUID REFERENCES patron(id),
  descripcion      TEXT NOT NULL,
  criterio_de_exito TEXT,
  estado           TEXT NOT NULL DEFAULT 'propuesta'
    CHECK (estado IN ('propuesta', 'activa', 'completada', 'abandonada')),
  fecha_inicio     DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── EJERCICIO (práctica concreta para desarrollar una capacidad) ──────────────
CREATE TABLE IF NOT EXISTS ejercicio (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    UUID NOT NULL REFERENCES perfil(id),
  capacidad_id UUID NOT NULL REFERENCES objetivo_crecimiento(id),
  descripcion  TEXT NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_curso', 'hecho', 'validado')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VALIDACION (cierra el loop — ¿la intervención/ejercicio cambió algo?) ──────
CREATE TABLE IF NOT EXISTS validacion (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                 TEXT NOT NULL CHECK (tipo IN ('intervencion', 'ejercicio')),
  referencia_id        UUID NOT NULL,
  evidencia_antes_id   UUID REFERENCES evidencia(id),
  evidencia_despues_id UUID REFERENCES evidencia(id),
  resultado            TEXT CHECK (resultado IN ('mejoro', 'igual', 'empeoro')),
  observaciones        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INSUMO (lo que Diego consume — NO mide, genera hipótesis) ────────────────
CREATE TABLE IF NOT EXISTS insumo (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             UUID NOT NULL REFERENCES perfil(id),
  tipo                  TEXT NOT NULL
    CHECK (tipo IN ('youtube', 'audiolibro', 'libro', 'apunte', 'curso', 'otro')),
  titulo                TEXT NOT NULL,
  url                   TEXT,
  notas                 TEXT,
  capacidades_hipotesis UUID[],   -- IDs de objetivo_crecimiento
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SENAL_EQUIPO (medición indirecta de Diego via resultados del equipo) ───────
CREATE TABLE IF NOT EXISTS senal_equipo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    UUID NOT NULL REFERENCES perfil(id),
  descripcion  TEXT NOT NULL,
  tipo         TEXT CHECK (tipo IN ('resultado', 'reaccion', 'feedback')),
  capacidad_id UUID REFERENCES objetivo_crecimiento(id),
  valencia     TEXT CHECK (valencia IN ('refuerza', 'debilita')),
  peso         NUMERIC NOT NULL DEFAULT 0.5,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS (solo admins) ─────────────────────────────────────────────────────────
ALTER TABLE perfil                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE objetivo_crecimiento     ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencia                ENABLE ROW LEVEL SECURITY;
ALTER TABLE comportamiento           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comportamiento_capacidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicion                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE grabacion                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripcion            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patron                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patron_comportamiento    ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervencion             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejercicio                ENABLE ROW LEVEL SECURITY;
ALTER TABLE validacion               ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE senal_equipo             ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "admins" ON perfil                   FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON objetivo_crecimiento     FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON evidencia                FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON comportamiento           FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON comportamiento_capacidad FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON medicion                 FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON grabacion                FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON transcripcion            FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON patron                   FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON patron_comportamiento    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON intervencion             FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON ejercicio                FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON validacion               FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON insumo                   FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admins" ON senal_equipo             FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ÍNDICES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_objetivo_perfil    ON objetivo_crecimiento(perfil_id, orden);
CREATE INDEX IF NOT EXISTS idx_objetivo_activo    ON objetivo_crecimiento(activo, orden);
CREATE INDEX IF NOT EXISTS idx_evidencia_perfil   ON evidencia(perfil_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_evidencia_estado   ON evidencia(estado);
CREATE INDEX IF NOT EXISTS idx_comp_evidencia     ON comportamiento(evidencia_id);
CREATE INDEX IF NOT EXISTS idx_compcap_cap        ON comportamiento_capacidad(capacidad_id);
CREATE INDEX IF NOT EXISTS idx_compcap_comp       ON comportamiento_capacidad(comportamiento_id);
CREATE INDEX IF NOT EXISTS idx_medicion_cap_fecha ON medicion(capacidad_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_medicion_evidencia ON medicion(evidencia_id);
CREATE INDEX IF NOT EXISTS idx_grabacion_perfil   ON grabacion(perfil_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_grabacion_estado   ON grabacion(estado);
CREATE INDEX IF NOT EXISTS idx_patron_perfil      ON patron(perfil_id);
CREATE INDEX IF NOT EXISTS idx_insumo_perfil      ON insumo(perfil_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_senal_perfil       ON senal_equipo(perfil_id, fecha DESC);
