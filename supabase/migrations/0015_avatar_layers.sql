-- Tabla de capas de evolución del avatar
create table if not exists public.avatar_layers (
  id             int primary key,
  name           text not null,
  description    text,
  required_level int not null default 1,
  credit_cost    int not null default 1,
  preview_before text,
  preview_after  text,
  sort_order     int not null default 0,
  is_active      boolean not null default true
);

insert into public.avatar_layers (id, name, description, required_level, credit_cost, sort_order) values
  (1, 'Base',         'Avatar básico en el estilo elegido',                    1,  1, 1),
  (2, 'Detalles',     'Más texturas, sombras y profundidad facial',             3,  1, 2),
  (3, 'Vestimenta',   'Ropa del nivel: desde remera simple hasta uniforme',     5,  1, 3),
  (4, 'Accesorios',   'Badge de nivel, collar, reloj de lujo',                 7,  1, 4),
  (5, 'Fondo simple', 'Fondo con gradiente o ambiente temático',                8,  1, 5),
  (6, 'Fondo épico',  'Escenario cinematográfico completo',                    10,  2, 6),
  (7, 'Efectos VFX',  'Rayos, fuego y aura alrededor del avatar',             12,  2, 7),
  (8, 'Marco perfil', 'Marco dorado visible en posts y ranking',              15,  2, 8)
on conflict (id) do nothing;

alter table public.avatar_layers enable row level security;
drop policy if exists "avatar_layers_public_read" on public.avatar_layers;
create policy "avatar_layers_public_read" on public.avatar_layers
  for select using (true);

-- Tabla de capas desbloqueadas por usuario
create table if not exists public.user_avatar_layers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  layer_id         int  not null references public.avatar_layers(id),
  unlocked_at      timestamptz not null default now(),
  avatar_style     text check (avatar_style in ('pixar', 'cartoon', 'marvel')),
  result_image_url text,
  unique (user_id, layer_id)
);

alter table public.user_avatar_layers enable row level security;
drop policy if exists "ual_own" on public.user_avatar_layers;
create policy "ual_own" on public.user_avatar_layers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
