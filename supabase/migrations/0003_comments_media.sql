-- =====================================================================
-- Camino al Closing — Media en comentarios + soporte para documentos y
-- notas de voz en posts y comentarios.
-- Idempotente.
-- =====================================================================

-- 1. Extender check de community_posts.media_type --------------------------
alter table public.community_posts
  drop constraint if exists community_posts_media_type_check;

alter table public.community_posts
  add constraint community_posts_media_type_check
  check (
    media_type is null
    or media_type in ('image', 'video', 'youtube', 'document', 'audio')
  );

-- 2. Media en community_comments ------------------------------------------
alter table public.community_comments
  add column if not exists media_url  text,
  add column if not exists media_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_comments_media_type_check'
  ) then
    alter table public.community_comments
      add constraint community_comments_media_type_check
      check (
        media_type is null
        or media_type in ('image', 'video', 'audio', 'document')
      );
  end if;
end $$;

-- content puede estar vacío si hay media adjunta
alter table public.community_comments
  alter column content drop not null;
