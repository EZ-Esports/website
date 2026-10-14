# spec-015: School Manager Portal Guided Tour

- **Spec ID:** spec-015
- **Title:** School Manager Portal Guided Tour
- **Status:** In Review (design agreed with Isaac, 2026-10-14; implemented on `feat/issue-225-manager-portal-tour`, PR #227 merged 2026-10-14; migration `0048` applied to production 2026-10-14)
- **PR / Commit:** TBD
- **Date:** 2026-10-14
- **Scope:** `/portal` only (school managers). Issue: EZ-Esports/website#225. The staff portal (`/admin`) is out of scope.

## Context & Motivation

Issue #225 asks for in-product onboarding instead of written docs: a short sequence of anchored callouts, not a help center or a video. New school managers (coaches) land on a single dense page (`SchoolPortalClient.tsx`) with an invite generator, an approvals queue, a roster builder and an invite history. They need to learn the path a new coach actually walks: pick the game, generate a player invite, approve the submission, place the player on a roster.

`app/lib/onboarding/` is the player-onboarding backend (invites, approvals, enrollment, spec-011). It holds no tour logic. The tour is new.

## Design Decisions

### Audience and shape

- **Audience:** school managers only.
- **One tour definition, split into named sections.** The tour is a single ordered list of steps grouped into sections (working names: *Pick a game*, *Invite players*, *Approvals*, *Rosters*). The first-run tour, the full replay and the per-feature replay all use this same definition and the same popover component. Copy lives next to the definition in code. No CMS, no markdown docs.
- **First run:** a school manager entering the portal for the first time gets the full tour automatically.
- **Tutorial button (always present afterwards):** opens a small menu with *Full tour* plus one entry per section. Choosing a section plays only that section's slice, starting at its first step and ending at its last, then closes.

### Skip

- Each step shows Back and Next. Skip is a **quiet secondary action**, visually weaker than Next.
- Skip (and Esc) opens a confirmation: it says the tutorial can be replayed any time from the Tutorial button, with *Keep going* and *Skip tour* choices.
- Skipping counts as dismissal. The first-run tour does not return.

### Dismissal storage (database flag)

- A nullable column `school_managers.tour_completed_at` (timestamp, no default). Each person has their own manager rows, so one manager finishing the tour never hides it from another manager at the same school. The read is **any row of the session user set**, so switching schools, or a new school or academic-year row for the same person, never replays it. (A separate per-user table was considered and rejected by the user in favour of the existing table.)
- Set by a server action when the tour **ends** (finished or skipped), not when it starts. A manager who closes the tab at step 2 sees it again next time.
- **Existing managers are not backfilled.** The column is NULL for every current row, so every current manager sees the tour once on their next visit. This was a deliberate decision.
- Replays from the Tutorial button never touch the flag.
- **Fail safe:** `hasCompletedPortalTour` catches lookup errors, logs them and returns "completed" (tour hidden, portal still renders), so a missing table or a database blip can never take `/portal` down. A failed `completePortalTour` write is swallowed on the client. The client also remembers, per account, that the first run ended, so a remount before the server flag propagates cannot restart it.
- **Staff admins without a manager row** (viewing `/portal` through the admin override): the read returns "completed" (no tour) and the write is a no-op, so nothing throws and the tour does not replay on every visit. Staff admins who also hold a manager row follow the normal path.
- The migration is applied to production, since `.env` points at production. Per `CLAUDE.md` it needs explicit confirmation from the user before it runs, even though `assertSeedTargetAllowed()` would permit it.

### Anchors

- Targets are stable `data-tour="<name>"` attributes on the real elements. The portal has none today, so each is added fresh.
- Steps never use CSS selectors, class names or visible text.
- A **test** fails if any anchor a tour step refers to is missing from the rendered portal, so a deleted attribute surfaces in CI and not in front of a new coach.
- Steps whose target does not exist for the current viewer are omitted from the tour, not shown as dead controls.

### Empty states

A brand-new school has no pending submissions and likely no rosters, so row-level controls do not exist yet.

- Approvals and Rosters steps anchor to the **section containers** (`PendingApprovalsCard`, `RostersSection`), which always render.
- The roster step is preceded by (or falls back to) the *Create roster* button when the school has no rosters.
- Steps that live inside a modal (e.g. `EnrollPlayerModal`) either anchor to the modal's trigger button, or declare a prerequisite the tour performs (open the modal, wait for the anchor to mount). Default to the trigger button.

### Interaction and accessibility

- React Aria for the popover. Visible focus, focus returns to the Tutorial button when the tour closes.
- Keyboard: arrows move between steps, Esc opens the skip confirmation.
- `prefers-reduced-motion`: no travel animation between steps.
- The popover tracks the target on scroll and resize, sits above the sticky `PortalShell` header (`z-40`), and scrolls targets into view clear of it.
- Works at phone width (the two-column grid stacks) and on a short laptop viewport.
- A third-party tour library is not used unless it is justified against the above.

## Invariants & Boundaries

- One tour definition; section replays are slices of it, never separate copies.
- The dismissal flag is per account and is written only when the tour ends.
- A broken or missing anchor must never trap the manager: the tour drops that step, and Skip/Esc always work.
- No written onboarding doc is part of this work.
- Non-goals: the staff portal tour, the player join wizard (`/join/...`), analytics on tour completion.

## Implementation notes

- **Flag storage.** Nullable `school_managers.tour_completed_at timestamp` (no default, no backfill; RLS unchanged). Migration `db/migrations/0048_school_manager_tour_completed.sql`, hand-written and journaled because `drizzle-kit generate` currently aborts on a pre-existing snapshot collision (`0041_snapshot.json` and `0042_snapshot.json` share a parent); migrations 0043-0047 were also hand-written.
- **Read/write.** `hasCompletedPortalTour(userId)` in `manager-auth.ts` (server only, called from `page.tsx`): true if any of the user's `school_managers` rows has the column set, true when the user has no rows, true on error. `completePortalTour()` in `tour-actions.ts` (server action, user from the session only) sets `tour_completed_at = now()` on all of that user's rows where it is still null. Only the automatic first-run tour calls it; replays do not.
- **Definition.** `app/(portal)/portal/tour/steps.ts`: `TOUR_SECTIONS` (Pick a game, Invite players, Approvals, Rosters; 6 steps), `CLOSING_STEP` ("Replay this anytime", anchored to the Tutorial button), `TOUR_ANCHORS`, and `resolveTourSteps(selection, hasTarget)`, which serves the full tour (the 6 section steps plus the closing step, 7 in all) and each section slice, and drops steps whose target is missing. The closing step is appended for the full tour only: it is not in `TOUR_SECTIONS`, so section replays end on that section's last real step and the Tutorial menu still lists just the four sections.
- **Anchors.** `game-tabs`, `invite-card`, `invite-history`, `approvals`, `rosters`, `create-roster`, `tutorial-button`, all on always-rendered elements. The Tutorial button is where the full tour ends, telling the manager they can replay it or one feature later.
- **UI.** `tour/PortalTour.tsx` renders the Tutorial `MenuTrigger` (placed in `PortalHeader` via an `actions` slot) and a non-modal RAC `Popover` (`isNonModal`; its `onOpenChange` is a no-op so scroll-close never dismisses it) anchored with `triggerRef` to the target, plus a pointer-events-none spotlight ring. Non-modal because a modal popover locks page scroll, which stopped the tour scrolling targets into view; the popover is absolutely positioned so it scrolls with its target. Esc and arrow keys are handled by a document-level listener (active only during a tour, ignoring arrows inside form fields) so they keep working after the manager clicks into the page. Esc toggles the skip confirmation (Esc again = Keep going); Skip opens the same confirmation; arrows step; focus returns to the Tutorial button on end (deferred 50ms, otherwise the popover's own focus restore wins). Scrolling to a target is instant (no travel animation, which also satisfies reduced motion); the spotlight transition is `motion-safe` only.

## Verification

Automated (all DB-free; no migration was applied and no script touched `.env`):

- `tour/__tests__/anchors.test.tsx`: renders `SchoolPortalClient` as a brand-new school (no invites, submissions or rosters) and fails if any anchor in `TOUR_ANCHORS` is missing or if a step's anchor does not appear exactly once.
- `tour/__tests__/steps.test.ts`: unique ids, anchors declared, full-tour order, section slices end at their boundary, missing-target steps omitted, unknown section is empty.
- `app/lib/onboarding/__tests__/tour-actions.test.ts`: unauthenticated rejected without writing; updates `school_managers.tour_completed_at`; the WHERE clause is the session user id and `tour_completed_at IS NULL` only.
- `app/lib/onboarding/__tests__/tour-status.test.ts`: any stamped row is completed, none is not, no rows (staff admin) is completed, a throwing lookup hides the tour.
- `app/lib/db/__tests__/school-manager-tour-migration.test.ts`: single nullable column, no default or backfill, journal order.
- `npx tsc --noEmit` clean; `npm run lint` 0 errors (1 pre-existing `<img>` warning); `npm test` 1294 pass, 1 fail (the known Windows path-separator `db/__tests__/backup.test.ts`).

Still to do manually (needs a non-production database; not run, see Open Items):

- Fresh manager account auto-starts the tour; finishing or skipping sets the flag and it does not return; Tutorial offers the full tour and each section; section replay ends at the section boundary; closing the tab at step 2 shows it again.
- Keyboard (arrows, Esc), visible focus, reduced motion, phone width, short laptop viewport, school with no rosters and no submissions.

## Open Items

- Done 2026-10-14: migration `0048` (adds `school_managers.tour_completed_at`) applied to production with the user's confirmation, after merging #227 (merge first, migrate right after; the brief window is the one described below). Still to do: the manual checks above. Until applied, the status lookup fails safe and the tour is simply hidden. **Deploy order matters.** Before `0048` is applied, the onboarding submission-approval path (`app/lib/onboarding/wizard/submission-pipeline.ts`, a bare select plus insert on `schoolManagers`) and the admin add/remove manager flows (`drizzle-onboarding-repository.ts`: `findManagerById`, `createOrUpdateSchoolManager`, `removeSchoolManager`) all throw `column tour_completed_at does not exist`; only `hasCompletedPortalTour` fails safe. Apply `0048` **before or with** the deploy.
- Repair `drizzle-kit generate` (snapshot collision at 0041/0042) so future migrations can be generated rather than hand-written.

- Final section names and step copy are first-draft and live in `tour/steps.ts`; wording can change without touching logic.
- Resolved: no step lives inside a modal; the roster steps anchor to `RostersSection` and its always-present *Create Roster* button.
