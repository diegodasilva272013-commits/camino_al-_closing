-- Historial de entrenamientos del CAC Trainer

create table if not exists public.trainer_sessions (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  scenario_id       text        not null,
  scenario_name     text        not null,
  scenario_group    text        not null,
  scenario_tag      text        not null,
  difficulty        int         not null default 1,
  mode              text        not null default 'fria',
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  message_count     int         not null default 0,
  evaluations_count int         not null default 0,
  last_evaluation   text,
  status            text        not null default 'active'
);

create table if not exists public.trainer_messages (
  id            uuid        primary key default gen_random_uuid(),
  session_id    uuid        not null references public.trainer_sessions(id) on delete cascade,
  role          text        not null,
  content       text        not null,
  is_evaluation boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists trainer_sessions_user_id_idx   on public.trainer_sessions(user_id);
create index if not exists trainer_sessions_started_at_idx on public.trainer_sessions(started_at desc);
create index if not exists trainer_messages_session_id_idx on public.trainer_messages(session_id);

alter table public.trainer_sessions enable row level security;
alter table public.trainer_messages enable row level security;

drop policy if exists "trainer_sessions_own"   on public.trainer_sessions;
drop policy if exists "trainer_sessions_admin" on public.trainer_sessions;
drop policy if exists "trainer_messages_own"   on public.trainer_messages;
drop policy if exists "trainer_messages_admin" on public.trainer_messages;

create policy "trainer_sessions_own" on public.trainer_sessions
  for all using (auth.uid() = user_id);

create policy "trainer_sessions_admin" on public.trainer_sessions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "trainer_messages_own" on public.trainer_messages
  for all using (
    exists (select 1 from public.trainer_sessions where id = session_id and user_id = auth.uid())
  );

create policy "trainer_messages_admin" on public.trainer_messages
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
