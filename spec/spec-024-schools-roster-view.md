# spec-024 — Schools roster view

**Status:** Implemented on branch `feat/schools-roster-view` (not pushed, no PR yet). **Date:** 22 Oct 2026. **Scope:** `app/(admin)/admin/schools/[schoolId]/rosters/page.tsx`, `app/components/admin/SchoolRostersView.tsx`, `app/components/admin/SchoolRow.tsx`, `app/lib/school-roster-view.ts` (pure shaping), `app/lib/db/school-rosters.ts` (queries), `app/lib/admin-nav.ts`, `app/lib/staff-access.ts`, `next.config.ts`. No migration.

## Context & Motivation

Staff viewed (and edited) rosters on a league-wide Teams & Rosters page (`/admin/roster`, `RosterExplorer`): school -> team -> roster -> player drill-down with season/school/division filters. Staff think school-first, so roster work moved into Schools: open a school, see all of its rosters. Editing was restored there in [spec-027](spec-027-schools-roster-editing.md).

## Design Decisions

- **Route and entry point.** Each Schools row has a visible "View rosters" button (only rendered for staff holding `MANAGE_ROSTERS`) linking to `/admin/schools/[schoolId]/rosters`. The breadcrumb resolves the nested route to "School Rosters" under Schools & Rosters (the sidebar item was renamed from "Schools") (`NESTED_PAGE_TITLES`).
- **Permissions.** The page requires `MANAGE_ROSTERS` (checked first, before params or any query; `getStaffWithPermission(ADMIN_ROSTER_VIEW_PERMISSION)`); Schools keeps `MANAGE_SCHOOLS`. `MANAGE_SCHOOLS` alone gets `PermissionDenied` with no roster data loaded. `/admin/roster` left `ADMIN_SECTION_PERMISSIONS` (it is no longer a section), so the permission is exported as `ADMIN_ROSTER_VIEW_PERMISSION` and still counts in `hasAnyManagementPermission` (a roster-only role is still staff).
- **Layout.** Blocks are one per team (school x game x season), ordered newest season first (`YYYY-YY` start year, unparseable names last, game name tie-break). Active seasons start expanded, others collapsed; if nothing is active the newest block opens. Filters: game (native select), Varsity / JV / Both (segmented, `aria-pressed`). Within a block Varsity is left and JV right. A season-level "Rosters locked" / "Rosters open" chip shows `seasons.rosters_locked_at` (spec-020).
- **Division mapping** reuses `toHubDivision` (`A`/`Varsity` -> Varsity, `B`/`JV` -> JV, `All` -> Varsity), so the view agrees with the public hub. A column holds a list of rosters.
- **Games without JV** (`hasJvSplit: false`, i.e. Minecraft): originally one full-width Varsity column; superseded by [spec-027](spec-027-schools-roster-editing.md), which renders them like every other game with a "No JV for this season" JV placeholder. Games with a JV split but no JV (or Varsity) team that season show a dashed "No JV team this season" placeholder so columns stay aligned.
- **Phones.** Below `md` the two columns never sit side by side: with "Both" selected a second picker ("Show on this screen") chooses Varsity or JV, and the other column gets `max-md:hidden`. Pure CSS, no viewport sniffing.
- **Tournament-model games** (TFT, osu!, TETR.IO; `competitionModel: 'tournament'`) keep their storage unchanged (division `All`) and render as the old page did: the team's rosters listed with name and division chip, no Varsity/JV columns; the division filter does not apply.
- **Read-only (superseded by spec-027).** The first cut had no edit controls; spec-027 added them. Cards show display name/IGN, role, Discord and graduation year only (the fields the old explorer and portal already showed). `student_demographics` is never queried; it stays under `VIEW_STUDENT_DEMOGRAPHICS`.
- **Data.** `getSchoolRosterBlocks` is a raw (uncached) admin read: teams+games+seasons, rosters, players+members, three queries, shaped by the pure `buildSeasonBlocks`. Nothing is wrapped in `unstable_cache`.
- **Removal.** `app/(admin)/admin/roster/page.tsx` and the sidebar item are deleted; `next.config.ts` 308s `/admin/roster` to `/admin/schools`.

## Gap: the only staff edit surface was removed (closed)

`RosterExplorer` (mounted only by the deleted page) was the one staff UI for creating/editing/deleting members, teams, rosters and roster players. This cut kept its server actions but mounted nothing. [spec-027](spec-027-schools-roster-editing.md) closes the gap: the editing controls live in the per-school view, the actions moved next to it and are school-scoped, and `RosterExplorer` was deleted.

## Tests

`app/lib/__tests__/school-roster-view.test.ts` (season ordering, Varsity/JV placement, no-JV game, missing-JV-this-season, tournament layout, lock status, default expansion, game filter), `app/(admin)/admin/schools/__tests__/rosters-page.test.tsx` (MANAGE_SCHOOLS without MANAGE_ROSTERS denied before any query, anonymous denied, bad id 404s, markup: collapsed older season, lock chip, placeholder, phone picker, edit controls shown for MANAGE_ROSTERS; later extended by spec-027), `app/lib/__tests__/next-config.test.ts` (`/admin/roster` redirect), `protected-pages.test.ts`, `admin-nav.test.ts`.
