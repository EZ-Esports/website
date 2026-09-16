# Architecture

Why the stack looks like this, not a tour of files. Next.js 16 here is not the Next.js in most training data — read `node_modules/next/dist/docs/` and the agent-rules block in [`CLAUDE.md`](../CLAUDE.md) (`cce733b`) before changing framework APIs. `revalidateTag` needs a profile argument (`98edc57`). The old `middleware.ts` convention became `proxy.ts` (`73d408b`). Firefox infinite-reload workaround: `experimental.reactDebugChannel: false` in `next.config.ts` (`f5e26ed`, added on Next ^16.2.6); still set at HEAD despite `next` ^16.3.5.

Onboarding for env vars: [`docs/dev/SUPABASE.md`](../docs/dev/SUPABASE.md). Do not use `.env`’s `DATABASE_URL` as a scratch database — it is production. See [`CLAUDE.md`](../CLAUDE.md).

---

## Data: constants → Drizzle → gold upserts

**Dec 2025.** League data lived in `app/lib/constants.ts` and static TS modules. Fast to ship; every score change was a commit.

**Jun 2026 (`e4e53f7`).** Drizzle + Supabase Postgres (`postgres` driver). Hierarchy that stuck: **Game → Season → Team (school × game × season) → Roster (Varsity/JV) → Player (member)**. Matches reference roster IDs (`5b803f8`), because archived CSVs labeled divisions A/B and Varsity/JV need independent records. Computed `roster_standings` view replaced stored W–L on teams.

February’s `DATABASE.md` (`cf27afb`) described a different model (`people`, `team_staff`, `org_staff`, JSONB match maps). June implemented **`members` + a flat `leadership` table** instead — closer to admin UX. The aspirational doc was deleted when it became misleading (`2efca7b`). A `people` table did arrive in August, but only as **org-staff identity** (`f14c7f4`), not the February “everyone is a person” design. See [`specs/leadership-architecture.md`](../specs/leadership-architecture.md). The spec’s “fall back to legacy `leadership`” line is not implemented: `getCachedLeadership()` inner-joins `people` + `leadership_terms` only. The legacy `leadership` table remains in `schema.ts`.

**Jun 15 (`930299c`).** Dummy seed replaced by a one-shot import of two gitignored root CSVs. 389 Valorant matches landed `scheduled` with null scores. No bronze/silver/gold yet.

**Jul 2 (`9a5778b`).** SharePoint workbook → `sharepoint/main.py` (bronze) → `normalize_silver.py` → `normalize_gold.py` → `gold_data/*.csv` → `db/seed-gold.ts`. Coverage: LoL, TFT, Valorant, 2023–26. Derived standings skipped when results are incomplete. Combined LoL tables are explicit `seasons.standings_format` (`0025`), not inferred from row shape. After `2aece37`, bronze finds the ledger tab by columns, not the name `MAIN` (it had been renamed Engineering and the refresh was silently dying).

**35 migrations** (`0000`–`0034`). Mix of Drizzle-generated SQL and hand-written RLS/triggers/backfills. Do not edit applied files; add a new one (`0f08472` exists because someone mutated `0017`). Same-day rewrites of not-yet-settled files (`0019`/`0020` hours after creation; `0031` twice the afternoon it landed) are a weaker class — still prefer a new file once anything may have run.

**Jul 30–31.** Wipe-and-reinsert gold seed destroyed UUIDs, logos, and cascaded leadership. Response: natural keys (`members.member_key`, `matches.source_key`, `season_standings.source_key` — `0026`); gold seed **upserts** and does not touch CMS/leadership (`9219ef5`); `db:seed` (the old CSV importer) is still a wipe of the nine tables it owns and is more dangerous than gold. `CLAUDE.md` still says both seeds “delete and re-insert” — true of `db:seed`, stale for `db:seed:gold`. Believe `db/seed-gold.ts`’s header comment.

Natural keys include a `#n` occurrence ordinal — 2022-23 Valorant timestamps collide (e.g. two New Dorp vs Cardozo rounds). An earlier standings unique on rank was wrong (rank is payload; admin allows null rank) and was replaced by `source_key` in the same PR. Backfill verified on a scratch restore: 772 member keys, 719 match source keys.

| Script | Strategy at HEAD |
|--------|------------------|
| `db:seed:gold` | Upsert on natural keys (`9219ef5` #58). Prune matches/standings only where `source_key` is non-null; never prune members/players. CSV owns only its columns (admin logos/bios/banners not overwritten). `games.image_url` filled only when null. |
| `db:seed` | Still **deletes nine tables** then re-inserts. Expects two gitignored **root** CSVs. Leadership merge identity `(name, year)` (`1a72aad`); role is match-preference, not the key — do not trust `leadership-merge.ts` header comment. Never overwrite bios. |
| `db:seed:leadership` | Merge loader from gold CSV into **legacy `leadership` only** (`db/leadership-merge.ts`). Public `/leadership` reads `people` + `leadership_terms` via `getCachedLeadership()` — never that table. One-shot hop to the public model: `db/backfill-leadership.ts` (not in `package.json`). Sheet refill + this script does **not** update the public page; ongoing edits go through admin CMS. |
| `db:seed-owner` | Owner role bootstrap. |

All destructive scripts: `assertSeedTargetAllowed()` (loopback unless `SEED_ALLOW_REMOTE=<exact-hostname>`) then `requireFreshBackup`. `db:push` (`drizzle-kit push`) is **not** gated — it hits whatever `DATABASE_URL` drizzle-kit loads from `.env` (production). Do not use it against `.env`. Completeness check is a byte floor plus pg_dump’s “dump complete” marker — a failed dump still writes a ~4.8 KB header. `db/migrate.ts` (`b638369` #90) diffs pending migrations, dumps touched tables, then `drizzle-kit migrate`. Output: gitignored `db/backups/`. Restore: [`db/RESTORE.md`](../db/RESTORE.md) (scratch DB only). Off-site is issue #89. Spec: [`specs/db-backup-automation.md`](../specs/db-backup-automation.md).

**Aug.** Leadership: `people` + `leadership_terms` in **`0032` only** (`f14c7f4`); 201 rows → 112 profiles / 178 terms. `people.member_id` ON DELETE SET NULL is declared in `0032`; **`0027`** (`688fb51`, Jul 31) rewrote the same rule on **legacy** `leadership.member_id` only. Applications: **`0033`** (`6df7d59`) adds `details jsonb` (deliberately omitted from the `0031` trigger so `db/backfill-application-details.ts` can run); **`0034`** (same commit) extends immutability to `details`. Append-only status logs remain `0031`; legacy `message` kept during expand/migrate/contract.

---

## Auth / RBAC

1. Supabase SSR cookies (`784f3d7`) — any signed-in user could hit `/admin`.
2. Allowlist + hashed invites (`0849963`, PR #8). Auth ≠ authorization.
3. Discord-style `roles` / `user_roles` / `staff_members` (`ad77369`, late June).
4. Granular permissions, membership vs capability split (`0019`, PR #18). Flags in `app/lib/roles.ts`: `MANAGE_ROLES`, `MANAGE_LEAGUE`, `MANAGE_ROSTERS`, `MANAGE_MATCHES`, `MANAGE_NEWS`, `MANAGE_LEADERSHIP`, `MANAGE_GALLERY`, `MANAGE_SPONSORS`, `MANAGE_APPLICATIONS`, `MANAGE_SCHOOLS`, `MANAGE_CONTENT`. Owner/`ADMINISTRATOR` bypass. Section map: `ADMIN_SECTION_PERMISSIONS` in `app/lib/staff-access.ts`; gate: `getStaffForAdminSection` in `app/lib/auth.ts`.
5. `staff_revocations` tombstones (`0020`). A revoked identity stays revoked across user recreate; restore is an explicit trusted workflow (`docs/QUICKSTART.md` `--restore-revoked`). `pg_advisory_xact_lock` vs self-heal race (`29465a7`).

**No advisor RBAC preset.** Bitmask can express applications-only; there is no school-advisor scoped model.

RLS is on (`0012`+, `4be3c49`). Storage writes/deletes use the **service-role** client (`3cce264`); the anon client + bucket RLS was a silent no-op. Gate those paths with server-side `requireStaff()`, not RLS alone.

Rate limit exists for apply POST, staff apply, uploads, and staff invites (`app/lib/rate-limit.ts` — in-process Map, resets on serverless cold start; comment points at Upstash). **Login has none.**

---

## Caching

`unstable_cache` tags at HEAD: `games`, `schools`, `members`, `teams`, `seasons`, `matches`, `rosters`, `players`, `news`, `leadership`, **`people`** (used in `queries.ts`; **missing from the `CLAUDE.md` list**), `sponsors`, `page-content`, `gallery-images`. `recent-results` is a cache **key** on the League Pulse query, not a tag — its tags are `matches`, `schools`, `rosters`, `teams`, `games`, `seasons`. Admin mutators call `revalidateTag(tag, {})`. Entries live in **Vercel Data Cache** and survive redeploys. UUID-changing seeds/migrations leave pages empty against a healthy DB — that is the July 30 failure mode. After `9219ef5`, gold upserts exist specifically so row IDs stay stable. There is still no dedicated cache-purge tool.

---

## Frontend

- **Tokens.** July rewrite PRs #11–#13: two-layer semantic tokens (`:root` + `@theme inline` in `globals.css`), primitives under `components/ui/`, admin denser via `admin/styles.ts`. Bridge aliases kept old pages compiling until PR #13 deleted them.
- **RAC.** PR #14: `Providers.tsx` + `RouterProvider`; menus, modals, selects, forms. Prefer React Aria Components for overlays and form controls; see `.claude/skills/ui`.
- **Game hub.** `GameHubView` on division routes + `getGameHubData()` (`288855e`), then bento tiles (`c759fa3`) with inline CSS variables for accent. Bare `/{game}` is a config 308, not `redirect()`. Games without seasons get empty bento + `MigrationNotice`, not a recruitment grid (`d047f99`).
- **Gallery.** Four generations in August: lazy carousel → Framer Motion drag → Embla → dual-row AutoScroll marquee (`d2cd83d`). Homepage gallery still has defensive dedupe in `getCachedHomepageGallery` (`dc69fd4`, 13 Jul UI-rewrite week — predates set consolidation `956bcb7` / `0021`).
- **Teams.** Client-side `TeamsFilterClient` (season / school / division) rather than a server round-trip per chip.
- Image remote host is the Supabase project hostname.

---

## CI / agent tooling

`f5563e7` (#70): GitHub Actions on push/PR to `main` — `npm ci` → lint → Vitest → `tsc --noEmit` → build (dummy env). `.githooks/pre-push` mirrors the three local checks; `prepare` sets `core.hooksPath`. No `.github/dependabot.yml`; alerts handled as manual PRs (`02011df`, `27909e4`, `9d40278`, `0463b43`, `ae86069`).

Agent skills (`implement`, `review-loop`, `ui`, `uiux`, `create-artifact`, `cleanup`) are repo artifacts for AI-assisted development, not runtime features. **`.claude/` is canonical**; `.gemini/` is an Antigravity mirror (`d217ef8` #54), kept in sync by hand. `36ab5fc` deleted `.agents/skills/website-ui-standards`; **no `.agents/` at HEAD**. Implement skill uses isolated `.claude/worktrees/` per PR. `CLAUDE.md` ends with a Next.js-generated `<!-- BEGIN:nextjs-agent-rules -->` block rewritten by `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`); dropping it from a diff only recreates the uncommitted change.
