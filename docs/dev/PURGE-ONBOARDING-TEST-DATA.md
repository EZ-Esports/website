# Purge onboarding test data

`db/purge-onboarding-test-data.ts` deletes the student and school-manager onboarding records that were created while testing, and optionally the managers' Supabase Auth logins. It is a one-off script, not a migration, so nobody applies it by accident. The owner runs it; CI never does.

`.env` points at live production. The gate, backup and confirmation exist to stop accidents; none of them replaces reading the dry run first.

## What it deletes

In this order, inside one transaction: `match_reschedule_options`, `match_reschedule_requests`, `onboarding_consents`, `student_demographics`, `player_identities`, `players`, `player_invites`, `manager_invites`, `school_managers`, `members`.

A `members` row is deleted only when all of these hold:

- it has an onboarding footprint (an invite, manager row, consent, demographics row or identity);
- it has no gold-archive `member_key`;
- every `players` row it has sits on a roster of a season that is **currently active**. Anyone with a row on a past season, or on a season the script cannot determine, keeps their member row and roster history, but their onboarding records are still deleted. The dry run counts them on the line "Kept: has past-season roster history".

Members with no onboarding footprint (admin-created) are never touched.

Reschedule requests made through the portal by deleted managers (and their proposed times) are deleted. **Matches are not changed or reverted.** If staff approved a reschedule, that match already has its new time, and it keeps it.

## What it protects

Never deleted, together with their member row, manager rows, invites, consents, demographics, identities, roster rows and Auth user:

- any user in `staff_members`, `user_roles`, `staff_revocations`, `staff_audit_logs`, `people.user_id`, or who invited staff;
- any member linked from `staff_members.member_id`, `people.member_id` or `leadership.member_id`;
- any member whose email (case-insensitive) matches a staff member, staff invite, revoked staff, accepted staff application or `people` row;
- **Auth cross-check:** any member whose email equals the live Auth email of an Auth user that has a `staff_members` row, a `user_roles` row, or a kept manager row. This needs the Supabase service credentials (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, read from the environment by name);
- any member with the same name as a staff member or `people` row (ambiguous, so kept);
- any invite whose saved draft mentions a staff email.

Protection spreads: if one row of a person is protected, every row that ties them to another person is too. An Auth user is also protected when its live email matches staff or cannot be read.

Kept untouched: schools, games, seasons, teams, rosters, matches, standings, sponsors, news, gallery, leadership/`people`, staff applications, roles. In the transaction the script counts staff_members, user_roles, leadership, people (total and with a member), schools, teams, rosters, matches and players before and after, and rolls back if anything but the planned rows moved.

## The dry run

It prints a table per table (delete / protected / kept), the protected people, **every member that would be deleted** (initials, masked email, school, whether they have a manager row or invite, roster-row count per season, Discord identity) and every Auth user candidate (masked). The same list is saved, masked, to `db/backups/purge-onboarding-plan-<time>.txt` (gitignored; the header has host and timestamp).

If the Supabase credentials are not in the environment, the dry run says loudly that the Auth/staff cross-check was skipped, and `--execute` refuses to run without them unless `--skip-auth-staff-crosscheck` is passed.

## Commands (PowerShell)

```powershell
# 1. Dry run (default): reads production, mutates nothing
npm run db:purge:onboarding-test-data

# 2. Database only. Name the exact host from DATABASE_URL.
$env:SEED_ALLOW_REMOTE = '<exact-db-hostname>'
npm run db:purge:onboarding-test-data -- --execute

# 3. Separate run for the Auth logins (irreversible), using the id list step 2 saved
npm run db:purge:onboarding-test-data -- --execute --delete-auth-users --auth-user-ids-file=db/backups/purge-onboarding-auth-ids-<time>.json

Remove-Item Env:SEED_ALLOW_REMOTE
```

Recommended: do step 2, check the site, then step 3. Step 2 saves the managers' Auth ids to `db/backups/purge-onboarding-auth-ids-<time>.json` (`{ host, createdAt, ids }`) after the commit, because once their `school_managers` rows are gone the database no longer says who they were. Passing `--delete-auth-users` to step 2 instead does both in one run.

The prompt asks you to type `purge <host> <database rows> <roster rows> <auth users>`, plus `without-auth-staff-crosscheck` if that check was skipped. A run with 0 database rows (step 3) still asks for the Auth count.

**Auth user deletion is irreversible and is NOT in the pg_dump backup.** Only the database rows are.

The ids file is refused if it is malformed or was written for another host, and each id is ignored if it still has a manager row. Staff protection and the live-email check apply again. Failed deletions exit with code 2; rerun step 3 with the same file.

## Backup

`--execute` takes a scoped `pg_dump` first and aborts if it fails. On Windows, install the PostgreSQL client tools and point at the binary:

```powershell
$env:PG_DUMP = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe'
```

The file is written to `db/backups/` as `gold-seed-<time>.sql`. That name is shared with the seed scripts; db/backup.ts is not changed here because its pruning sorts by file name, and a new prefix would change which backups the other scripts delete. This script's backup is the newest file when you finish. To restore, see `db/RESTORE.md`.

## Checklist

1. Run the dry run. Read the table and the list of members: every row should be test data.
2. Read the protected list (masked). Every staff member who ever onboarded should be there. Read "Kept: has past-season roster history".
3. Make sure the Auth cross-check was not skipped.
4. Run step 2; confirm the dump exists under `db/backups/`; type the confirmation.
5. Refresh the cache. A script cannot call `updateTag`. Tags: `members`, `players`, `rosters`, `teams`, `schools`, `matches`, `people`, `leadership`. Save any admin row with its existing values, or purge the tags in the Vercel dashboard.
6. Run step 3 when satisfied.
