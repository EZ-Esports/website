# spec-058: League Setup season hub (per-game tabs, season page)

- **Status:** Implemented on branch `worktree-agent-a1034cb896548c04e`; no migration; not run against any database; not viewed in a browser.
- **Date:** 2026-11-04
- **Scope:** `app/(admin)/admin/league/` (`page.tsx`, `LeagueSetupClient.tsx`, new `[seasonId]/`, new `season-schools-actions.ts`), `app/lib/season-schools.ts`, `app/lib/db/season-setup.ts`, `app/lib/admin-season-filters.ts`, `app/lib/admin-nav.ts`, `SchoolManagersModal` + `ProvisionInviteTab`, `matches/page.tsx` (back link only).

## Context

League moderation was spread over League Setup (lock / publish buttons on every season row), Schools & Rosters (teams and rosters), the school managers dialog (invite links) and Matches. Staff had to remember which page held which switch, and school managers had to create their own Varsity / JV rosters.

## Design decisions

- **Per-game tabs.** League Setup is one `AdminFilterTabs` strip, one tab per game (`?game=<slug>`, unknown or missing falls back to the first game) plus **Manage games** (`?view=games`), which holds the former Games section (add, edit, delete). Inside a game the seasons list keeps spec-025's Active / Inactive / All filter, now counted per game, and the add-season form has the game preselected. `resolveLeagueView`, `leagueHref`, `seasonDetailHref` are pure helpers in `admin-season-filters.ts`; the "season moved tab" hint and the Matches back arrow keep the game.
- **Season rows are navigation, not controls.** The name and an "Open season" chip open `/admin/league/[seasonId]`. Lock and publish are no longer buttons on rows; their state stays visible as chips. Edit and delete stay on the row. "View matches" moved into the season page.
- **Season page** (`/admin/league/[seasonId]`, gated on `MANAGE_LEAGUE` like League Setup, breadcrumb title "Season", back arrow to the season's game tab and status filter):
  - *Season controls:* Lock / unlock rosters and Publish / unpublish, same server actions and confirm dialogs as before (`lockSeasonRosters`, `publishSeasonOutcomes`, ...), unchanged.
  - *Schools:* every school with a team in the season, each a disclosure showing its rosters and players (display name and role only; read from `getSeasonSetupData`, raw and uncached). A school missing a division shows a chip and a **Create missing rosters** button.
  - *Add school:* a picker of live (not soft-deleted) schools without a team in this season, and **Add school**.
  - *Manager invites:* per school, opens the existing `SchoolManagersModal` with `seasonName` set, so the Provision tab issues the link for this season (`academicYear` = season name, fixed and not editable) through the unchanged `generateManagerInvite` / `manager_invites` flow (14-day single-use token, revoke list). Drawn only for staff holding `MANAGE_SCHOOLS` (the action checks again) and only when the season name is `YYYY-YY`. Game scope stays "All games" by default, as before.
  - *Edit rosters:* link to the school's existing roster editor (`/admin/schools/[id]/rosters?game=`), shown with `MANAGE_ROSTERS`.
- **Add school to season** (`addSchoolToSeason`, `season-schools-actions.ts`, `MANAGE_LEAGUE`, zod-validated ids). One transaction: season + game, school (not soft-deleted), a per-(season, school) advisory lock, find-or-create the `teams` row (unique school + game + season), then create the rosters `planSchoolRosters` says are missing. Same shape the manager portal and Generate season write: team per (school, game, season), rosters named `Varsity` / `JV`, stored `A` / `B` (`storedDivision`).
- **Which rosters.** The divisions the game allows (`allowedRosterDivisions`): Varsity + JV for Valorant and League of Legends, Varsity only for Minecraft, a single `All` roster for the tournament games (TFT, osu!, TETR.IO). A division that already has a roster under any name or stored spelling (`A` / `Varsity`) counts as present, so a manager-built roster is never duplicated; a name collision on another division gets `Varsity 2`, mirroring Generate season. This is the idempotency rule: calling the action again creates nothing, and on a team missing only JV it adds only JV.
- **Races.** The advisory lock serializes two staff adding the same school; the unique indexes (`teams_school_game_season_unique_idx`, `rosters_team_name_unique_idx`) remain the backstop, and a 23505 maps to a "refresh and check" message.
- **Staff, not managers, so the season lock does not apply** (spec-020): a locked season can still be populated.
- **Cache.** Tags `teams`, `rosters` are updated, plus `revalidatePath` for the season page, `/admin/schools` (layout), `/admin/matches`, `/portal`, `/`. Nothing is refreshed when nothing was created.
- **Consolidation.** Nothing was removed. League Setup's nav description names the new scope; Schools & Rosters keeps school CRUD, crests, and the all-seasons roster editor (linked from each school here); Matches keeps scheduling, results and Generate season (linked via "View matches"); Onboarding Form and Standings Archive are untouched.

## Tests

`app/lib/__tests__/season-schools.test.ts` (planner: divisions per game, idempotency, any-name division match, name collision); `app/(admin)/admin/league/__tests__/add-school-to-season.test.ts` (permission, validation, team + Varsity/JV in one transaction, idempotent repeat writes nothing and refreshes nothing, repairs a missing division, no duplicate team, missing season/school, 23505 mapping); `league-season-ui.test.tsx` (game tabs, only the selected game's seasons, no lock/publish buttons on rows, Manage games, add school, repair, lock and publish from the season page, invites scoped to the season and hidden without permission); `admin-season-filters.test.ts` gained the tab helpers; `delete-confirm.test.tsx` renders the Manage games view for game deletion.

## Not verified

Not exercised in a browser or against a database: the admin needs sign-in and `.env` is production. The transaction, advisory lock and inserts run only against mocks; the Disclosure rows, tab strip scrolling and the season page layout were not viewed. `npm run build` was not run.
