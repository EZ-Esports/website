# Running the site against a local database

`.env` points at the production database, and production does not have the roster-redesign schema
(migrations 0060 to 0062, [spec-060](../../spec/spec-060-school-owned-season-rosters.md)) until someone
applies it. So the app cannot run on `.env` as it is. This is a safe local alternative: a throwaway Postgres
(PGlite served over a loopback socket) with every migration applied and invented sample data. It never reads
`.env`, never connects to a remote host, and keeps its data in the git-ignored `.local-db/` folder.

## Commands

Open two terminals in the repo root (run `npm install` once first: it adds `@electric-sql/pglite-socket`).

```bash
# Terminal 1: the database. Leave it running. Ctrl+C stops it.
npm run db:local:start -- --fresh        # builds the schema through migration 0061 and listens on 127.0.0.1:54329

# Terminal 2:
npm run db:local:seed                    # invented schools, rosters, players, matches, standings
npm run dev:local                        # next dev with DATABASE_URL forced to the local database
```

Then open http://localhost:3000. For the staff portal (`/admin`), sign in once, then make yourself an Owner
**in the local database only**:

```bash
npm run db:local:grant-owner -- you@example.com
```

and refresh `/admin`. Sign-in itself goes to the Supabase project in `.env` (only Postgres is local); the
sample seed has no Supabase users.

Options for the first command: `--through 0062` builds the final schema instead of the deploy gap (the state
between "0060 and 0061 applied, new code live" and "0062 applied"; both must work, default is 0061),
`--fresh` deletes `.local-db` first (needed to change `--through` or reseed), `--port N` changes the port
(set `LOCAL_DATABASE_URL` for the other commands if you do).

## What to try

League Operations > League Setup > Valorant > 2026-27 (the season page):

- **Add school**: pick *Gamma Sample HS* (in no season). It gets the Valorant rosters (Varsity and JV) at once.
- **Restore**: pick *Removed Sample HS* (it has rosters but no membership). The picker says it keeps its rosters; adding it
  brings the same rosters, players and its match back, and creates nothing new.
- **Remove** a school tile: confirm. The school leaves the list; its rosters, players and matches stay (check
  `/admin/matches`, and the school's page under Schools & Rosters, which flags the season "Not in this season").
- Public pages (`/valorant/teams`, `/valorant/standings`, `/valorant/schedule`, `/archives`) after each change:
  a removed school and every match it is in disappear; adding it back restores them.
- The school page (click a tile): edit rosters and players, with the flag badges and both emails.

## Safety

- The local scripts read only `LOCAL_DATABASE_URL` (default `postgres://postgres:postgres@127.0.0.1:54329/postgres`),
  refuse any non-loopback host (even with `SEED_ALLOW_REMOTE`), and are run without `--env-file`.
- `npm run dev:local` overrides `DATABASE_URL`, but the rest of `.env` still loads. Anything that calls Supabase
  directly (sign-in, staff invites, student ID storage) still uses the project in `.env`. Do not use those
  features with real people's data while testing.
- Known limit: PGlite is a single connection, so `dev:local` runs the app with one database connection
  (`DATABASE_POOL_MAX=1`); a page that reads the database from inside a transaction on a second connection would wait.
