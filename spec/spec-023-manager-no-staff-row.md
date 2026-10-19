# spec-023 — School managers do not get a staff row

**Status:** Implemented on branch `worktree-fix-233-manager-staff-row`, PR TBD (issue #233). **Date:** 19 Oct 2026. **Scope:** `app/lib/auth.ts`, `app/lib/manager-identity.ts`, `app/(admin)/admin/layout.tsx`, `app/(marketing)/login/actions.ts`, `app/lib/supabase/middleware.ts`. No migration, no data change.

## Context & Motivation

`ensureStaffMember()` self-heals a missing `staff_members` row for any authenticated identity, a repair for interrupted staff invites. A school manager who signed in on `/login` or opened `/admin` was therefore enrolled in the staff directory as a side effect (a role-less row), polluting the Team page and making "is this person staff?" unanswerable.

## Design Decisions

- **Narrow fix.** The self-heal insert is skipped for an active school manager (`school_managers.user_id` with `is_active`, or `school_managers.member_id` of the member whose email matches, the same two links the portal login accepts). The check runs inside the existing transaction, after the revocation tombstone and the by-id / by-email checks and before the insert, so the advisory lock and tombstone logic are unchanged. Existing staff rows are never modified, so someone who is both staff and manager keeps working. Non-managers still self-heal.
- **Return contract.** `ensureStaffMember` returns `string | null`; null means "active manager, no staff row". `getStaff()` returns null in that case (it was already null for unauthenticated callers), so every `requireStaff` / `requirePermission` path fails closed with no code change.
- **Layout.** When `getStaff()` is null, `/admin` layout redirects to `/portal` if `isPortalOnlyManager()` (claims + the same manager lookup), otherwise to `/login`. Nobody is signed out and it is not treated as `StaffSetupError`.
- **Login action.** After `signInWithPassword`, `resolvePostLoginDestination()` rejects a user with no staff row who is an active manager: it signs them out and returns an error pointing to the School Manager Portal (the staff and manager logins are separate). Everyone else goes to `/admin`. If the lookup throws, it falls through to `/admin`, whose layout blocks row-less managers. Imported lazily so the DB client loads only after valid credentials.
- **Middleware.** Unchanged behaviour: any signed-in `/login` visit redirects to `/admin`. Middleware only uses `getClaims()` and deliberately avoids database access; the layout bounces managers to `/portal` (one extra redirect, no loop since `/portal` does not redirect back).
- **Access is not widened.** Role-less rows never granted portal staff-admin (ADMINISTRATOR only, spec-019); this change only stops creating them for managers. Existing manager staff rows already in production are left alone.

## Tests

`app/lib/__tests__/staff-manager-row.test.ts` (no insert for a manager by user id or by member email; existing staff row untouched), `staff-revocation.test.ts` (non-manager still self-heals), `app/(admin)/admin/__tests__/layout.test.tsx` (manager to `/portal`, anonymous to `/login`), `app/(marketing)/login/__tests__/actions.test.ts` (manager rejected and signed out, staff to `/admin`).
