# spec-016: Portal tour placement and roster card layout

**Issue:** #229. **Branch:** `fix/229-portal-tour-roster-ui`. **Status:** In Review.

## Problems

1. The "Rosters" tour step used a RAC `Popover` anchored below `RostersSection`, a target taller than the viewport. A popover can only flip or shift within the viewport; when the target fills the screen there is nowhere to go, so the card landed off-screen and its content had to be scrolled inside the popup. Phones had the same risk on every step.
2. `RosterCard` put the title block, the "Valorant • Division JV" badge and four action buttons in one non-wrapping row. In a two-up grid (xl) or on an empty roster card the badge ran under "Enroll Player".
3. "Run Roster Gate" read like a write. The button only evaluates the 5-point check.

## Decisions

- **Tour card is self-positioned, not a Popover.** `tour/placement.ts` holds pure geometry (`computePanelPlacement`, `computeScrollDelta`); `PortalTour.tsx` renders a `position: fixed` card and recomputes from the live target rect on scroll and resize. Order of preference on desktop: below the target, above it, then docked to the bottom-right of the viewport (the fallback that rescues targets taller than the screen). Below 640px the card is always a bottom sheet. The page is scrolled first so the target (and, when it fits, the card) is clear of the sticky header; on phones the scroll reserves the sheet's height. The card is transparent (not `visibility: hidden`, which would block `autoFocus`) until measured. `max-h` plus `overflow-y-auto` stays only as a safety net on tiny viewports. The Tutorial menu is still a RAC `Popover`.
- **Roster card header wraps.** The title block is `min-w-0 flex-1 basis-56`, the badge `shrink-0 whitespace-nowrap`, the action row `flex-wrap`; the card is `min-w-0`. Nothing shares a line unless it fits, at any card width. The players table has no horizontal scroll: it is `w-full`, headers and the Server cell wrap, and IGN/Discord use `break-all`.
- **Rename.** "Run Roster Gate" becomes "Check Eligibility", and "Evaluating..." becomes "Checking...". The tour copy for the Rosters step names the button. The internal `onCheckRosterGate` prop and the "5-Point Tournament Validation Gate" result heading are unchanged.
- **Portal-wide audit.** Grid columns in `SchoolPortalClient` got `min-w-0`; section headers wrap; invite name inputs stack under 420px; approval detail tiles stack and break long handles; selects and action buttons get 44px targets on touch widths; the three modals scroll inside `max-h-[calc(100dvh-2rem)]` and wrap their footers; game tabs keep 44px height and `shrink-0`.

## Verification

- `tour/__tests__/placement.test.ts`: below/above/docked at 1920x1080 including a target taller than the screen; bottom sheet and scroll reserve at 375x812.
- Rendered a temporary mock of the portal (removed afterwards) in the dev server with the Tutorial replay: at 1920x1080 every step's card sat fully inside the viewport with no inner scroll; at the narrowest width the browser pane allows (529px wide, mobile branch) every card was docked, buttons inside the viewport, no page horizontal overflow. Roster card header measured at card widths 260-900px: no overlapping or overflowing children.
- Not verified: a true 375px-wide viewport (the preview pane clamps emulation to 529px wide), and the real authenticated `/portal` page.

## First-run welcome modal

The automatic first-run tour no longer starts abruptly. `tour/WelcomeModal.tsx` (RAC `ModalOverlay`) greets the manager by school name with a staggered entrance (`welcome-*` keyframes in `globals.css`, switched off outright under `prefers-reduced-motion`). **Start the tour** closes it and begins the full tour after the 200ms exit; **Maybe later** (also Escape / backdrop) records the first run as ended via `completePortalTour`, so it does not reappear on every load; the Tutorial menu still replays the tour. Replays from the menu never show the welcome. Not yet checked in a browser at the time of writing.

## Join form and pending-approval polish

- Pending approvals now show `Graduating: Class of <year>` (the year the student entered) instead of the broken `2026th Grade` (`portal-actions.ts`, `PendingApprovalsCard.tsx`).
- The join wizard no longer pre-selects answers: graduation/academic year, ping, gaming hours and internet reliability start on **Choose an option** (gender and the two yes/no selects reworded to match). Graduation year stays required via the existing validation; the survey fields stay optional and submit as empty.
- Required fields use `join/.../components/RequiredMark.tsx`: a larger danger-coloured asterisk plus screen-reader "(required)".
