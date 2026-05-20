-- =====================================================================
-- Camino al Closing — Feed estilo Skool
-- Extiende community_posts para soportar foto, video, YouTube y posts
-- "ligeros" (sin título). Crea bucket de Storage con políticas.
-- Idempotente.
-- =====================================================================

-- 1. Columnas nuevas en community_posts ------------------------------------
alter table public.community_posts
  add column if not exists media_url   text,
  add column if not exists media_type  text,
  add column if not exists youtube_url text;

-- title puede ser opcional (posts cortos al estilo feed social)
alter table public.community_posts
  alter column title drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_posts_media_type_check'
  ) then
    alter table public.community_posts
      add constraint community_posts_media_type_check
      check (media_type is null or media_type in ('image','video','youtube'));
  end if;
end $$;

-- 2. Storage bucket público para media de comunidad -----------------------
insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do update set public = true;

-- Políticas del bucket
drop policy if exists "community_media_read" on storage.objects;
create policy "community_media_read"
on storage.objects for select
using (bucket_id = 'community-media');

drop policy if exists "community_media_insert_own" on storage.objects;
create policy "community_media_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "community_media_delete_own" on storage.objects;
create policy "community_media_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Política extra: permitir borrar posts propios (soft-delete vía update
--    ya existe; agregamos delete real por si se necesita) -----------------
drop policy if exists "posts_delete_own" on public.community_posts;
create policy "posts_delete_own"
on public.community_posts for delete
using (auth.uid() = user_id);
