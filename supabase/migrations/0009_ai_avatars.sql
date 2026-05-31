-- =====================================================================
-- Camino al Closing — Migración 0009 (AI Avatars)
-- Genera avatares estilizados con IA (Pixar / Cartoon / Marvel Comic)
-- y los evoluciona automáticamente cuando el usuario sube de nivel.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- =====================================================================
-- 1. Columnas en profiles
-- =====================================================================
alter table public.profiles
  add column if not exists ai_avatar_credits int not null default 3,
  add column if not exists ai_avatar_style text check (ai_avatar_style in ('pixar','cartoon','marvel')),
  add column if not exists ai_avatar_level int,
  add column if not exists ai_avatar_url text;

-- =====================================================================
-- 2. Tabla audit de generaciones
-- =====================================================================
create table if not exists public.ai_avatar_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  style text not null check (style in ('pixar','cartoon','marvel')),
  level_snapshot int not null,
  source_path text,            -- foto original en storage (privada)
  output_url text not null,    -- avatar generado público
  cost_credits int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists ai_avatar_gen_user_idx on public.ai_avatar_generations(user_id, created_at desc);

alter table public.ai_avatar_generations enable row level security;

drop policy if exists "ai_avatar_gen_own_read" on public.ai_avatar_generations;
create policy "ai_avatar_gen_own_read" on public.ai_avatar_generations for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "ai_avatar_gen_own_insert" on public.ai_avatar_generations;
create policy "ai_avatar_gen_own_insert" on public.ai_avatar_generations for insert
  with check (auth.uid() = user_id);

drop policy if exists "ai_avatar_gen_admin" on public.ai_avatar_generations;
create policy "ai_avatar_gen_admin" on public.ai_avatar_generations for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 3. Bucket storage: avatares IA (público de lectura)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars-ai', 'avatars-ai', true)
on conflict (id) do update set public = true;

-- Bucket privado temporal para las fotos fuente
insert into storage.buckets (id, name, public)
values ('avatar-sources', 'avatar-sources', false)
on conflict (id) do nothing;

do $$
begin
  -- avatars-ai: lectura pública, escritura por dueño autenticado
  execute 'drop policy if exists "avatars_ai_read_all" on storage.objects';
  execute $p$create policy "avatars_ai_read_all" on storage.objects for select using (bucket_id = 'avatars-ai')$p$;
  execute 'drop policy if exists "avatars_ai_write_own" on storage.objects';
  execute $p$create policy "avatars_ai_write_own" on storage.objects for insert with check (bucket_id = 'avatars-ai' and auth.role() = 'authenticated')$p$;
  execute 'drop policy if exists "avatars_ai_update_own" on storage.objects';
  execute $p$create policy "avatars_ai_update_own" on storage.objects for update using (bucket_id = 'avatars-ai' and auth.role() = 'authenticated')$p$;

  -- avatar-sources: solo el dueño (carpeta = user_id) lee/escribe
  execute 'drop policy if exists "avatar_sources_own_all" on storage.objects';
  execute $p$create policy "avatar_sources_own_all" on storage.objects for all
    using (bucket_id = 'avatar-sources' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatar-sources' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end $$;

-- =====================================================================
-- 4. RPC: consumir 1 crédito de forma atómica (devuelve true si pudo)
-- =====================================================================
create or replace function public.consume_ai_avatar_credit(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits int;
begin
  update public.profiles
    set ai_avatar_credits = ai_avatar_credits - 1
    where id = p_user and ai_avatar_credits > 0
    returning ai_avatar_credits into v_credits;
  return v_credits is not null;
end;
$$;

-- =====================================================================
-- 5. Trigger: al subir de nivel, regalar 1 crédito + notificación
-- =====================================================================
create or replace function public._on_points_level_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_level int;
  v_new_level int;
begin
  if new.points is null or old.points is null then
    return new;
  end if;
  if new.points <= old.points then
    return new;
  end if;

  v_old_level := public.community_level(old.points);
  v_new_level := public.community_level(new.points);

  if v_new_level > v_old_level then
    update public.profiles
      set ai_avatar_credits = ai_avatar_credits + 1
      where id = new.id;

    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.id,
      'system',
      '🎉 ¡Subiste al nivel ' || v_new_level || '!',
      'Tu avatar puede evolucionar. Te regalamos 1 generación gratis ✨',
      '/profile'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_points_level_up on public.profiles;
create trigger on_points_level_up
  after update of points on public.profiles
  for each row execute function public._on_points_level_up();

-- =====================================================================
-- FIN migración 0009
-- =====================================================================
