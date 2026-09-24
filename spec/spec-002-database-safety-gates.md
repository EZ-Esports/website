# spec-002: Database Mutation Safety Gates & Seed Retirement

- **Status:** Shipped
- **PR:** #180 (#146)
- **Date:** 2026-09-24
- **Scope:** `db/migrate.ts`, `drizzle.config.ts`, `db/seed.ts`, `db/backfill-leadership.ts`, `db/seed-owner.ts`, `app/lib/db/seed-phase2.ts`, `.gitignore`, `db/__tests__/seed-guards.test.ts`

## Context & Motivation

During the September 2026 Codebase Quality Audit (findings DB-3, DB-9, ARCH-9, DB-10), critical database safety vulnerabilities and operational risks were identified:
1. **Destructive UUID Churn in Seed**: The legacy `db/seed.ts` script performed blanket `db.delete(...)` operations across core tables (`news_posts`, `matches`, `players`, `rosters`, `teams`, `seasons`, `members`, `schools`, `games`) and re-inserted rows with new UUIDs. This invalidated Vercel Data Cache tags and triggered empty-page rendering failures on production.
2. **Unguarded Direct Schema Push (`db:push`)**: Running `drizzle-kit push` directly applied schema modifications to whatever database was referenced in `DATABASE_URL` without migration files, risking unintended data loss if executed against a remote database.
3. **Unguarded Administrative Scripts**: Scripts such as `db/migrate.ts`, `db/backfill-leadership.ts`, `db/seed-owner.ts`, and `app/lib/db/seed-phase2.ts` could execute against remote databases without explicit operator confirmation.
4. **Student PII Leak Risk**: Nested directories under `sharepoint/` containing student contact info and competition records were not fully excluded by git, posing a potential privacy exposure.

## Design Decisions

1. **Universal Host-Gate Enforcement (`assertSeedTargetAllowed`)**:
   - Gated all operational mutation entry points:
     - `db/migrate.ts`: Asserts target allowed at the start of `main()` and inside `determineScope()`.
     - `drizzle.config.ts`: Intercepts `push` commands (`process.argv` containing `push` or `npm_lifecycle_event === 'db:push'`) and blocks non-loopback URLs before touching the database.
     - `db/backfill-leadership.ts`: Blocks remote execution at entry.
     - `db/seed-owner.ts`: Halts before touching Supabase Auth or database tables.
     - `app/lib/db/seed-phase2.ts`: Marked deprecated/unsafe and gated against remote execution.
   - All scripts fail closed against non-loopback URLs unless the operator explicitly passes `SEED_ALLOW_REMOTE=<exact-host>`.

2. **Retire Destructive `db/seed.ts`**:
   - Eradicated all destructive `db.delete(...)` queries from `db/seed.ts`.
   - Converted `main()` in `db/seed.ts` to log a clear retirement message and exit with code `1`.
   - Directed operators to idempotent upsert workflows:
     - `npm run db:seed:gold`: Upserts archive data while preserving existing row UUIDs.
     - `npm run db:seed:leadership`: Merges leadership records without wiping rows or breaking foreign keys.

3. **Recursive SharePoint CSV Exclusion**:
   - Added `sharepoint/**/*.csv` and `/sharepoint/**/*.csv` to `.gitignore` to prevent committing student PII regardless of folder nesting depth.

4. **Runtime Behavioral Testing**:
   - Replaced brittle source-code regex grepping with genuine behavioral tests in `db/__tests__/seed-guards.test.ts`:
     - Verified `seedMain()` exits with code `1` and emits retirement instructions on loopback targets, and fails closed on remote targets.
     - Verified `determineScope()` in `db/migrate.ts` fails closed on remote connections.
     - Verified `git check-ignore` correctly excludes deeply nested SharePoint CSVs.

## Invariants & Boundaries

- No database mutation script may run against a non-loopback host without explicit `SEED_ALLOW_REMOTE=<exact-hostname>`. Blanket values (`*`, `1`, `true`) are rejected.
- Operational seeds must use `onConflictDoUpdate` (upserts) preserving existing row IDs; destructive deletes of core tables are prohibited.
- Files matching `sharepoint/**/*.csv` must never be tracked in git.

## Verification

- Vitest suite: `npx vitest run db/__tests__/seed-guards.test.ts`
- Full test suite: `npm test`
- Type checking: `npx tsc --noEmit`
- Production build validation: `npm run build`
- Git ignore validation: `git check-ignore sharepoint/a/b/c/nested.csv`
