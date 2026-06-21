-- =====================================================================
-- Camino al Closing — Migración 0020 (Sistema de Comunicados)
-- Comunicados internos con confirmación de lectura.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  type        text not null default 'comunicado'
                check (type in ('comunicado', 'urgente', 'strike', 'formulario', 'reunion', 'cambio')),
  target      text not null default 'todos'
                check (target in ('todos', 'equipo', 'comunidad')),
  deadline    timestamptz,
  is_pinned   boolean not null default false,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists ann_target_idx on public.announcements(target, is_active, created_at desc);

alter table public.announcements enable row level security;
drop policy if exists "ann_admin_all"    on public.announcements;
drop policy if exists "ann_users_select" on public.announcements;
create policy "ann_admin_all"    on public.announcements for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "ann_users_select" on public.announcements for select
  using (is_active = true);

create table if not exists public.announcement_reads (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  unique(announcement_id, user_id)
);

create index if not exists ar_ann_idx  on public.announcement_reads(announcement_id);
create index if not exists ar_user_idx on public.announcement_reads(user_id);

alter table public.announcement_reads enable row level security;
drop policy if exists "reads_admin_all" on public.announcement_reads;
drop policy if exists "reads_own_all"   on public.announcement_reads;
create policy "reads_admin_all" on public.announcement_reads for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "reads_own_all"   on public.announcement_reads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- FIN migración 0020
