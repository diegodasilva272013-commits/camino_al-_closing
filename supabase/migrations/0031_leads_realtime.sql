-- Habilita Supabase Realtime para la tabla leads
-- Necesario para que los cambios de setters aparezcan en tiempo real en admin

alter publication supabase_realtime add table public.leads;

-- REPLICA IDENTITY FULL para que los eventos UPDATE incluyan la fila completa
alter table public.leads replica identity full;
