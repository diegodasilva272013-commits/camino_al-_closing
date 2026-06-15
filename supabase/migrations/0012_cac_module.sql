-- =====================================================================
-- Camino al Closing — Migración 0012 (Módulo CAC)
-- Código de acceso en registro, bloqueo de contenido, módulo de leads,
-- reportes diarios, mensajes de apertura y trainer IA.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- =====================================================================
-- 1. Columnas nuevas en profiles
-- =====================================================================
alter table public.profiles
  add column if not exists content_unlocked boolean not null default false,
  add column if not exists access_code text;

-- =====================================================================
-- 2. Tabla invite_codes (códigos de invitación para el registro)
-- =====================================================================
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text,
  max_uses int not null default 1,
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

drop policy if exists "invite_codes_admin_all" on public.invite_codes;
create policy "invite_codes_admin_all"
on public.invite_codes for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Lectura pública (anon) para validar código en registro
drop policy if exists "invite_codes_read_anon" on public.invite_codes;
create policy "invite_codes_read_anon"
on public.invite_codes for select
using (true);

-- =====================================================================
-- 3. Tabla leads
-- =====================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  phone text not null,
  country text,
  source text,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  batch_id text,
  assigned_at timestamptz,
  current_status text not null default 'NO_CONTACTADO',
  follow_up_count int not null default 0,
  max_follow_ups int not null default 5,
  last_action_at timestamptz,
  next_follow_up_at timestamptz,
  opening_message_used text,
  notes text,
  is_closed boolean not null default false,
  closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assigned_idx on public.leads(assigned_to_user_id);
create index if not exists leads_status_idx on public.leads(current_status);
create index if not exists leads_closed_idx on public.leads(is_closed);

drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

alter table public.leads enable row level security;

-- Admin: acceso total
drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all"
on public.leads for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Setter: solo ver sus propios leads asignados
drop policy if exists "leads_setter_select" on public.leads;
create policy "leads_setter_select"
on public.leads for select
using (auth.uid() = assigned_to_user_id);

-- Setter: puede actualizar sus propios leads (status, notas, etc.)
drop policy if exists "leads_setter_update" on public.leads;
create policy "leads_setter_update"
on public.leads for update
using (auth.uid() = assigned_to_user_id);

-- =====================================================================
-- 4. Tabla lead_activities (historial de acciones sobre un lead)
-- =====================================================================
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  previous_status text,
  new_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities(lead_id, created_at desc);

alter table public.lead_activities enable row level security;

drop policy if exists "lead_activities_admin_all" on public.lead_activities;
create policy "lead_activities_admin_all"
on public.lead_activities for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "lead_activities_setter_read" on public.lead_activities;
create policy "lead_activities_setter_read"
on public.lead_activities for select
using (auth.uid() = user_id);

drop policy if exists "lead_activities_setter_insert" on public.lead_activities;
create policy "lead_activities_setter_insert"
on public.lead_activities for insert
with check (auth.uid() = user_id);

-- =====================================================================
-- 5. Tabla daily_reports (reporte diario del setter)
-- =====================================================================
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  total_assigned int not null default 0,
  total_contacted int not null default 0,
  total_no_contacted int not null default 0,
  total_no_response int not null default 0,
  total_responded int not null default 0,
  total_interested int not null default 0,
  total_invited_to_group int not null default 0,
  total_entered_group int not null default 0,
  total_active_group int not null default 0,
  total_diagnosis_started int not null default 0,
  total_deep_diagnosis int not null default 0,
  total_meeting_proposed int not null default 0,
  total_meeting_scheduled int not null default 0,
  total_no_fit int not null default 0,
  total_future_follow_up int not null default 0,
  pending_follow_ups int not null default 0,
  completed_leads int not null default 0,
  productivity_score int not null default 0,
  summary text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

create index if not exists daily_reports_user_date_idx on public.daily_reports(user_id, date desc);

alter table public.daily_reports enable row level security;

drop policy if exists "daily_reports_admin_all" on public.daily_reports;
create policy "daily_reports_admin_all"
on public.daily_reports for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "daily_reports_setter_own" on public.daily_reports;
create policy "daily_reports_setter_own"
on public.daily_reports for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =====================================================================
-- 6. Tabla opening_messages (mensajes de apertura del setter)
-- =====================================================================
create table if not exists public.opening_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  message text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opening_messages_user_idx on public.opening_messages(user_id);

drop trigger if exists set_updated_at on public.opening_messages;
create trigger set_updated_at
  before update on public.opening_messages
  for each row execute procedure public.set_updated_at();

alter table public.opening_messages enable row level security;

drop policy if exists "opening_messages_admin_all" on public.opening_messages;
create policy "opening_messages_admin_all"
on public.opening_messages for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "opening_messages_setter_own" on public.opening_messages;
create policy "opening_messages_setter_own"
on public.opening_messages for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =====================================================================
-- 7. Tabla trainer_brain (prompt y configuración del AI Trainer)
-- =====================================================================
create table if not exists public.trainer_brain (
  id int primary key default 1,
  base_prompt text not null default '',
  rules text not null default '',
  mode_fria text not null default '',
  mode_tibia text not null default '',
  mode_caliente text not null default '',
  updated_at timestamptz not null default now(),
  constraint trainer_brain_single_row check (id = 1)
);

alter table public.trainer_brain enable row level security;

drop policy if exists "trainer_brain_admin_all" on public.trainer_brain;
create policy "trainer_brain_admin_all"
on public.trainer_brain for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "trainer_brain_read_authenticated" on public.trainer_brain;
create policy "trainer_brain_read_authenticated"
on public.trainer_brain for select
using (auth.role() = 'authenticated');

-- Fila inicial (idempotente)
insert into public.trainer_brain (id) values (1)
on conflict (id) do nothing;

-- =====================================================================
-- 8. Tabla trainer_files (archivos de entrenamiento para el trainer IA)
-- =====================================================================
create table if not exists public.trainer_files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content_text text not null default '',
  size_bytes int,
  created_at timestamptz not null default now()
);

alter table public.trainer_files enable row level security;

drop policy if exists "trainer_files_admin_all" on public.trainer_files;
create policy "trainer_files_admin_all"
on public.trainer_files for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "trainer_files_read_authenticated" on public.trainer_files;
create policy "trainer_files_read_authenticated"
on public.trainer_files for select
using (auth.role() = 'authenticated');

-- =====================================================================
-- 9. Storage bucket: community (fotos y audios del onboarding)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('community', 'community', true)
on conflict (id) do update set public = true;

drop policy if exists "community_read_all" on storage.objects;
create policy "community_read_all"
on storage.objects for select
using (bucket_id = 'community');

drop policy if exists "community_insert_authenticated" on storage.objects;
create policy "community_insert_authenticated"
on storage.objects for insert
to authenticated
with check (bucket_id = 'community');

drop policy if exists "community_update_own" on storage.objects;
create policy "community_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "community_delete_admin" on storage.objects;
create policy "community_delete_admin"
on storage.objects for delete
using (bucket_id = 'community' and public.is_admin(auth.uid()));

-- =====================================================================
-- 10. Datos iniciales
-- =====================================================================

-- Código de invitación por defecto para setters
insert into public.invite_codes (code, label, max_uses, is_active)
values ('CLOSING2025', 'Código general setters', 100, true)
on conflict (code) do nothing;

-- Desbloquear contenido para el admin
update public.profiles
  set content_unlocked = true
  where role = 'admin';

-- =====================================================================
-- FIN migración 0012
-- =====================================================================
