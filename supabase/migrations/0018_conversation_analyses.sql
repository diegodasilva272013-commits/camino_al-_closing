-- =====================================================================
-- Camino al Closing — Migración 0018 (Sistema de Análisis de Conversaciones)
-- Sistema 1: Aprendizaje por análisis de conversaciones reales.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Tabla principal de análisis
create table if not exists public.conversation_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  raw_text    text not null,
  analysis    jsonb,
  status      text not null default 'analyzing'
              check (status in ('analyzing', 'ready', 'error')),
  created_at  timestamptz not null default now()
);

create index if not exists ca_user_idx on public.conversation_analyses(user_id, created_at desc);

alter table public.conversation_analyses enable row level security;

drop policy if exists "ca_own_select" on public.conversation_analyses;
create policy "ca_own_select" on public.conversation_analyses
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "ca_own_insert" on public.conversation_analyses;
create policy "ca_own_insert" on public.conversation_analyses
  for insert with check (auth.uid() = user_id);

drop policy if exists "ca_own_update" on public.conversation_analyses;
create policy "ca_own_update" on public.conversation_analyses
  for update using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- 2. Tabla de reflexiones
create table if not exists public.conversation_reflections (
  id           uuid primary key default gen_random_uuid(),
  analysis_id  uuid not null references public.conversation_analyses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  answers      jsonb not null,
  evaluation   jsonb,
  xp_earned    int not null default 0,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  unique(analysis_id)
);

create index if not exists cr_user_idx on public.conversation_reflections(user_id, created_at desc);

alter table public.conversation_reflections enable row level security;

drop policy if exists "cr_own_select" on public.conversation_reflections;
create policy "cr_own_select" on public.conversation_reflections
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "cr_own_insert" on public.conversation_reflections;
create policy "cr_own_insert" on public.conversation_reflections
  for insert with check (auth.uid() = user_id);

drop policy if exists "cr_own_update" on public.conversation_reflections;
create policy "cr_own_update" on public.conversation_reflections
  for update using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- FIN migración 0018
