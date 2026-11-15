# spec-036: Onboarding test data purge script

- **Spec ID:** spec-036
- **Title:** Guarded one-off script that deletes non-staff onboarding records and manager Auth logins
- **Status:** Implemented and merged (PRs #284 and #287). Run against production on 2026-10-27 (database only; no login accounts were deleted). No migration.
- **PR / Commit:** #284 (script), #287 (pooler hang fix)
- **Date:** 2026-10-26
- **Scope:** `db/purge-onboarding-test-data.ts`, npm script `db:purge:onboarding-test-data`, `db/__tests__/purge-onboarding-test-data.test.ts`, `docs/dev/PURGE-ONBOARDING-TEST-DATA.md`.

## Context & Motivation

The owner states all onboarding data in the database is test data. It must go, without touching staff. A migration was rejected on purpose: anyone running `db:migrate` later would re-apply row deletions. A script runs only when someone types it, shows the plan first, and needs the exact hostname and row count typed back.

## Foreign-key graph (from `app/lib/db/schema.ts` and `db/migrations/`)

| Table | Link | Decision |
| --- | --- | --- |
| `onboarding_consents` | member (cascade), invite id (no FK) | delete for non-staff members |
| `student_demographics` | member (cascade) | delete for non-staff members |
| `player_identities` | member (cascade) | delete for non-staff members |
| `players` | member (**restrict**), roster | delete rows of deleted members first; the roster stays |
| `player_invites`, `manager_invites` | member (set null), no email column | delete all not protected, incl. drafts |
| `school_managers` | member (set null), `user_id` (no FK, Auth) | delete all not protected |
| `members` | school (restrict) | delete if onboarding footprint, no `member_key`, not protected |
| `staff_members`, `people`, `leadership` | member (set null) | keep; their members are protected |
| `user_roles`, `staff_*`, `roles` | staff | keep, and feed the protected set |
| `match_reschedule_requests`, `match_reschedule_options` | `requested_by_user_id` (no FK to Auth); options cascade from requests | delete those requested by deleted managers; `matches` is never changed or reverted |
| schools, games, seasons, teams, rosters, matches, standings, sponsors, news, gallery, applications | | keep |

No table has an FK to `school_managers`, `player_invites` or `manager_invites`; a test fails if a new FK to `members` appears.

## Behaviour

- `--dry-run` is the default: prints, per table, rows to delete / protected / kept, and the protected people (initials and masked email). No backup, no writes.
- `--execute`: `assertSeedTargetAllowed()` first, then the plan, a scoped `requireFreshBackup`, a typed `purge <host> <count>` confirmation, then one transaction that locks the tables, rebuilds the plan and compares it with the confirmed one, deletes in dependency order, checks each row count and that protected rows survive. Any mismatch throws and rolls back.
- `--delete-auth-users` (only with `--execute`): after commit, deletes Auth users of deleted manager rows through the repo's service client (`SUPABASE_SECRET_KEY` read by name), one at a time, minus staff by id and by live email (an unreadable email protects). Failures are masked, saved to `db/backups/` for `--auth-user-ids-file` retries, exit code 2.
- Idempotent: an emptied database yields an empty plan, no backup, no prompt.

## Decisions beyond the brief

- A member is deleted only when every `players` row is on the active season of its game; any past or undeterminable season keeps the member and roster rows (onboarding records still purged). The `member_key` schema comment alone is not trusted.
- The typed phrase is `purge <host> <dbRows> <playersRows> <authUsers>`; Auth deletion is irreversible and outside the backup. A database-only run saves the Auth ids (after commit) for a separate `--delete-auth-users --auth-user-ids-file` run.
- The Auth cross-check (live Auth emails of staff, role holders and kept managers protect matching members) is required for `--execute` unless `--skip-auth-staff-crosscheck`.
- Inside the transaction, counts of staff, roles, leadership, people, schools, teams, rosters, matches and players are compared before and after.
- The dry run lists every member and Auth candidate that would be deleted, masked, and saves the list to `db/backups/`.
- The SQL is rehearsed against an in-memory PGlite built from `db/migrations/*.sql` (`db/__tests__/purge-onboarding-pglite.test.ts`).
- Members with a gold-archive `member_key` keep their row and roster history (onboarding upserts by email, so an alumnus may have been onboarded); only their onboarding records are deleted.
- Same-name-as-staff and a draft mentioning a staff email count as ambiguous and protect.
- Staff-linked `leadership`/`people` members are protected as staff.

## Cache

A script cannot call `updateTag`. It prints the tags to refresh (`members`, `players`, `rosters`, `teams`, `schools`, `matches`, `people`, `leadership`) and the "save any admin row" workaround.

## Unverified without the live database

See the final report of the implementing session and the dry run: whether all test members lack `member_key`; whether `staff_audit_logs.user_id` includes manager ids; whether any staff application email is a student's; row counts per table.

## First real dry run: pooler hang (fixed)

The first dry run against production hung with no output and ~0 CPU. Cause: the snapshot read ~20 tables with `Promise.all` over a single `max: 1` connection, which postgres.js pipelines, and the Supabase transaction pooler (port 6543) never answers a pipelined batch (a single query takes ~200 ms, four at once never return). The in-memory PGlite rehearsal cannot reproduce a pooler, so it passed. Fix: `loadSnapshotFrom` runs its queries strictly one at a time, the script logs `Reading the database (read-only)...` before it starts, and `db/__tests__/purge-snapshot-sequential.test.ts` fails if two queries are ever in flight at once. No data was at risk (the run was read-only).

Also seen: the Auth/staff email cross-check calls the Supabase Auth admin API over HTTPS; on a network that cannot reach it the lookups time out (10 s each), the dry run prints the SKIPPED warning, and `--execute` refuses unless `--skip-auth-staff-crosscheck` is passed. Run from a network that can reach Supabase.

## Run record (2026-10-27)

Run by the owner from `main` with `--execute` (database only), after a dry run they reviewed. The staff email cross-check ran (no skip warning), using `NODE_OPTIONS=--tls-max-v1.2` because Node 24's TLS 1.3 handshake to `*.supabase.co` hangs on the owner's network.

- **Deleted 36 database rows** in one committed transaction after a 472 KB scoped `pg_dump` backup (`db/backups/`, file name `gold-seed-<timestamp>.sql`): 6 members (all at the test school "Monsters High School"), 12 player identities, 6 student demographics, 3 roster rows (all on the active season), 8 player invites, 1 manager invite. Match reschedule rows, consents and manager assignments: 0.
- **Protected 7 people** (staff-linked or ambiguous name matches), kept archive members 0, past-season roster history 0. **0 Supabase Auth users were deleted**: the only two manager rows belonged to staff, so no `--delete-auth-users` run was needed.
- A verification dry run afterwards showed 0 left to delete. Two tables (`student_demographics`: 7, `school_managers`: 2) had also lost the protected people's own rows; the owner confirmed they deleted those by hand on purpose, so nothing needed restoring. The script's accounting (36 rows) matched exactly.
- Remaining manual step: refresh the Vercel Data Cache tags (`members`, `players`, `rosters`, `teams`, `schools`, `matches`, `people`, `leadership`) by saving any admin row with its existing values.
