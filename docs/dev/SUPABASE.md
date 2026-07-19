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

Uses the `SUPABASE_SECRET_KEY` (service role). Bypasses RLS — use only for trusted server logic where elevated access is required (for example creating or revoking staff auth identities).

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
| Privileged server actions (staff provisioning/revocation) | `service.ts` |

## Authorization

Supabase signups remain disabled and staff accounts originate from invites or Owner seeding. Every authenticated portal identity is a staff member, even when it has no assigned roles. `getStaff()` verifies the identity, idempotently repairs a missing `staff_members` row, and combines assigned roles with the implicit `@everyone` role. `requireStaff()` checks membership; `requirePermission()` and `requireAnyPermission()` protect capabilities.

Anonymous `/admin` requests redirect once to `/login`. Permission failures never sign out a valid identity: browser pages render a denial inside the portal shell and APIs return `403`.

## Row Level Security (RLS)

RLS is enabled for every application-owned table in `public` by migration `0012_icy_molten_man.sql`. The `roster_standings` view is marked `security_invoker = true` so base-table RLS still applies when the view is queried through Supabase APIs.

Policy contract:

- Public `anon`/`authenticated` reads are limited to non-sensitive, publishable rows: active games/league data, active non-deleted schools, published non-deleted news, active non-deleted gallery images/sponsors, non-deleted leadership rows, and page content.
- Sensitive rows such as `members`, `school_applications`, `page_content_history`, `staff_members`, `staff_invites`, and `staff_revocations` are not publicly readable.
- `public.is_staff()` checks portal membership without granting management access.
- `public.has_permission(bit)` includes implicit `@everyone`, assigned roles, Owner override, and `ADMINISTRATOR` override.
- Management-content tables have permission-specific mutation policies. Membership-domain tables (`roles`, `user_roles`, `staff_members`, `staff_invites`, and `staff_invite_roles`) have no authenticated mutation policies: their writes must use the trusted `DATABASE_URL` connection after application-layer `MANAGE_ROLES` and role-hierarchy checks. This prevents direct Supabase REST/table DML from turning `MANAGE_ROLES` into Owner or `ADMINISTRATOR` access.
- Public application submission still goes through `app/api/apply/route.ts`; the database table itself is not directly insertable by anonymous Supabase clients.

## Staff permission migration

Migrations `0019_staff-permissions.sql` and `0020_fine_cannonball.sql` rename the staff domain, replace the old broad policies, and add durable revocation tombstones. Apply them together in the same controlled maintenance window as the matching application release:

1. Create and verify a restorable database backup.
2. Pause administrative writes.
3. Run `npm run db:migrate` immediately before releasing the matching application build.
4. On a non-production verification database, run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/staff-permissions.sql`.
5. Verify anonymous, zero-permission, specific-permission, Administrator, and Owner browser sessions before resuming writes.

### Database Schema
See [`schema.ts`](../../app/lib/db/schema.ts) for the database schema definition and [`db/migrations`](../../db/migrations) for migration history.
