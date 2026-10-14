# spec-015: School Manager Portal Guided Tour

- **Spec ID:** spec-015
- **Title:** School Manager Portal Guided Tour
- **Status:** In Review (design agreed with Isaac, 2026-10-14; implemented on `feat/issue-225-manager-portal-tour`, migration `0048` not yet applied)
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

- A per-**account** flag on the school manager record (not per school, because managers can manage several schools and switching schools must not replay the tour). Exact table and column are decided at implementation against `app/lib/db/schema.ts` and `app/lib/onboarding/manager-auth.ts`.
- Set by a server action when the tour **ends** (finished or skipped), not when it starts. A manager who closes the tab at step 2 sees it again next time.
- **Existing managers are not backfilled.** The new column defaults to "not seen", so every current manager sees the tour once on their next visit. This was a deliberate decision.
- Replays from the Tutorial button never touch the flag.
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

- **Flag storage.** New table `manager_portal_tours` (`user_id uuid PRIMARY KEY`, `completed_at timestamp NOT NULL DEFAULT now()`, RLS enabled, no policies, like `school_managers`), keyed by the Supabase auth user id. A table rather than a column on `school_managers` because that table has one row per school per academic year: a column would replay the tour for a manager assigned a new school or year. Row exists = tour ended. Migration `db/migrations/0048_manager_portal_tours.sql`, hand-written and journaled because `drizzle-kit generate` currently aborts on a pre-existing snapshot collision (`0041_snapshot.json` and `0042_snapshot.json` share a parent); migrations 0043-0047 were also hand-written. It creates the table empty: no backfill.
- **Read/write.** `hasCompletedPortalTour(userId)` in `manager-auth.ts` (server only, called from `page.tsx`); `completePortalTour()` in `tour-actions.ts` (server action, derives the user from the session, `ON CONFLICT DO NOTHING`). Only the automatic first-run tour calls it; replays do not.
- **Definition.** `app/(portal)/portal/tour/steps.ts`: `TOUR_SECTIONS` (Pick a game, Invite players, Approvals, Rosters; 6 steps), `TOUR_ANCHORS`, and `resolveTourSteps(selection, hasTarget)`, which serves the full tour and each section slice and drops steps whose target is missing.
- **Anchors.** `game-tabs`, `invite-card`, `invite-history`, `approvals`, `rosters`, `create-roster`, all on always-rendered elements.
- **UI.** `tour/PortalTour.tsx` renders the Tutorial `MenuTrigger` (placed in `PortalHeader` via an `actions` slot) and a modal RAC `Popover` anchored with `triggerRef` to the target, plus a pointer-events-none spotlight ring. Modal rather than non-modal because react-aria closes non-modal popovers on any scroll. Esc toggles the skip confirmation (Esc again = Keep going); Skip opens the same confirmation; arrows step; focus returns to the Tutorial button on end. Scrolling to a target is instant (no travel animation, which also satisfies reduced motion); the spotlight transition is `motion-safe` only.

## Verification

Automated (all DB-free; no migration was applied and no script touched `.env`):

- `tour/__tests__/anchors.test.tsx`: renders `SchoolPortalClient` as a brand-new school (no invites, submissions or rosters) and fails if any anchor in `TOUR_ANCHORS` is missing or if a step's anchor does not appear exactly once.
- `tour/__tests__/steps.test.ts`: unique ids, anchors declared, full-tour order, section slices end at their boundary, missing-target steps omitted, unknown section is empty.
- `app/lib/onboarding/__tests__/tour-actions.test.ts`: unauthenticated rejected without writing, writes the session user id, idempotent `ON CONFLICT DO NOTHING`.
- `app/lib/db/__tests__/manager-portal-tours-migration.test.ts`: table shape, RLS, no backfill insert, journal order.
- `npx tsc --noEmit` clean; `npm run lint` 0 errors (1 pre-existing `<img>` warning); `npm test` 1294 pass, 1 fail (the known Windows path-separator `db/__tests__/backup.test.ts`).

Still to do manually (needs a non-production database; not run, see Open Items):

- Fresh manager account auto-starts the tour; finishing or skipping sets the flag and it does not return; Tutorial offers the full tour and each section; section replay ends at the section boundary; closing the tab at step 2 shows it again.
- Keyboard (arrows, Esc), visible focus, reduced motion, phone width, short laptop viewport, school with no rosters and no submissions.

## Open Items

- Apply migration `0048` to production (needs explicit user confirmation per `CLAUDE.md`), then run the manual checks above. Until applied, `/portal` will error on the flag lookup.
- Repair `drizzle-kit generate` (snapshot collision at 0041/0042) so future migrations can be generated rather than hand-written.

- Final section names and step copy are first-draft and live in `tour/steps.ts`; wording can change without touching logic.
- Resolved: no step lives inside a modal; the roster steps anchor to `RostersSection` and its always-present *Create Roster* button.
