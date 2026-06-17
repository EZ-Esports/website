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

### READ
`docs/dev/SUPABASE.md` for information on the database schema and TODOs.
