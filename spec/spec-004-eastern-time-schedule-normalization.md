# spec-004: Eastern Time Schedule Normalization & Status Mapping

- **Status:** Shipped
- **PR:** #184 (#148)
- **Date:** 2026-09-25
- **Scope:** `app/lib/dates.ts`, `app/lib/schedule-calendar.ts`, `app/lib/db/match-page.ts`, `app/(marketing)/[game]/schedule/page.tsx`, `app/(marketing)/[game]/schedule/CalendarSchedule.tsx`, `app/components/admin/MatchScheduleForm.tsx`, `app/components/admin/AdminMatchExplorer.tsx`, `db/seed-gold.ts`

## Context & Motivation

All official EZ-Esports league competition takes place in New York City and is scheduled in Eastern Time (America/New_York). Previously, schedule management and calendar views suffered from timezone displacement and status inconsistencies (Audit Issue #148):
1. **Timezone Shift on Admin Kickoff Input & Display**: Admin datetime-local inputs were parsed using standard browser/server local time, causing match times to shift by 3–5 hours depending on whether the server or client evaluated the string. Additionally, the admin explorer displayed kickoff dates in browser-local time without timezone markers.
2. **Missing Timezone Disclosures**: Schedule cards and match fixture views showed ambiguous times without indicating "ET", confusing players and viewers in other time zones.
3. **Calendar Month/Day Shifting**: In `CalendarSchedule.tsx`, calculating dates using browser-local date constructors caused late-evening Eastern matches (e.g. 8:00 PM ET / 00:00 UTC) to appear on the wrong day depending on the viewer's local timezone.
4. **Incorrect Forfeit, Cancelled & Tie Status Handling**: Forfeited and cancelled matches were sometimes categorized as "upcoming", and tied match scores were incorrectly labeled as losses (`L`) rather than draws (`D`).

## Design Decisions

1. **Canonical Eastern Time Parsing & Boundary Protection (`parseEastern`)**:
   - Implemented and exported `parseEastern(value: string): Date` in `app/lib/dates.ts`.
   - Accurately converts `YYYY-MM-DDTHH:mm` wall-clock strings into exact UTC `Date` instants taking into account Eastern Daylight Time (EDT, UTC-4) vs Eastern Standard Time (EST, UTC-5).
   - Validates that field values survive `Date.UTC` roundtrip, rejecting rollover/out-of-range dates (e.g., Feb 30, hour 25).
   - Validates post-relaxation offset consistency, rejecting non-existent wall times during spring-forward DST transitions (e.g., 2:30 AM on March 8, 2026).
   - Resolves ambiguous fall-back times (e.g. 1:30 AM on Nov 1, 2026) to the first (EDT) occurrence.
   - Applied in `MatchScheduleForm.tsx` (admin kickoff input), `createMatch`, and `db/seed-gold.ts`.

2. **Explicit "ET" Labeling & Admin Consistency**:
   - Updated `formatNY()` in `app/lib/dates.ts` to append an explicit `ET` suffix to formatted times.
   - Added user-facing notice: `"All match times are Eastern Time (ET)"` prominently on public schedule pages and the calendar view.
   - Updated `AdminMatchExplorer.tsx` to format kickoff timestamps using `formatNY(date, 'date-short')` and `formatNY(date, 'time')`, eliminating discrepancies between admin inputs and listings.

3. **Timezone-Anchored Calendar Grid & Extracted Pure Logic**:
   - Extracted `getInitialDate`, `getInitialYearMonth`, and `getMonthGrid` into pure helper module `app/lib/schedule-calendar.ts`.
   - Anchored calendar initial month focus, day grid calculations, and day groupings in `CalendarSchedule.tsx` strictly to America/New_York using `Date.UTC` arithmetic.
   - Prevents matches from jumping dates when viewed from Pacific, Central, or international timezones.

4. **Match Status & Result Normalization**:
   - Forfeited matches (`status === 'forfeit'`) are canonicalized as completed matches (never upcoming).
   - Cancelled matches (`status === 'cancelled'`) are mapped to `'Cancelled'` and filtered out of public calendar view.
   - Added tie support: when home and away scores are equal, results map to `'D'` (Draw) rather than `'L'` (Loss).
   - Special handling for `0-0` forfeit results to render appropriately as completed draws.
   - Extracted `toScheduleCalendarItem` DTO in `app/lib/db/match-page.ts`.
   - Eradicated redundant `m.status === 'Forfeit'` condition boilerplate across `CalendarSchedule.tsx`.

## Invariants & Boundaries

- All match kickoffs stored in the database are UTC instants corresponding to the scheduled America/New_York wall time.
- Displayed match kickoffs in public views and admin tables must explicitly indicate or align with the `ET` timezone.
- Forfeits must always be treated as completed games in schedule filters and standings calculations.
- Cancelled matches must never fall through to Upcoming status.

## Verification

- Dates unit test suite: `npx vitest run app/lib/__tests__/dates.test.ts` (14 tests covering bounds validation, DST boundaries, EST/EDT transitions).
- Schedule status test suite: `npx vitest run app/lib/__tests__/schedule-status.test.ts` (13 tests covering forfeits, ties, cancelled statuses, and calendar item transformation).
- TypeScript compilation: `npx tsc --noEmit`
- Linter: `npm run lint`
- Production build: `npm run build`
