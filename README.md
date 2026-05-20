# Camino al Closing — Comunidad Privada

Plataforma privada de entrenamiento para closers, setters y vendedores de alto rendimiento.

> Estado actual: **Etapa 2 — Supabase conectado**. Schema, RLS y clientes listos. Auth funcional viene en Etapa 3.

## Stack

- Next.js 14 (App Router) + TypeScript
- TailwindCSS + tailwindcss-animate
- lucide-react para iconografía
- Supabase (Auth, Postgres, Storage) — pendiente de Etapa 2
- Deploy: Vercel

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

Luego abrir [http://localhost:3000](http://localhost:3000).

## Rutas disponibles

Públicas:

- `/` — Landing premium
- `/login` — Login (UI)
- `/register` — Registro (UI)
- `/forgot-password` — Recuperación (UI)

Privadas (UI placeholder, sin auth todavía):

- `/dashboard`
- `/classes`
- `/community`
- `/calendar`
- `/resources`
- `/profile`

Admin (UI placeholder):

- `/admin`
- `/admin/users`
- `/admin/courses`
- `/admin/modules`
- `/admin/classes`
- `/admin/events`
- `/admin/resources`
- `/admin/community`

## Estructura

```
src/
  app/
    (auth)/        → login, register, forgot-password
    (private)/     → dashboard, classes, community, calendar, resources, profile
    admin/         → panel admin
  components/
    layout/        → AppShell, Sidebar, Topbar, MobileNav, PageHeader
    ui/            → componentes UI reutilizables
  constants/       → branding, roles, categories
  lib/             → utils (cn helper)
```

## Branding

- Fondo negro (`#050505`) y superficies oscuras (`#111111`).
- Dorado principal `#D4AF37`, dorado suave `#B8892D`.
- Cards oscuras con bordes dorados sutiles.
- Tipografía Inter.

## Próximos pasos

**Etapa 2 (completada):** Supabase clients, schema SQL, RLS, tipos y middleware.
**Etapa 3:** autenticación funcional, protección de rutas y redirecciones por rol.
**Etapa 4:** dashboard dinámico con datos reales.
**Etapa 5+:** clases, progreso, comunidad, calendario, recursos y admin CRUDs.

## Configurar Supabase (Etapa 2)

1. Copia `.env.example` a `.env.local` y rellena las claves (la `anon key` ya está, falta solo `SUPABASE_SERVICE_ROLE_KEY` cuando la necesitemos).
2. En Supabase → SQL Editor, pega y ejecuta:
   - `supabase/migrations/0001_init.sql` (schema + función + RLS).
   - `supabase/seed.sql` (curso y módulos iniciales).
3. Levanta el proyecto: `npm run dev`.
4. Verifica la conexión visitando `http://localhost:3000/api/health/supabase` → debe responder `{"ok":true}`.

### Convertir un usuario en admin

Desde Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'tu@email.com';
```
