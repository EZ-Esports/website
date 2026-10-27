# Purge onboarding test data

`db/purge-onboarding-test-data.ts` deletes the student and school-manager onboarding records that were created while testing, and optionally the managers' Supabase Auth logins. It is a one-off script, not a migration, so nobody applies it by accident. The owner runs it; CI never does.

`.env` points at live production. The script's gate, backup and confirmation exist to stop accidents; none of them replaces reading the dry run first.

## What it deletes

In this order, inside one transaction: `onboarding_consents`, `student_demographics`, `player_identities`, `players` (roster rows of deleted members only), `player_invites`, `manager_invites`, `school_managers`, `members`.

A `members` row is deleted only when it has an onboarding footprint (an invite, manager row, consent, demographics row or identity) and no gold-archive `member_key`. Archive members keep their row and roster history, but their onboarding records are still deleted. Members with no footprint (admin-created) are never touched.

## What it protects

Never deleted, together with their member row, manager rows, invites, consents, demographics, identities, roster rows and Auth user:

- any user in `staff_members`, `user_roles`, `staff_revocations`, `staff_audit_logs`, `people.user_id`, or who invited staff;
- any member linked from `staff_members.member_id`, `people.member_id` or `leadership.member_id`;
- any member whose email (case-insensitive) matches a staff member, staff invite, revoked staff, accepted staff application or `people` row;
- any member with the same name as a staff member or `people` row (ambiguous, so kept);
- any invite whose saved draft mentions a staff email.

Protection spreads: if one row of a person is protected, every row that ties them to another person is too. An Auth user is also protected when its live email matches staff or cannot be read.

Kept untouched: schools, games, seasons, teams, rosters, matches, standings, sponsors, news, gallery, leadership/`people`, staff applications, roles. Reschedule requests keep their `requested_by_user_id` values; they have no foreign key to Auth.

## Commands

```bash
# 1. Dry run (default): prints the plan, the masked protected list, mutates nothing
npm run db:purge:onboarding-test-data

# 2. Database only
SEED_ALLOW_REMOTE=<exact-db-hostname> npm run db:purge:onboarding-test-data -- --execute

# 3. Database and manager logins
SEED_ALLOW_REMOTE=<exact-db-hostname> npm run db:purge:onboarding-test-data -- --execute --delete-auth-users
```

`--delete-auth-users` needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the environment and is rejected without `--execute`. Auth users are deleted one at a time after the database commit. Failed ids are listed masked, and the full list is saved to `db/backups/purge-onboarding-auth-ids-<time>.json` (gitignored); retry with `--execute --delete-auth-users --auth-user-ids-file=<that file>`. Staff protection is applied again on a retry.

## Checklist

1. Run the dry run. Read the table: every number should match what you expect to be test data.
2. Read the protected list (masked: first letter and domain). Every staff member who ever onboarded should be there.
3. Check the "archive members kept" count and the Auth line.
4. Run with `--execute`. The script takes a scoped `pg_dump` first and aborts if it fails; confirm the file exists under `db/backups/`.
5. Type the confirmation it asks for (`purge <host> <row count>`).
6. The transaction re-plans under table locks and rolls back if anything differs from what you confirmed.
7. Refresh the cache. A script cannot call `updateTag`. Tags: `members`, `players`, `rosters`, `teams`, `schools`, `matches`, `people`, `leadership`. Save any admin row with its existing values, or purge the tags from the Vercel dashboard.
8. Restore, if needed: see `db/RESTORE.md`.
