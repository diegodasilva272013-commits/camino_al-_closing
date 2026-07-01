-- =====================================================================
-- 0053 · Wins — logros del equipo y personales
-- =====================================================================

-- Wins del equipo (admin sube comprobantes de pago para motivar)
create table if not exists public.team_wins (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text,
  image_url   text,
  posted_by   uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Wins personales (cualquier usuario — logros no económicos del día)
create table if not exists public.personal_wins (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  content    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists team_wins_created_idx    on public.team_wins(created_at desc);
create index if not exists personal_wins_user_idx   on public.personal_wins(user_id, created_at desc);
create index if not exists personal_wins_created_idx on public.personal_wins(created_at desc);

-- RLS team_wins
alter table public.team_wins enable row level security;

drop policy if exists "team_wins_read_all"  on public.team_wins;
create policy        "team_wins_read_all"
  on public.team_wins for select using (true);

drop policy if exists "team_wins_admin_write" on public.team_wins;
create policy        "team_wins_admin_write"
  on public.team_wins for all
  using  (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- RLS personal_wins
alter table public.personal_wins enable row level security;

drop policy if exists "personal_wins_read_all" on public.personal_wins;
create policy        "personal_wins_read_all"
  on public.personal_wins for select using (true);

drop policy if exists "personal_wins_insert_own" on public.personal_wins;
create policy        "personal_wins_insert_own"
  on public.personal_wins for insert
  with check (auth.uid() = user_id);

drop policy if exists "personal_wins_delete_own" on public.personal_wins;
create policy        "personal_wins_delete_own"
  on public.personal_wins for delete
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Storage bucket para imágenes de team_wins
insert into storage.buckets (id, name, public)
values ('wins', 'wins', true)
on conflict (id) do nothing;

drop policy if exists "wins_images_public_read" on storage.objects;
create policy        "wins_images_public_read"
  on storage.objects for select using (bucket_id = 'wins');

drop policy if exists "wins_images_admin_upload" on storage.objects;
create policy        "wins_images_admin_upload"
  on storage.objects for insert
  with check (bucket_id = 'wins' and public.is_admin(auth.uid()));

drop policy if exists "wins_images_admin_delete" on storage.objects;
create policy        "wins_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'wins' and public.is_admin(auth.uid()));
