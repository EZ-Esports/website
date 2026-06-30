# Supabase Setup

## Environment Variables

Create a `.env` file in the project root with:

| Variable | Description | Where to use |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Both clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/public key (safe for client) | Client only |
| `SUPABASE_SECRET_KEY` | Service role key (server only) | Server only |

**→ Ping core team members for env secrets.** `.env` is gitignored and not committed.

## Supabase Clients

### `app/lib/supabase/client.ts` — Browser client

Use in React client components and browser code. Uses the anon key with Row Level Security (RLS) applied.

```ts
import { createBrowserClient } from '@/app/lib/supabase/client'
```

### `app/lib/supabase/server.ts` — Server client (cookie-based)

Use in Server Components, Route Handlers, and Server Actions. Reads/writes auth cookies to keep the session in sync. Subject to RLS.

```ts
import { createClient } from '@/app/lib/supabase/server'
```

### `app/lib/supabase/service.ts` — Service role client

Uses the `SUPABASE_SECRET_KEY` (service role). Bypasses RLS — use only for trusted server logic where elevated access is required (e.g. creating admin auth accounts).

```ts
import { createServiceClient } from '@/app/lib/supabase/service'
```

## When to use which

| Context | Client |
|---------|--------|
| `'use client'` components | `client.ts` |
| Server Components | `server.ts` |
| Route Handlers / API routes | `server.ts` |
| Server Actions | `server.ts` |
| Privileged server actions (admin provisioning) | `service.ts` |

## Authorization

A valid Supabase Auth session alone is **not sufficient** for admin access. The user must also have a row in the `admin_users` allowlist table. `requireAdmin()` and `getAdmin()` in `app/lib/auth.ts` are the single authorization gate for all admin panel routes and server actions — they verify the session **and** check the allowlist on every call.

## Row Level Security (RLS)

RLS is enabled for every application-owned table in `public` by migration `0012_icy_molten_man.sql`. The `roster_standings` view is marked `security_invoker = true` so base-table RLS still applies when the view is queried through Supabase APIs.

Policy contract:

- Public `anon`/`authenticated` reads are limited to non-sensitive, publishable rows: active games/league data, active non-deleted schools, published non-deleted news, active non-deleted gallery images/sponsors, non-deleted leadership rows, and page content.
- Sensitive rows such as `members`, `school_applications`, `page_content_history`, `admin_users`, and `admin_invites` are not publicly readable.
- Authenticated admin writes are gated by the `admin_users` allowlist via `public.is_admin()`.
- Admin team management on `admin_users` and `admin_invites` is gated by `public.is_super_admin()`.
- Public application submission still goes through `app/api/apply/route.ts`; the database table itself is not directly insertable by anonymous Supabase clients.

### Database Schema
See [schema.ts](file:///Users/shangminchen/website/app/lib/db/schema.ts) for the database schema definition and migration files under [db/migrations](file:///Users/shangminchen/website/db/migrations) for migration history.
