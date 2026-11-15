# spec-061: School managers can no longer create rosters

- **Spec ID:** spec-061
- **Title:** Remove the Create Roster controls from the manager portal for school managers
- **Status:** Implemented on branch `manager-no-create-roster`, unmerged. No migration.
- **Date:** 2026-11-06
- **Scope:** `app/(portal)/portal/SchoolPortalClient.tsx`, `app/(portal)/portal/components/RostersSection.tsx`, `app/(portal)/portal/tour/__tests__/anchors.test.tsx`, new `components/__tests__/rosters-section-create-button.test.tsx`.
- **Builds on:** [spec-015](spec-015-manager-portal-guided-tour.md) (tour anchors), [spec-028](spec-028-manager-past-season-view-only.md) (view-only seasons), [spec-020](spec-020-season-roster-lock.md) (roster lock).

## Rule

Rosters are set up by EZ Esports staff. A school manager does not see a Create Roster control in the portal.

- `SchoolPortalClient` passes `canCreateRoster={context.isStaffAdmin}` to `RostersSection`. `RostersSection` defaults the prop to `false`, so any caller that forgets it hides the controls.
- With the flag false, the header Create Roster button and the empty-state Create First Roster button are not rendered. The empty state says "Rosters are set up by EZ Esports staff. Contact an admin to request one."
- Staff admins (`isStaffAdmin`, `scopes === null`) keep both buttons and the `CreateRosterModal` path. The modal is not removed.

## Tour

The `create-roster` tour step is kept in `tour/steps.ts`. Its anchor is absent for managers, and `resolveTourSteps` already drops steps whose anchor is missing, so managers never see that step. The anchors test now treats `create-roster` as staff only: a manager render must omit it, and a staff render must contain it exactly once.

## Server-side guard

`createSchoolRoster` (`app/lib/onboarding/portal-actions.ts`) throws `Only EZ Esports staff can create rosters` for any caller that is not `isStaffAdmin`, right after `assertManagerForSchoolGame` and before any read or write. This is the enforcement; the hidden button is only the UI. Manager refusals take precedence over the season-lock and view-only checks for this action, because the guard runs first.

## Tests

- `components/__tests__/rosters-section-create-button.test.tsx`: manager (default and `false`) hides both buttons; staff (`true`) shows both.
- `tour/__tests__/anchors.test.tsx`: manager anchors and staff-only `create-roster` anchor.
- `app/lib/onboarding/__tests__/milestone3-portal-actions.test.ts`: manager create is refused (locked or unlocked, no write); the manager-create success cases now run as a staff admin; the lock and view-only matrices exclude `createSchoolRoster` for managers.
