# spec-065: Dev Can Re-invite Revoked Staff; "Ops" Role Rename

Branch `feat/staff-invite-dev-access` (unmerged). No migration.

## Problem
Revoking staff access writes a `staff_revocations` tombstone and deletes the member. `inviteStaff` refused any email with a tombstone for everyone, and the only way back was the Owner-run CLI `npm run db:seed-owner -- <email> --restore-revoked`. So in practice only an Owner (with shell access to production) could bring a revoked person back.

## Change
- `app/lib/roles.ts` adds `canReinviteRevokedStaff(isOwner, permissions)`. It is the single place that decides who may lift a tombstone: Owners and anyone holding the ADMINISTRATOR permission bit (the Dev role). It is keyed on the bit, **not the role name**: renaming a role neither grants nor removes it, and naming a role "Dev" grants nothing. A `MANAGE_ROLES` holder cannot mint ADMINISTRATOR because `canGrantPermissions` only lets an actor grant bits they hold. Trade-off: any other ADMINISTRATOR holder also qualifies, which is no extra power since ADMINISTRATOR already passes every permission check.
- `inviteStaff` (`app/(admin)/admin/team/actions.ts`) re-reads the actor's role names under the revocation advisory lock (it uses the fresh effective permissions from `getFreshActorAccess`). If the email is tombstoned and the actor qualifies, the tombstone is deleted and a `staff_revocation_cleared_by_invite` audit row is written in the same transaction as the new invite, so `acceptInvite` (same lock) sees either tombstone or invite. Others still get "Only an Owner or Dev can invite it again."
- Everything else about invites is unchanged and already identical for Dev and Owner: `MANAGE_ROLES` (Dev has ADMINISTRATOR), `canManageRole` hierarchy and `canGrantPermissions` subset checks. Dev still cannot grant an Owner role (spec-003, incident 18).
- Messages in `auth.ts` and `accept-invite/actions.ts` now say "Owner or Dev". The invite UI was never owner-gated (it uses `MANAGE_ROLES`), so no visibility change was needed.
- Tests: `canReinviteRevokedStaff` unit test, and three `inviteStaff` cases (Dev, Owner, plain staff) in `team/__tests__/actions.test.ts`.

## "ops" to "staff" rename
"Ops" is not an enum value or code constant. It is only the name of a row in the `roles` table (production: Ops, Dev, Owner, @everyone; see incident 18), edited in Admin > Team. Nothing in code keys on it. So the rename needs **no migration and no code change**; a manager with `MANAGE_ROLES` renames the role in the admin UI (that is a production data edit, deliberately not done here). In the repo only test fixtures used "Ops" and now use "Staff". "Comp Ops" (the competitive-operations team in onboarding copy and spec-011/033/035) is a different term and was left alone.
Collision notes: "staff" already names the whole admin identity layer (`staff_members`, `requireStaff`, `StaffRow`). A role called "Staff" does not collide technically: reserved role names are only `@everyone` and `owner` (`createRole`), and nothing resolves roles by the name "staff".
