# Developer Onboarding

Quick reference for developers new to the EZ Esports codebase.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [project README](../README.md) for full setup.

### Environment

The app uses Supabase. Create a `.env` file with the required variables — **ping core team members for env secrets** (see [Supabase setup](dev/SUPABASE.md)).

### First deploy / bootstrap

For deploying or transferring the site to a new Vercel account without downtime, see the [Vercel Handover Guide](dev/VERCEL_HANDOVER.md).

After running migrations, seed an existing Supabase Auth identity as the first Owner. Other staff identities are created through invite acceptance and may initially have no roles:

```bash
npm run db:migrate
npm run db:seed-owner -- you@example.com
```

Revoked identities are protected by durable tombstones and are not restored by
normal sign-in or by re-running the seed command. After an Owner deliberately
approves restoration, clear the tombstone and restore ownership explicitly:

```bash
npm run db:seed-owner -- you@example.com --restore-revoked
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) — not the Next.js in most training data; see the agent-rules block in `CLAUDE.md` |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5 |

## Project Structure

```
app/
├── (marketing)/          # Public site (route group, no URL segment)
│   ├── [game]/           # /{game}/varsity, /junior-varsity, /standings, /schedule, /teams, /teams/[school], /bracket
│   ├── apply/, careers/, join/[schoolSlug]/[gameSlug]/
│   ├── about/, archives/, gallery/, leadership/[year]/, news/, sponsors/
│   └── login/, privacy/, rules/, terms/
├── (admin)/admin/        # Staff CMS (permission-gated sections)
├── (portal)/portal/      # School manager portal and its login
├── api/                  # apply, apply/staff, upload
├── components/           # layout, sections, ui, admin, tournament, careers
└── lib/
    ├── constants.ts      # Routes, games (GAMES), nav, SITE_CONFIG
    ├── db/               # Drizzle schema.ts, queries.ts, tournaments.ts
    ├── supabase/         # browser / server / service clients, session middleware (CSP)
    ├── onboarding/       # player onboarding ports and adapters
    └── auth.ts, roles.ts, staff-access.ts, admin-nav.ts, dates.ts, rate-limit.ts
db/                       # migrate, seed-gold, seed-leadership, backups, migrations/
spec/                     # living project memory for agents (start at spec/README.md)
proxy.ts                  # Next 16 replacement for middleware.ts
```

## Key Concepts

### Games

Games are defined in `app/lib/constants.ts` via `GAMES` and `GAME_SLUGS`, each with a `competitionModel` (`'team'` for seasons/standings, `'tournament'` for brackets) and `hasJvSplit`. Adding a game means adding it to `GAME_SLUGS`, `GAMES` and the `GameSlug` type in `app/types/index.ts`. The routes under `app/(marketing)/[game]/` are shared by every game; there is no per-game page file.

### Data

League data lives in Postgres (Drizzle, `app/lib/db/schema.ts`), read through cached helpers in `app/lib/db/queries.ts` and edited from `/admin`. See [spec/architecture.md](../spec/architecture.md) for the model and the cache rules; saves call `updateTag`.

### Routing

- **League-level**: `/`, `/about`, `/news`, `/leadership`, `/archives`, `/gallery`, `/careers`, `/apply`
- **Game-level**: `/{game}` (308 to `/{game}/varsity`), `/{game}/varsity`, `/{game}/junior-varsity`, `/{game}/schedule`, `/{game}/standings`, `/{game}/teams`, `/{game}/bracket`
- Navigation switches between league and game context based on pathname (see `getNavigationState` in `constants.ts`)
- The full surface map is in [spec/product.md](../spec/product.md)

### Layouts

- `app/layout.tsx` — Root: Header + children + Footer
- `app/(marketing)/layout.tsx` — Pass-through
- `app/(marketing)/[game]/layout.tsx` — Validates `game` param, returns 404 for invalid slugs

## Important Files

| Purpose | Location |
|---------|----------|
| Site config, routes, games | `app/lib/constants.ts` |
| Shared types | `app/types/index.ts` |
| Main nav logic | `app/components/layout/Navigation.tsx` |
| Database schema | `app/lib/db/schema.ts` |
| Staff roles and permissions | `app/lib/roles.ts`, `app/lib/staff-access.ts` |
| Global styles | `app/globals.css` |
| Supabase (browser client) | `app/lib/supabase/client.ts` |
| Supabase (server client) | `app/lib/supabase/server.ts` |
| Supabase (service role) | `app/lib/supabase/service.ts` |

## Documentation

- [Supabase setup](dev/SUPABASE.md) — Env vars, client vs server usage
- [Commit message style](dev/COMMIT_STYLE.md) — Conventional commits format
- [Project README](../README.md) — Run instructions
