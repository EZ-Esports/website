# spec-003: Staff Role Lock-Then-Re-Read Concurrency Protection

- **Status:** Shipped
- **PR:** #181 (#156)
- **Date:** 2026-09-24
- **Scope:** `app/(admin)/admin/team/actions.ts`, `app/(admin)/admin/team/__tests__/actions.test.ts`

## Context & Motivation

During the September 2026 Codebase Quality Audit (finding AUTH-1 / #156), a Time-of-Check to Time-of-Use (TOCTOU) vulnerability was identified in the staff role management system (`/admin/team`). 

Previously, authorization and role hierarchy checks (such as verifying whether an actor outranked a target staff member or had authority to assign specific permissions) were performed using cached or pre-transaction state before acquiring transactional locks. If an actor was concurrently demoted, stripped of `MANAGE_ROLES`, or if a target user was promoted to Owner before the database write committed, the stale authorization check would permit unauthorized privilege escalations or wrongful revocations.

## Design Decisions

1. **Transactional Advisory Lock Acquisition**:
   - Every staff role mutation acquires `pg_advisory_xact_lock(STAFF_REVOCATION_LOCK_KEY)` immediately upon starting its database transaction (`tx`).
   - Serializes concurrent role modifications, invite creations, role edits, and revocations.

2. **Fresh Actor State Under Lock (`getFreshActorAccess`)**:
   - Inside the transaction and under lock, the actor's current live state is re-fetched:
     - Confirms the actor is still an active `staffMembers` record (fails closed with `ActionError('UNAUTHORIZED')` if tombstoned).
     - Resolves assigned roles and `@everyone` baseline permissions via `calculateEffectiveStaffAccess()`.
     - Validates that the actor retains `Permissions.MANAGE_ROLES` at execution time.
     - Derives the actor's live `highestRolePosition` and `isOwner` status.

3. **Fresh Target & Role Re-Reads Under Lock**:
   - `updateUserRoles`: Re-reads target user roles (`getUserRolesInfo(targetUserId, tx)`) and proposed roles from `schema.roles` under lock. Fails with `STAFF_HIERARCHY_CHANGED` if the target was concurrently promoted to or above the actor's position, or if the actor attempts to grant permissions exceeding their own.
   - `updateRole`: Re-reads the target role from `schema.roles` inside `tx`. Fails if the role was moved at or above the actor's rank or if the actor lacks permissions to grant the role's modified permission set.
   - `revokeInvite`: Re-reads the invite and its associated roles from `schema.staffInviteRoles` under lock to prevent revoking invites containing roles higher than the actor's current position.
   - `revokeStaff`: Re-reads the target member's live roles under lock before executing revocation and tombstoning.
   - `inviteStaff`: Re-reads requested initial roles under lock to enforce that newly created invites cannot grant roles at or above the actor's rank.

4. **Rigorous Concurrency Testing**:
   - Unit tests in `app/(admin)/admin/team/__tests__/actions.test.ts` simulate concurrent race conditions:
     - Actor demoted before lock.
     - Target member promoted to Owner before lock.
     - Actor concurrently losing `MANAGE_ROLES`.
     - Target role repositioned higher before lock.
     - All paths assert rejection with `ActionError` and proper lock acquisition.

## Invariants & Boundaries

- No role assignment, role update, invite revocation, or staff revocation may proceed without holding `pg_advisory_xact_lock(STAFF_REVOCATION_LOCK_KEY)`.
- Authorization checks must use live data queried inside the locked transaction; pre-transaction session claims are untrusted for hierarchy checks.
- Non-owner staff members can never modify, assign, or revoke roles with a `position` less than or equal to their own highest position (lower position number = higher hierarchy).

## Verification

- Vitest unit tests: `npx vitest run app/(admin)/admin/team/__tests__/actions.test.ts` (12 concurrency tests)
- Full test suite: `npm test`
- Type checking: `npx tsc --noEmit`
- Linter: `npm run lint`
- Production build: `npm run build`
