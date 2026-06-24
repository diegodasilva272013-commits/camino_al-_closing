-- =====================================================================
-- Migración 0034 · Regla 1.5: campo origen en tablas de conversación
-- Prepara la entrada automática futura (WhatsApp, videollamada, teléfono).
-- Hoy = 'manual'. Mañana, cuando se integre un canal, el dato entra en
-- la misma tabla con otro origen y toda la cadena sigue sin cambios.
-- =====================================================================

-- conversation_analyses
alter table public.conversation_analyses
  add column if not exists origen text not null default 'manual'
  check (origen in ('manual', 'whatsapp', 'videollamada', 'telefono', 'evolution_api'));

-- prospecting_conversations (mensajes de prospección)
alter table public.prospecting_conversations
  add column if not exists origen text not null default 'manual'
  check (origen in ('manual', 'whatsapp', 'evolution_api'));

-- prospecting_conversation_messages (mensajes individuales)
alter table public.prospecting_conversation_messages
  add column if not exists origen text not null default 'manual'
  check (origen in ('manual', 'whatsapp', 'evolution_api'));
