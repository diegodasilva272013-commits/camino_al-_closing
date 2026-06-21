-- =====================================================================
-- Camino al Closing — Migración 0019 (Sistema de Formularios de Refuerzo)
-- Formularios dinámicos por clase/tema con análisis IA por setter.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Formularios
create table if not exists public.reinforcement_forms (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  topic        text,
  is_active    boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.reinforcement_forms enable row level security;
drop policy if exists "rf_admin_all" on public.reinforcement_forms;
create policy "rf_admin_all" on public.reinforcement_forms for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "rf_users_select" on public.reinforcement_forms;
create policy "rf_users_select" on public.reinforcement_forms for select
  using (is_active = true);

-- 2. Preguntas
create table if not exists public.reinforcement_questions (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.reinforcement_forms(id) on delete cascade,
  order_index   int not null default 0,
  question_text text not null,
  category      text,
  is_required   boolean not null default true,
  is_bonus      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists rq_form_idx on public.reinforcement_questions(form_id, order_index);
alter table public.reinforcement_questions enable row level security;
drop policy if exists "rq_admin_all" on public.reinforcement_questions;
create policy "rq_admin_all" on public.reinforcement_questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "rq_users_select" on public.reinforcement_questions;
create policy "rq_users_select" on public.reinforcement_questions for select
  using (exists (select 1 from public.reinforcement_forms f where f.id = form_id and f.is_active = true));

-- 3. Entregas
create table if not exists public.reinforcement_submissions (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid not null references public.reinforcement_forms(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'analyzing' check (status in ('analyzing', 'analyzed', 'error')),
  total_score    int,
  ai_risk        text check (ai_risk in ('bajo', 'medio', 'alto')),
  nivel_general  text,
  analysis       jsonb,
  submitted_at   timestamptz not null default now(),
  unique(form_id, user_id)
);

create index if not exists rs_form_idx on public.reinforcement_submissions(form_id);
create index if not exists rs_user_idx on public.reinforcement_submissions(user_id);
alter table public.reinforcement_submissions enable row level security;
drop policy if exists "rs_admin_all" on public.reinforcement_submissions;
create policy "rs_admin_all" on public.reinforcement_submissions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "rs_own_select" on public.reinforcement_submissions;
create policy "rs_own_select" on public.reinforcement_submissions for select
  using (auth.uid() = user_id);
drop policy if exists "rs_own_insert" on public.reinforcement_submissions;
create policy "rs_own_insert" on public.reinforcement_submissions for insert
  with check (auth.uid() = user_id);

-- 4. Respuestas individuales
create table if not exists public.reinforcement_answers (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.reinforcement_submissions(id) on delete cascade,
  question_id    uuid not null references public.reinforcement_questions(id) on delete cascade,
  answer_text    text not null,
  score          int,
  analysis       jsonb,
  created_at     timestamptz not null default now(),
  unique(submission_id, question_id)
);

create index if not exists ra_sub_idx on public.reinforcement_answers(submission_id);
alter table public.reinforcement_answers enable row level security;
drop policy if exists "ra_admin_all" on public.reinforcement_answers;
create policy "ra_admin_all" on public.reinforcement_answers for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "ra_own_select" on public.reinforcement_answers;
create policy "ra_own_select" on public.reinforcement_answers for select
  using (exists (select 1 from public.reinforcement_submissions s where s.id = submission_id and s.user_id = auth.uid()));
drop policy if exists "ra_own_insert" on public.reinforcement_answers;
create policy "ra_own_insert" on public.reinforcement_answers for insert
  with check (exists (select 1 from public.reinforcement_submissions s where s.id = submission_id and s.user_id = auth.uid()));

-- FIN migración 0019
