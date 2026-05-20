-- =====================================================================
-- Camino al Closing — Chat interno estilo Telegram.
-- Conversaciones (dm/group/channel) + mensajes + reacciones + storage.
-- Idempotente. Pegar en Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Tablas ------------------------------------------------------------
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm','group','channel')),
  name text,
  avatar_url text,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists chat_conv_last_message_idx
  on public.chat_conversations(last_message_at desc);

create table if not exists public.chat_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);

create index if not exists chat_members_user_idx on public.chat_members(user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type in ('image','video','audio','file','gif')),
  media_name text,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists chat_messages_conv_idx
  on public.chat_messages(conversation_id, created_at desc);

create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- 2. Trigger: actualizar last_message_at al insertar mensaje ----------
create or replace function public._chat_bump_conv_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_bump_conv on public.chat_messages;
create trigger chat_bump_conv
  after insert on public.chat_messages
  for each row execute function public._chat_bump_conv_on_message();

-- 3. RLS ---------------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;

-- Helper: ¿soy miembro?
create or replace function public.is_chat_member(p_conv uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.chat_members
    where conversation_id = p_conv and user_id = p_user
  );
$$;

-- conversations: leer si soy miembro, crear cualquiera autenticado
drop policy if exists "chat_conv_select" on public.chat_conversations;
create policy "chat_conv_select"
on public.chat_conversations for select
using (public.is_chat_member(id, auth.uid()));

drop policy if exists "chat_conv_insert" on public.chat_conversations;
create policy "chat_conv_insert"
on public.chat_conversations for insert
with check (auth.uid() is not null);

drop policy if exists "chat_conv_update" on public.chat_conversations;
create policy "chat_conv_update"
on public.chat_conversations for update
using (
  exists(
    select 1 from public.chat_members
    where conversation_id = id and user_id = auth.uid()
      and role in ('owner','admin')
  )
);

-- members: ver los de mis convs, insertar si soy admin/owner o me uno a mí mismo en grupo público
drop policy if exists "chat_members_select" on public.chat_members;
create policy "chat_members_select"
on public.chat_members for select
using (public.is_chat_member(conversation_id, auth.uid()));

drop policy if exists "chat_members_insert" on public.chat_members;
create policy "chat_members_insert"
on public.chat_members for insert
with check (
  -- soy admin/owner de la conv
  exists(
    select 1 from public.chat_members m
    where m.conversation_id = chat_members.conversation_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  -- o me agrego a mí mismo (creador inicial)
  or user_id = auth.uid()
);

drop policy if exists "chat_members_update" on public.chat_members;
create policy "chat_members_update"
on public.chat_members for update
using (user_id = auth.uid());

drop policy if exists "chat_members_delete" on public.chat_members;
create policy "chat_members_delete"
on public.chat_members for delete
using (
  user_id = auth.uid()
  or exists(
    select 1 from public.chat_members m
    where m.conversation_id = chat_members.conversation_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

-- messages: ver/insertar si soy miembro; editar/borrar solo el autor
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select"
on public.chat_messages for select
using (public.is_chat_member(conversation_id, auth.uid()));

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert"
on public.chat_messages for insert
with check (
  user_id = auth.uid()
  and public.is_chat_member(conversation_id, auth.uid())
);

drop policy if exists "chat_messages_update" on public.chat_messages;
create policy "chat_messages_update"
on public.chat_messages for update
using (user_id = auth.uid());

drop policy if exists "chat_messages_delete" on public.chat_messages;
create policy "chat_messages_delete"
on public.chat_messages for delete
using (user_id = auth.uid());

-- reactions: ver si soy miembro, manipular solo las propias
drop policy if exists "chat_reactions_select" on public.chat_reactions;
create policy "chat_reactions_select"
on public.chat_reactions for select
using (
  exists(
    select 1 from public.chat_messages m
    where m.id = chat_reactions.message_id
      and public.is_chat_member(m.conversation_id, auth.uid())
  )
);

drop policy if exists "chat_reactions_insert" on public.chat_reactions;
create policy "chat_reactions_insert"
on public.chat_reactions for insert
with check (user_id = auth.uid());

drop policy if exists "chat_reactions_delete" on public.chat_reactions;
create policy "chat_reactions_delete"
on public.chat_reactions for delete
using (user_id = auth.uid());

-- 4. Realtime ----------------------------------------------------------
-- Asegurar que las tablas estén en la publicación supabase_realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_conversations';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_members'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_members';
  end if;
end$$;

-- 5. Storage bucket: chat-media ----------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "chat_media_public_read" on storage.objects;
create policy "chat_media_public_read"
on storage.objects for select
using (bucket_id = 'chat-media');

drop policy if exists "chat_media_user_insert" on storage.objects;
create policy "chat_media_user_insert"
on storage.objects for insert
with check (
  bucket_id = 'chat-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "chat_media_user_delete" on storage.objects;
create policy "chat_media_user_delete"
on storage.objects for delete
using (
  bucket_id = 'chat-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. RPC helper: o crear o devolver el DM existente entre dos usuarios -
create or replace function public.get_or_create_dm(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conv uuid;
begin
  if v_me is null then raise exception 'No autenticado'; end if;
  if v_me = p_other then raise exception 'No podés crear un DM contigo mismo'; end if;

  -- buscar dm existente con exactamente esos dos miembros
  select c.id into v_conv
  from public.chat_conversations c
  where c.type = 'dm'
    and exists(select 1 from public.chat_members m where m.conversation_id = c.id and m.user_id = v_me)
    and exists(select 1 from public.chat_members m where m.conversation_id = c.id and m.user_id = p_other)
  limit 1;

  if v_conv is not null then return v_conv; end if;

  insert into public.chat_conversations(type, created_by)
    values ('dm', v_me)
    returning id into v_conv;

  insert into public.chat_members(conversation_id, user_id, role)
    values (v_conv, v_me, 'owner'),
           (v_conv, p_other, 'member');

  return v_conv;
end;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;
