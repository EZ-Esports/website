# Spec 008: Safe Ingestion Pipeline with Pre-Mutation Diff Planning & Non-Destructive Merge

- **Status:** Shipped
- **Date:** 2026-09-28
- **Scope:** `db/seed-gold.ts`, `db/backfill-leadership.ts`, `package.json`, `sharepoint/README.md`, `CLAUDE.md`, `db/__tests__/ingestion-dryrun.test.ts`

---

## Context & Motivation

Historical league data originates from disparate, evolving sources (Google Sheets, Discord channels, SharePoint exports). In previous iterations, reloading archive spreadsheets resulted in two high-impact failure modes:
1. **Accidental clobbering:** Blindly executing updates against live databases risked overwriting human-curated data (such as player bios, school logos, or admin adjustments) with stale or blank values from old spreadsheets.
2. **Operational friction with host gates:** The production interlock (`assertSeedTargetAllowed()`) added in PR #180 safely prevented accidental wipes, but blocked operators from inspecting target databases to preview changes before applying them.

Industry standards for backfilling and data ingestion require:
- **Dry-run inspection:** The ability to diff incoming records against the target database and review an exact insertion/update/prune plan prior to execution.
- **Non-destructive field coalescing:** Upserts must never overwrite existing non-null database fields with null or missing spreadsheet data.
- **Clear separation of concerns:** Differentiating local dummy fixture seeds (`db:seed`) from production ingestion pipelines (`db:ingest:*` / `db:backfill:*`).

---

## Design Decisions

### 1. Pre-Mutation Diff Planning (`--dry-run`)
- Both `db/seed-gold.ts` and `db/backfill-leadership.ts` now accept the `--dry-run` flag.
- When `--dry-run` is active:
  - Host gating via `assertSeedTargetAllowed()` is bypassed (read-only queries are completely safe against any target environment).
  - Pre-seed backup generation via `requireFreshBackup()` is skipped.
  - The script executes `db.select()` queries against existing tables, matches incoming records against natural keys, and tabulates:
    - **Total Incoming** records.
    - **To Insert:** Records whose natural keys do not exist in the database.
    - **To Update:** Records with matching keys where payload fields differ.
    - **Unchanged:** Identical records.
    - **To Prune:** Archive-managed records present in the database but absent from the latest archive.
  - A clean, aligned summary table is printed to `stdout`, and the process exits with code 0 without executing any mutations (`db.insert`, `db.update`, `db.delete`).

### 2. Field-Level Non-Destructive Coalescing
- In `db/seed-gold.ts`, player bio upserts now use:
  ```sql
  bio = coalesce(players.bio, excluded.bio)
  ```
  This guarantees that if an administrator or student player entered a bio in the application, an archive reload with empty or null bio columns will never overwrite or blank the existing bio.

### 3. Canonical Script Aliases
- In `package.json`, canonical ingestion commands are defined:
  - `npm run db:ingest:gold`: Upserts normalized archive datasets.
  - `npm run db:ingest:leadership`: Merges staff and leadership records.
  - `npm run db:backfill:leadership`: Normalizes legacy leadership records into `people` and `leadership_terms`.
- Legacy `db:seed:gold` and `db:seed:leadership` commands are preserved for backwards compatibility.

---

## Invariants & Boundaries

1. **Zero Mutations on Dry Run:** Under `--dry-run`, zero write queries (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) may be dispatched.
2. **Gated Execution on Live Mutations:** Any mutation run (`--dry-run` omitted) strictly enforces `assertSeedTargetAllowed()`, failing closed unless targeted at loopback or authorized via `SEED_ALLOW_REMOTE=<exact-host>`.
3. **Natural Key Preservation:** Entity resolution relies exclusively on deterministic natural keys (`matches.sourceKey`, `members.memberKey`, `seasonStandings.sourceKey`, `(schoolId, gameId, seasonId)`, `(teamId, name)`, `(rosterId, memberId)`). Row UUIDs are permanently preserved across re-runs.

---

## Verification

1. **Unit & Invariant Tests:**
   ```bash
   npx vitest run db/__tests__/ingestion-dryrun.test.ts db/__tests__/seed-guards.test.ts
   ```
2. **Full Test Suite:**
   ```bash
   npm test
   ```
3. **Type Safety & Linting:**
   ```bash
   npx tsc --noEmit
   npm run lint
   ```
