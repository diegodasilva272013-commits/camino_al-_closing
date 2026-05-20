-- =====================================================================
-- Seed inicial: curso "Lanzamiento Camino al Closing — 5 Días" y módulos
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- =====================================================================

insert into public.courses (title, description, is_published)
select
  'Lanzamiento Camino al Closing — 5 Días',
  'Entrenamiento privado para aprender las bases de apertura, cualificación, manejo de objeciones y cierre.',
  true
where not exists (
  select 1 from public.courses
  where title = 'Lanzamiento Camino al Closing — 5 Días'
);

with c as (
  select id from public.courses
  where title = 'Lanzamiento Camino al Closing — 5 Días'
  limit 1
)
insert into public.modules (course_id, title, description, order_index)
select c.id, m.title, m.description, m.order_index
from c
cross join (values
  ('Día 1 — Apertura de llamada',   'Cómo iniciar una conversación de venta con autoridad.', 1),
  ('Día 2 — Cualificación',         'Cómo detectar intención, necesidad y capacidad de compra.', 2),
  ('Día 3 — Manejo de objeciones',  'Cómo entender y resolver objeciones sin perder autoridad.', 3),
  ('Día 4 — Cierre',                'Cómo avanzar la conversación hacia la decisión.', 4),
  ('Día 5 — Simulación real',       'Roleplay, práctica y plan de acción.', 5)
) as m(title, description, order_index)
where not exists (
  select 1 from public.modules
  where course_id = c.id and title = m.title
);
