-- =====================================================================
-- Camino al Closing — Migración 0007
-- Notificaciones, buckets de storage y validaciones para admin.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- =====================================================================
-- 1. Tabla de notificaciones
-- =====================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in (
    'post_like', 'post_comment', 'comment_reply',
    'chat_message', 'event_reminder', 'system'
  )),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
using (auth.uid() = user_id);

drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all"
on public.notifications for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- =====================================================================
-- 2. Triggers para generar notificaciones
-- =====================================================================

-- 2.1 Like a un post → notificar al autor
create or replace function public._notif_on_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_actor_name text;
  v_post_title text;
begin
  select user_id, coalesce(title, left(content, 60)) into v_owner, v_post_title
    from public.community_posts where id = new.post_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  select coalesce(full_name, email, 'Alguien') into v_actor_name
    from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (
    v_owner, new.user_id, 'post_like',
    coalesce(v_actor_name, 'Alguien') || ' le dio like a tu publicación',
    v_post_title,
    '/community'
  );
  return new;
end;
$$;

drop trigger if exists notif_on_post_like on public.post_likes;
create trigger notif_on_post_like
  after insert on public.post_likes
  for each row execute function public._notif_on_post_like();

-- 2.2 Comentario en un post → notificar al autor del post
create or replace function public._notif_on_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_actor_name text;
  v_post_title text;
begin
  select user_id, coalesce(title, left(content, 60)) into v_owner, v_post_title
    from public.community_posts where id = new.post_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  select coalesce(full_name, email, 'Alguien') into v_actor_name
    from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (
    v_owner, new.user_id, 'post_comment',
    coalesce(v_actor_name, 'Alguien') || ' comentó tu publicación',
    coalesce(left(new.content, 120), v_post_title),
    '/community'
  );
  return new;
end;
$$;

drop trigger if exists notif_on_post_comment on public.community_comments;
create trigger notif_on_post_comment
  after insert on public.community_comments
  for each row execute function public._notif_on_post_comment();

-- 2.3 Nuevo mensaje de chat → notificar al resto de miembros
create or replace function public._notif_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_conv_name text;
  v_member record;
  v_preview text;
begin
  select coalesce(full_name, email, 'Alguien') into v_actor_name
    from public.profiles where id = new.user_id;
  select case when type = 'dm' then v_actor_name else coalesce(name, 'Conversación') end
    into v_conv_name
    from public.chat_conversations where id = new.conversation_id;
  v_preview := coalesce(left(new.content, 120), case when new.media_url is not null then '📎 Adjunto' else '' end);

  for v_member in
    select user_id from public.chat_members
      where conversation_id = new.conversation_id
      and user_id <> new.user_id
      and muted = false
  loop
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (
      v_member.user_id, new.user_id, 'chat_message',
      v_actor_name || ' en ' || coalesce(v_conv_name, 'chat'),
      v_preview,
      '/chat'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notif_on_chat_message on public.chat_messages;
create trigger notif_on_chat_message
  after insert on public.chat_messages
  for each row execute function public._notif_on_chat_message();

-- =====================================================================
-- 3. Storage buckets
-- =====================================================================
-- Recursos descargables (PDFs, plantillas, etc.) — público de lectura
insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do update set public = true;

-- Videos de clases — público de lectura
insert into storage.buckets (id, name, public)
values ('class-videos', 'class-videos', true)
on conflict (id) do update set public = true;

-- Avatars (por si no existe aún)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Políticas: lectura pública, escritura solo admins
do $$
declare
  policy_name text;
  bucket_name text;
begin
  for bucket_name in select unnest(array['resources', 'class-videos']) loop
    -- limpiar políticas previas con el mismo nombre
    execute format(
      'drop policy if exists "%s_read_all" on storage.objects',
      bucket_name
    );
    execute format(
      'drop policy if exists "%s_write_admin" on storage.objects',
      bucket_name
    );
    execute format(
      'drop policy if exists "%s_update_admin" on storage.objects',
      bucket_name
    );
    execute format(
      'drop policy if exists "%s_delete_admin" on storage.objects',
      bucket_name
    );

    execute format(
      'create policy "%s_read_all" on storage.objects for select using (bucket_id = %L)',
      bucket_name, bucket_name
    );
    execute format(
      'create policy "%s_write_admin" on storage.objects for insert with check (bucket_id = %L and public.is_admin(auth.uid()))',
      bucket_name, bucket_name
    );
    execute format(
      'create policy "%s_update_admin" on storage.objects for update using (bucket_id = %L and public.is_admin(auth.uid()))',
      bucket_name, bucket_name
    );
    execute format(
      'create policy "%s_delete_admin" on storage.objects for delete using (bucket_id = %L and public.is_admin(auth.uid()))',
      bucket_name, bucket_name
    );
  end loop;
end $$;

-- =====================================================================
-- 4. Helpers auxiliares
-- =====================================================================

-- Conteo de notificaciones no leídas (RPC más rápido que count(*) full)
create or replace function public.unread_notifications_count(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.notifications
    where user_id = p_user and read_at is null;
$$;

-- Asegurar que profiles tenga el rol 'admin' válido (ya está en check, no-op)
-- =====================================================================
-- 5. Vista resumen para Admin (stats globales)
-- =====================================================================
create or replace view public.admin_overview as
select
  (select count(*)::int from public.profiles) as total_users,
  (select count(*)::int from public.profiles where role = 'admin') as total_admins,
  (select count(*)::int from public.lessons where is_published) as published_lessons,
  (select count(*)::int from public.community_posts where not is_deleted) as total_posts,
  (select count(*)::int from public.community_comments where not is_deleted) as total_comments,
  (select count(*)::int from public.events where status = 'active' and start_time >= now()) as upcoming_events,
  (select count(*)::int from public.resources where is_published) as published_resources;

grant select on public.admin_overview to authenticated;
