# Specification: Scoped Local Pre-Migration/Seed Backups

**Status**: Ready for Implementation
**Target Path**: `specs/db-backup-automation.md`
**Related Components**: `db/backup.ts`, `db/seed.ts`, `db/seed-gold.ts`, `db/migrations/`, `package.json` (`db:migrate`)

---

## 0. Revision Note

This spec originally covered a full off-site pipeline: GitHub Actions cron,
`age` encryption, a new private Supabase Storage bucket, RLS lockdown,
retention rotation, restore drills. That work still has value but is
**deferred** — see [issue #89](https://github.com/EZ-Esports/website/issues/89)
for the full off-site plan and why it's on hold.

This revision trims scope to what's actually blocking today: local backups
exist (`requireFreshBackup()` in `db/backup.ts`) but (a) dump the *entire*
`public` schema even though a given seed or migration only ever touches a
known, small subset of tables, (b) have no equivalent guard for
`db:migrate` at all, and (c) never get cleaned up, so `db/backups/` grows
without bound on whatever machine runs these commands. This spec fixes
those three things, locally, with no new infrastructure.

---

## 1. Overview & Objectives

### Key Goals

0. **Backup-before-run is mandatory, not best-effort, for every one of
   `db:seed`, `db:seed:gold`, and `db:migrate` — no exceptions, no bypass
   flag.** If the pre-flight backup fails for any reason, the seed or
   migration **must not run**. This is the load-bearing requirement of the
   whole spec — everything else (scoping, cleanup, restore docs) is in
   service of it. `db:seed`/`db:seed:gold` already have this property via
   `requireFreshBackup()`; `db:migrate` currently has **none**, which is
   the actual gap this spec closes. See §3.2 for the enforcement mechanism
   and §3.1 for what happens if the guard can't confidently determine
   *what* to back up (fall back to backing up everything — never fall back
   to skipping the backup).
1. **Scope backups to what the operation actually touches**, not a full
   `--schema=public` dump, for both existing seed guards and the new
   `db:migrate` guard — an optimization on top of Goal 0, not a
   replacement for it.
2. **Add the missing `db:migrate` guard** — today only `db:seed` and
   `db:seed:gold` call `requireFreshBackup()`; a migration can drop or
   alter a column with zero backup coverage.
3. **Clean up local backups automatically** so `db/backups/` doesn't grow
   forever on a dev machine or CI runner.
4. **Document a local restore procedure** — no encryption/decrypt step
   needed since nothing leaves the machine; still worth a scratch-DB
   restore drill so "we have backups" is a verified claim, not an assumed
   one.

### Non-Goals (all deferred — see §5)

- Off-site/remote copy of any backup.
- Encryption at rest (not needed for local-only files; `db/backups/` is
  already gitignored and already covered by `CLAUDE.md`'s PII handling
  rules for that directory).
- Scheduled/unattended backups independent of someone running a seed or
  migration. This is a real residual gap this spec does **not** close: a
  day with no seed/migrate activity but a bad direct DB edit (e.g. via the
  admin panel or a one-off `psql` session) has zero backup coverage.
  Flagged explicitly, not solved here — closing it means either a cron
  (deferred, needs off-site storage to be worth it) or nothing.

---

## 2. Scoped Backups for Existing Seed Guards

`requireFreshBackup()` currently runs
`pg_dump --no-owner --no-acl --schema=public --file <path> <url>` — a full
dump of every table regardless of which one the calling script is about to
touch. Replace the fixed `--schema=public` flag with an explicit
`--table=public.<name>` flag per table the calling script touches. Table
lists below were read directly out of each script's own delete/mutation
calls, not guessed:

### 2.1 `db:seed` (`db/seed.ts`)

Deletes, in this order: `news_posts`, `matches`, `players`, `rosters`,
`teams`, `seasons`, `members`, `schools`, `games` — **9 tables**.

### 2.2 `db:seed:gold` (`db/seed-gold.ts`)

Touches (insert/update/prune, via `schema.*` references and `pruneByKey()`
calls): `games`, `schools`, `seasons`, `teams`, `rosters`, `members`,
`players`, `matches`, `season_standings` — **9 tables**, mostly the same
set as `db:seed` minus `news_posts`, plus `season_standings`.

### 2.3 Implementation

```typescript
/**
 * Same pg_dump invocation as requireFreshBackup(), but scoped to specific
 * tables instead of the whole public schema. Reuses resolvePgDump() and
 * splitConnectionSecret() as-is.
 */
export function dumpTables(tables: string[], outputFile: string): void {
  // spawnSync(pgDump, ['--no-owner', '--no-acl',
  //   ...tables.flatMap((t) => ['--table', `public.${t}`]),
  //   '--file', outputFile, safeUrl], { ... })
}
```

`requireFreshBackup()` keeps its existing signature and behavior
(fail-closed, delete-stub-on-failure, `assertUsableDump()` check) but its
body calls `dumpTables()` with a caller-supplied table list instead of a
bare `--schema=public` dump. `db/seed.ts` and `db/seed-gold.ts` each pass
their own list (§2.1/§2.2) at their existing call sites — no change to
*when* the guard runs, only to *what* it dumps.

`assertUsableDump()`'s marker check (`CREATE TABLE public.members`,
`COPY public.members`) still works unmodified for `db:seed` (touches
`members`) but **not** for `db:seed:gold`, which also touches `members` —
both scoped dumps include it, so the existing markers hold for both
callers without change. Worth double-checking at implementation time
rather than assuming from this table-list alone.

---

## 3. New `db:migrate` Guard

No guard exists today. `db:migrate` runs
`drizzle-kit migrate` directly (see `package.json`) with no backup step
before it.

### 3.1 Determining which tables a pending migration touches

`db/migrations/meta/_journal.json` lists every migration this repo knows
about, in order (`idx`, `tag`, `when`). Drizzle tracks which have actually
been *applied* to a given database in a tracking table it manages itself
(commonly `drizzle.__drizzle_migrations`, holding a hash per applied
migration — confirm the exact table/column names against the installed
`drizzle-orm` version at implementation time rather than assuming).

Proposed approach:
1. Query the tracking table (read-only) to find how many migrations have
   been applied.
2. Diff against `_journal.json` to get the list of pending `.sql` files.
3. Regex each pending file for table names — matches after `ALTER TABLE`,
   `CREATE TABLE`, `DROP TABLE`, and quoted `"table_name"` occurrences are
   sufficient; this is a heuristic, not a SQL parser.
4. Dedupe into a table list, pass to `dumpTables()`.

**Fallback, not optional**: if step 1-3 can't confidently produce a table
list (tracking table missing/unreadable, zero pending files found when
`db:migrate` is about to run anyway, regex extraction looks suspicious),
**fall back to a full `--schema=public` dump** rather than skipping the
backup or guessing. Guessing wrong here (backing up nothing, or the wrong
tables) is worse than a slightly bigger dump — same principle already
applied to `assertUsableDump()`'s existing size/marker checks.

### 3.2 Guard behavior

Matches the existing seed guards: fail-closed, mandatory, no bypass.
`db:migrate` **must abort** if the pre-migration backup fails, via the
same `requireFreshBackup()`-style guard, called as the first action before
`drizzle-kit migrate` runs — before a single statement executes, exactly
as `db:seed`/`db:seed:gold` already refuse to touch a row before their own
backup succeeds. This is not a "best effort, log a warning and continue"
step; a failed backup is a hard stop. There is no environment variable,
flag, or code path that skips it — the same design principle
`db/seed-target.ts`'s `assertSeedTargetAllowed()` uses for its own gate
(a guard you can bypass from the call site is not a guard).

---

## 4. Local Backup Cleanup

`db/backups/` currently has no cleanup — every `requireFreshBackup()` call
adds a file and nothing ever removes one.

### 4.1 Retention

Keep the **last 20** backup files, delete older ones by filename timestamp
(same lexicographic-sort approach considered for the deferred off-site
plan — timestamps in `backupPath()`'s naming format sort correctly as
strings). 20 chosen loosely generously since these are now scoped,
small dumps (a handful of tables, not the full schema) — cheap to keep more
of them locally than the original off-site plan's 14-day cloud-quota-bound
number.

### 4.2 When it runs

Automatically, as the last step of a successful `requireFreshBackup()` /
new migrate-guard call — not a separate script someone has to remember to
run. Also exposed as a standalone `npm run db:backup:clean` for manual
use.

```typescript
/** Deletes everything in BACKUP_DIR beyond the newest `keep` files. */
export function pruneLocalBackups(keep = 20): void { ... }
```

---

## 5. Deferred Work

Everything below was scoped out of this revision. Each has a tracked
GitHub issue with full context; see [#89](https://github.com/EZ-Esports/website/issues/89)
as the parent/blocking issue for the off-site pipeline and its children.

| Deferred item | Issue | Why deferred |
|---|---|---|
| Off-site/remote upload to Supabase Storage | [#89](https://github.com/EZ-Esports/website/issues/89) | Org call: not expanding Supabase Storage usage until the paid-plan/budget question is settled (see issue for the nuance on whether that's a hard technical requirement). Parent issue for the four below. |
| Encryption key rotation/versioning | [#81](https://github.com/EZ-Esports/website/issues/81) | Only matters once there's a remote, encrypted backup to rotate keys for — blocked on #89. |
| Missed-run/freshness detection | [#82](https://github.com/EZ-Esports/website/issues/82) | Only meaningful once backups run on an unattended schedule (blocked on #89) rather than as a side effect of someone running seed/migrate. |
| More visible failure alerting | [#83](https://github.com/EZ-Esports/website/issues/83) | Same — nothing to alert on until there's a scheduled, unattended job (#89). |
| Event-triggered *off-site* upload before seed/migrate | [#84](https://github.com/EZ-Esports/website/issues/84) | Narrowed: the *local* half of this (scoped backups before seed/migrate) is this spec, §2-§3. Only the off-site-upload half remains deferred, under #89. |
| Storage-scoped Supabase key vs. full service-role key | [#85](https://github.com/EZ-Esports/website/issues/85) | Only relevant once something uploads to Supabase Storage at all — blocked on #89. |
| Restore drill | [#86](https://github.com/EZ-Esports/website/issues/86) | Narrowed: local restore (§6) ships with this spec. Only the remote/encrypted restore path remains deferred, under #89. |
| Point-in-time recovery (PITR) | [#87](https://github.com/EZ-Esports/website/issues/87) | Larger undertaking (WAL archiving) than either the local or off-site full-dump approach; revisit only after #89 ships. |
| Backing up `admin-uploads` images | [#88](https://github.com/EZ-Esports/website/issues/88) | Independent of DB backups entirely; lower risk (re-uploadable, not PII). Still logically a sibling of #89 (both are "copy something off this one Supabase project"). |

---

## 6. Restore Procedure

No encryption/decrypt step for local-only dumps. Add `db/RESTORE.md`:

1. Pick a file from `db/backups/` (or ask whoever ran the last seed/
   migrate where theirs is — these are local-only, not centralized).
2. Restore into a **local or scratch Postgres instance**, never directly
   against production — matches the existing project norm (`CLAUDE.md`:
   "If you're testing seed/migration changes, do it against a local
   Postgres... never by relying on `.env`").
   ```
   psql <scratch-db-url> < db/backups/<file>.sql
   ```
   Note: a scoped dump (§2/§3) only contains the tables it targeted —
   restoring it into an *empty* scratch DB requires the target schema to
   already exist there (run migrations first), since `--table`-scoped
   `pg_dump` output has no `CREATE TABLE` for tables outside its scope by
   design.
3. Verify row counts / spot-check a few tables against expectations.
4. Restoring into production (if this is ever the actual recovery path,
   not a drill) requires explicit user confirmation per this repo's
   standing rule on destructive/production actions — not something to
   automate or gate-bypass.

### 6.1 Restore drill

Recommend doing this once, for real, against a scratch DB, before this
spec is considered done — not just documented as a procedure nobody has
run.

---

## 7. Quality & Verification Gates

- [ ] `dumpTables()` and `pruneLocalBackups()` covered by unit tests that
      don't require a live Postgres connection (table-flag construction,
      retention/deletion logic, filename sorting) — mirroring
      `db/__tests__/backup.test.ts`'s existing style.
- [ ] `db:seed` and `db:seed:gold` still pass their existing test coverage
      with the scoped dump in place instead of the full-schema one.
- [ ] New `db:migrate` guard: confirm the pending-migration table-list
      extraction actually works against a real pending migration, and
      confirm the fallback-to-full-dump path triggers correctly when
      extraction is inconclusive.
- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint` all pass.
- [ ] A restore drill (§6.1) is performed at least once.
- [ ] Confirm `pruneLocalBackups()` never deletes the backup that was just
      written in the same run (off-by-one risk when "keep last 20" runs
      immediately after adding file #21).
