# spec-036: Onboarding test data purge script

- **Spec ID:** spec-036
- **Title:** Guarded one-off script that deletes non-staff onboarding records and manager Auth logins
- **Status:** Implemented on branch `chore/purge-onboarding-test-data` (not merged). Not run against any database. No migration.
- **PR / Commit:** pending
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
| `match_reschedule_requests` | `requested_by_user_id` (no FK) | keep (matches data) |
| schools, games, seasons, teams, rosters, matches, standings, sponsors, news, gallery, applications | | keep |

No table has an FK to `school_managers`, `player_invites` or `manager_invites`; a test fails if a new FK to `members` appears.

## Behaviour

- `--dry-run` is the default: prints, per table, rows to delete / protected / kept, and the protected people (initials and masked email). No backup, no writes.
- `--execute`: `assertSeedTargetAllowed()` first, then the plan, a scoped `requireFreshBackup`, a typed `purge <host> <count>` confirmation, then one transaction that locks the tables, rebuilds the plan and compares it with the confirmed one, deletes in dependency order, checks each row count and that protected rows survive. Any mismatch throws and rolls back.
- `--delete-auth-users` (only with `--execute`): after commit, deletes Auth users of deleted manager rows through the repo's service client (`SUPABASE_SECRET_KEY` read by name), one at a time, minus staff by id and by live email (an unreadable email protects). Failures are masked, saved to `db/backups/` for `--auth-user-ids-file` retries, exit code 2.
- Idempotent: an emptied database yields an empty plan, no backup, no prompt.

## Decisions beyond the brief

- Members with a gold-archive `member_key` keep their row and roster history (onboarding upserts by email, so an alumnus may have been onboarded); only their onboarding records are deleted.
- Same-name-as-staff and a draft mentioning a staff email count as ambiguous and protect.
- Staff-linked `leadership`/`people` members are protected as staff.

## Cache

A script cannot call `updateTag`. It prints the tags to refresh (`members`, `players`, `rosters`, `teams`, `schools`, `matches`, `people`, `leadership`) and the "save any admin row" workaround.

## Unverified without the live database

See the final report of the implementing session and the dry run: whether all test members lack `member_key`; whether `staff_audit_logs.user_id` includes manager ids; whether any staff application email is a student's; row counts per table.
