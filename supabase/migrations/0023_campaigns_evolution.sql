-- =====================================================================
-- Camino al Closing — Migración 0023 (Campañas + Evolution API)
-- Instancias WhatsApp, campañas de prospección y leads por campaña.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Instancias WhatsApp (Evolution API)
create table if not exists public.evolution_instances (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  instance_key text not null unique,
  api_url      text not null,
  api_token    text not null,
  status       text not null default 'disconnected'
                 check (status in ('disconnected','connecting','connected','banned','error')),
  phone_number text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.evolution_instances enable row level security;
drop policy if exists "evo_admin_all" on public.evolution_instances;
create policy "evo_admin_all" on public.evolution_instances for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 2. Campañas de prospección
create table if not exists public.campaigns (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  channel              text not null default 'manual'
                         check (channel in ('manual','evolution','meta')),
  evolution_instance_id uuid references public.evolution_instances(id) on delete set null,
  template_id          uuid references public.message_templates(id) on delete set null,
  status               text not null default 'draft'
                         check (status in ('draft','active','paused','completed','cancelled')),
  target_segment       jsonb not null default '{}',
  send_rules           jsonb not null default '{"max_per_hour":80,"pause_seconds":30,"auto_stop_fail_rate":0.3}',
  total_leads          integer not null default 0,
  sent_count           integer not null default 0,
  delivered_count      integer not null default 0,
  replied_count        integer not null default 0,
  failed_count         integer not null default 0,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  starts_at            timestamptz,
  ends_at              timestamptz
);

create index if not exists campaigns_status_idx on public.campaigns(status);
create index if not exists campaigns_created_by_idx on public.campaigns(created_by);

alter table public.campaigns enable row level security;
drop policy if exists "camp_admin_all"   on public.campaigns;
drop policy if exists "camp_setter_read" on public.campaigns;
create policy "camp_admin_all"   on public.campaigns for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "camp_setter_read" on public.campaigns for select
  using (auth.uid() is not null);

-- 3. Leads de campaña (junction con estado por lead)
create table if not exists public.campaign_leads (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  setter_id    uuid references public.profiles(id) on delete set null,
  status       text not null default 'pending'
                 check (status in ('pending','sending','sent','delivered','read','failed','replied','skipped')),
  message_body text,
  sent_at      timestamptz,
  delivered_at timestamptz,
  read_at      timestamptz,
  replied_at   timestamptz,
  failed_at    timestamptz,
  error_message text,
  created_at   timestamptz not null default now(),
  unique(campaign_id, lead_id)
);

create index if not exists cl_campaign_idx on public.campaign_leads(campaign_id);
create index if not exists cl_lead_idx     on public.campaign_leads(lead_id);
create index if not exists cl_setter_idx   on public.campaign_leads(setter_id);
create index if not exists cl_status_idx   on public.campaign_leads(status);

alter table public.campaign_leads enable row level security;
drop policy if exists "cl_admin_all"   on public.campaign_leads;
drop policy if exists "cl_setter_own"  on public.campaign_leads;
create policy "cl_admin_all"   on public.campaign_leads for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "cl_setter_own"  on public.campaign_leads for select
  using (auth.uid() = setter_id);

-- FIN migración 0023
