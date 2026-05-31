-- =====================================================================
-- Camino al Closing — Migración 0011 (Web Push Notifications)
-- Suscripciones por dispositivo + columna de tracking en notifications.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- =====================================================================
-- 1. Tabla de suscripciones push (1 por dispositivo/navegador)
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists push_sub_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_sub_own_select" on public.push_subscriptions;
create policy "push_sub_own_select" on public.push_subscriptions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "push_sub_own_insert" on public.push_subscriptions;
create policy "push_sub_own_insert" on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_sub_own_delete" on public.push_subscriptions;
create policy "push_sub_own_delete" on public.push_subscriptions for delete
  using (auth.uid() = user_id);

drop policy if exists "push_sub_admin" on public.push_subscriptions;
create policy "push_sub_admin" on public.push_subscriptions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 2. Tracking en notifications: cuándo se mandó el push
-- =====================================================================
alter table public.notifications
  add column if not exists pushed_at timestamptz;

create index if not exists notifications_pending_push_idx
  on public.notifications(created_at)
  where pushed_at is null;

-- =====================================================================
-- FIN migración 0011
-- =====================================================================
