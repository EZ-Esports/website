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

After running migrations, seed an existing Supabase Auth identity as the first Owner. Other staff identities are created through invite acceptance and may initially have no roles:

```bash
npm run db:migrate
npm run db:seed-owner -- you@example.com
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5 |

## Project Structure

```
app/
├── (marketing)/          # Marketing pages (route group, no URL segment)
│   ├── [game]/           # Dynamic game routes: /valorant, /league-of-legends, /team-fight-tactics
│   │   ├── layout.tsx    # Validates game slug, renders children
│   │   ├── roster/       # /{game}/roster
│   │   ├── schedule/     # /{game}/schedule
│   │   ├── standings/    # /{game}/standings
│   │   └── teams/        # /{game}/teams
│   ├── about/
│   ├── archives/
│   ├── leadership/[year]/
│   ├── league-of-legends/  # Game landing pages
│   ├── team-fight-tactics/
│   ├── valorant/
│   └── ...
├── components/
│   ├── layout/           # Header, Footer, Navigation
│   ├── sections/         # Hero, GameShowcase, MediaGrid, etc.
│   └── ui/               # Button, Card
├── lib/
│   ├── constants.ts      # Routes, games, nav, theme config
│   ├── leadership-data.ts
│   └── utils.ts
└── types/index.ts        # Shared TypeScript types
```

## Key Concepts

### Games

Games are defined in `app/lib/constants.ts` via `GAMES` and `GAME_SLUGS`. Adding a game requires:

1. Add to `GAME_SLUGS` and `GAMES` in `constants.ts`
2. Add `GameSlug` in `app/types/index.ts`
3. Create a page at `app/(marketing)/{game-slug}/page.tsx`

### Routing

- **League-level**: `/`, `/about`, `/news`, `/leadership`, `/archives`
- **Game-level**: `/{game}`, `/{game}/schedule`, `/{game}/standings`, `/{game}/teams`, `/{game}/roster`
- Navigation switches between league and game context based on pathname (see `getNavigationState` in `constants.ts`)

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
| Global styles | `app/globals.css` |
| Supabase (browser client) | `app/lib/supabase/client.ts` |
| Supabase (server client) | `app/lib/supabase/server.ts` |
| Supabase (service role) | `app/lib/supabase/service.ts` |

## Documentation

- [Supabase setup](dev/SUPABASE.md) — Env vars, client vs server usage
- [Commit message style](dev/COMMIT_STYLE.md) — Conventional commits format
- [Project README](../README.md) — Run instructions
