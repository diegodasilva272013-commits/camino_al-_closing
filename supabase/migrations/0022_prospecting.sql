-- =====================================================================
-- Camino al Closing — Migración 0022 (Sistema de Prospección CAC)
-- Plantillas, mensajes enviados, conversaciones y evaluaciones IA.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Plantillas de mensajes aprobadas por el admin
create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'apertura'
                check (category in ('apertura', 'seguimiento', 'reactivacion', 'cierre', 'general')),
  body        text not null,
  tone        text not null default 'humano'
                check (tone in ('directo', 'humano', 'curioso', 'profesional', 'calido')),
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.message_templates enable row level security;
drop policy if exists "tpl_admin_all"  on public.message_templates;
drop policy if exists "tpl_users_read" on public.message_templates;
create policy "tpl_admin_all"  on public.message_templates for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "tpl_users_read" on public.message_templates for select
  using (is_active = true);

-- 2. Mensajes enviados en prospección (registro de apertura)
create table if not exists public.prospecting_messages (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  setter_id     uuid not null references public.profiles(id) on delete cascade,
  template_id   uuid references public.message_templates(id) on delete set null,
  message_body  text not null,
  message_type  text not null default 'manual'
                  check (message_type in ('manual','template','ai_assisted','follow_up')),
  sent_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists pm_lead_idx   on public.prospecting_messages(lead_id);
create index if not exists pm_setter_idx on public.prospecting_messages(setter_id);

alter table public.prospecting_messages enable row level security;
drop policy if exists "pm_admin_all"  on public.prospecting_messages;
drop policy if exists "pm_setter_own" on public.prospecting_messages;
create policy "pm_admin_all"  on public.prospecting_messages for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "pm_setter_own" on public.prospecting_messages for all
  using (auth.uid() = setter_id) with check (auth.uid() = setter_id);

-- 3. Conversación por (lead, setter) — una activa por par
create table if not exists public.prospecting_conversations (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  setter_id       uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'waiting_response'
                    check (status in ('open','waiting_response','responded','scheduled','closed','lost')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(lead_id, setter_id)
);

create index if not exists pc_setter_idx on public.prospecting_conversations(setter_id);
create index if not exists pc_lead_idx   on public.prospecting_conversations(lead_id);

alter table public.prospecting_conversations enable row level security;
drop policy if exists "pc_admin_all"  on public.prospecting_conversations;
drop policy if exists "pc_setter_own" on public.prospecting_conversations;
create policy "pc_admin_all"  on public.prospecting_conversations for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "pc_setter_own" on public.prospecting_conversations for all
  using (auth.uid() = setter_id) with check (auth.uid() = setter_id);

-- 4. Mensajes individuales de cada conversación (enviados + recibidos)
create table if not exists public.prospecting_conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.prospecting_conversations(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,
  setter_id       uuid not null references public.profiles(id) on delete cascade,
  direction       text not null check (direction in ('outbound','inbound')),
  body            text not null,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists pcm_conv_idx on public.prospecting_conversation_messages(conversation_id);

alter table public.prospecting_conversation_messages enable row level security;
drop policy if exists "pcm_admin_all"  on public.prospecting_conversation_messages;
drop policy if exists "pcm_setter_own" on public.prospecting_conversation_messages;
create policy "pcm_admin_all"  on public.prospecting_conversation_messages for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "pcm_setter_own" on public.prospecting_conversation_messages for all
  using (auth.uid() = setter_id) with check (auth.uid() = setter_id);

-- 5. Evaluaciones IA de conversaciones de prospección
create table if not exists public.ai_prospecting_evaluations (
  id                      uuid primary key default gen_random_uuid(),
  conversation_id         uuid not null references public.prospecting_conversations(id) on delete cascade,
  setter_id               uuid not null references public.profiles(id) on delete cascade,
  lead_id                 uuid not null references public.leads(id) on delete cascade,
  score_total             numeric,
  score_opening           numeric,
  score_connection        numeric,
  score_questions         numeric,
  score_defense_handling  numeric,
  score_rapport           numeric,
  score_advance           numeric,
  score_commercial_criteria numeric,
  summary                 text,
  strengths               text[],
  weaknesses              text[],
  mistakes                text[],
  recommendations         text[],
  next_exercise           text,
  created_at              timestamptz not null default now()
);

create index if not exists ape_setter_idx on public.ai_prospecting_evaluations(setter_id);
create index if not exists ape_conv_idx   on public.ai_prospecting_evaluations(conversation_id);

alter table public.ai_prospecting_evaluations enable row level security;
drop policy if exists "ape_admin_all"  on public.ai_prospecting_evaluations;
drop policy if exists "ape_setter_own" on public.ai_prospecting_evaluations;
create policy "ape_admin_all"  on public.ai_prospecting_evaluations for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "ape_setter_own" on public.ai_prospecting_evaluations for select
  using (auth.uid() = setter_id);

-- FIN migración 0022
|1