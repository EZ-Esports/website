# spec-027 — Schools roster editing

**Status:** Implemented on branch `feat/schools-roster-view` (not pushed, no PR yet). **Date:** 22 Oct 2026. **Scope:** `app/(admin)/admin/schools/[schoolId]/rosters/{page,actions}.ts(x)`, `app/components/admin/{SchoolRostersView,SchoolRosterEditors}.tsx`, `app/lib/school-roster-view.ts`, `app/lib/db/{school-rosters,roster-scope}.ts`, `app/(admin)/admin/league/actions.ts`. `RosterExplorer.tsx` deleted. No migration.

## Context & Motivation

[spec-024](spec-024-schools-roster-view.md) moved roster viewing into Schools but left staff with no UI to create or edit members, teams, rosters or players. Editing returns inside the same per-school page, and three loose ends are fixed alongside it.

## Design Decisions

- **Editing in place.** Per season block: "Register team" (game, then one of that game's seasons). Per column: "Add roster" (division fixed by the column; tournament games use `All`). Per roster card, always visible: "Add player", edit (rename, Varsity/JV) and delete (`ConfirmDeleteButton`). Per player: edit (role, IGN, plus the member's first/last name, Discord, class year) and remove. "Add player" offers an existing school member not already on the roster, or a new member (one save: the member and the player are created together). Text Save/Cancel, `RowIconButton`, `adminButton`, `AdminToast`; Varsity-left / JV-right and the phone picker are unchanged. Tournament games keep their list format.
- **Permissions.** Unchanged page gate: `MANAGE_ROSTERS` checked before any query; a `MANAGE_SCHOOLS`-only user is denied before anything renders, so edit controls never reach them. Each action re-checks `requirePermission(MANAGE_ROSTERS)` first. The Overview links and the Schools/Roster permission map are untouched.
- **Staff vs the lock.** Staff are exempt from the manager roster lock ([spec-020](spec-020-season-roster-lock.md)): no action checks `rosters_locked_at`. The season chip still shows it and a locked block says "Locked for managers. Staff edits here still go through."
- **School scoping.** The actions moved to `schools/[schoolId]/rosters/actions.ts` and every one takes `schoolId` and resolves each id through `app/lib/db/roster-scope.ts` (`teamInSchool`, `rosterInSchool`, `playerInSchool`, `memberInSchool`): a form for school A cannot touch school B's rows. `createPlayer` needs the roster (and, for an existing member, the member) in the school. `createTeam` still rejects a season of another game. Role and division are validated against explicit sets (no silent defaults); the old email/school edits are gone (`updatePlayer` only sets role, IGN, name, Discord, class year). Unused actions (`deleteMember`, `deleteTeam`, list reads) were dropped.
- **Divisions.** Allowed per game: `Varsity`+`JV` (JV split), `Varsity` only (Minecraft), `All` (tournament) via `allowedRosterDivisions`. Stored as `A`/`B`/`All` as the admin always wrote. A rename that leaves the division unchanged keeps the stored spelling (no `All` -> `A` churn).
- **Demographics.** Never queried or shown. The member pool selects only id, name, Discord, class year.
- **URL filters.** `?game=<slug>&division=varsity|jv&phone=jv`. `parseRosterFilters` (pure) validates server-side in `page.tsx` (unknown game/division/phone ignored); the client mirrors changes with `history.replaceState` (no navigation or refetch, like the Matches explorer). Defaults are omitted; `phone` is written only with division Both. Reload and copied links restore the view.
- **No-JV games render like the rest.** The `single` layout is gone. Every team-model game shows Varsity left and JV right; for a game without a JV split the JV side reads "No JV for this season" and has no "Add roster", including when a legacy JV roster exists in that column (the view gates the button on `block.jvSupported`; the server would refuse it). Games with a split keep "No JV team this season". A JV/B roster stored under a no-JV game now lands in the JV column instead of folding into Varsity. Tournament games are unchanged.
- **Stale paths.** `revalidatePath('/admin/roster')` removed everywhere. Roster actions revalidate `/admin/schools/[schoolId]/rosters` and `/admin/schools`; the league actions revalidate `/admin/schools` (layout). Every `updateTag(...)` call is kept.

## Failure modes / notes

- Adding a player and editing a player are each ONE server action and ONE database transaction (see "One-save player actions"); there is no partial-save state any more.
- Staff edits on a locked season are deliberate.

## Review follow-ups

- **Roster delete is blocked when matches exist.** `matches.home_roster_id` / `away_roster_id` are ON DELETE CASCADE, so a plain delete would have wiped every match the roster played, with scores and standings. `deleteRoster` (after permission and the school-scope check) counts matches where the roster is home or away and refuses with "This roster has N matches. Delete or reassign them under Matches & Standings first."; the DELETE itself carries a `NOT EXISTS` guard on matches so one created in between is not cascaded. A roster without matches is deleted and invalidates `rosters`, `players`, `teams` and `matches` (plus the path revalidation). The confirm dialog now says it removes the roster's players and that a roster with matches cannot be deleted. Audit: `deleteRoster` is the only staff delete in these actions that reaches matches; `deleteRosterMember` only removes a `players` row (nothing references players), `members` are `restrict`, and `deleteTeam` was dropped, so no other path cascades to matches.
- **Filter write-back keeps other params.** `mergeRosterFilterQuery(currentSearch, filters)` (pure, `app/lib/school-roster-view.ts`) starts from the current query string and sets or removes only `game`, `division` and `phone` (defaults stay out); every other param and the hash survive `replaceState`.
- Tests added: deleteRoster match protection (home/away count, no delete, permission first, school-scoped, `matches` tag) in `roster-edit-actions.test.ts`; `mergeRosterFilterQuery` cases in `school-roster-view.test.ts`. Still not verified in a browser.

## One-save player actions (22 Oct 2026)

The two-step client flows (edit: `updateRosterMember` then `updateMember`; add with a new member: `createMember` then `createRosterMember`) could leave half-saved state, so they are replaced by two server actions in `rosters/actions.ts`; `createMember`, `updateMember`, `createRosterMember` and `updateRosterMember` were deleted (no other caller).

- **`createPlayer(schoolId, formData)`** takes `rosterId`, `role`, `ign` and either `memberId` (existing member) or new-member fields (`firstName`, `lastName`, `discord`, `graduationYear`). All validation (role, names, class year) runs first; then one `db.transaction` resolves the roster (and existing member) through the school, inserts the member if new, and inserts the player. A duplicate member on the roster or a second captain aborts the transaction, so no orphan member remains.
- **`updatePlayer(schoolId, playerId, formData)`** validates first, then in one transaction resolves the player through the school, derives the member id from the player row (a posted `memberId` is ignored), checks that member belongs to the school, updates the player (role, IGN, `isCaptain` derived from role) and the member (name, Discord, class year).
- **Safeguards kept.** `requirePermission(MANAGE_ROSTERS)` first (before any lookup), `schoolId` UUID check, anti-IDOR resolution of every id (`roster-scope.ts` helpers now take an optional executor so the lookups run inside the transaction; `playerInSchool` also returns `memberId`), the captain-conflict message, `updateTag('members'|'players'|'rosters')` (`members` only when a member was created or edited) after commit only, `revalidatePath` of the school rosters page and `/admin/schools`. No lock check (staff exempt).
- **Failure messaging.** Every failure from these actions ends with "Nothing was saved." and nothing is committed, tags are not invalidated and paths are not revalidated. The client calls one action per submit and toasts its error.

## Tests


`app/(admin)/admin/schools/__tests__/roster-edit-actions.test.ts` (every action, including `createPlayer` with an existing and a new member and `updatePlayer`, requires MANAGE_ROSTERS before any lookup or write, an atomicity block where the transaction mock stages writes and drops them on a throw: second write fails => first not committed, tags and paths untouched, "Nothing was saved." in the error; validation before the transaction; member derived from the player row; refreshes the new paths, cross-school ids refused, JV refused on a no-JV game, no lock check, no `revalidatePath('/admin/roster')` anywhere under `app/`), `app/lib/__tests__/school-roster-view.test.ts` (no-JV shaping, JV not folded, URL parse/serialize, allowed divisions), `rosters-page.test.tsx` (gate, server-side filter validation, edit controls on a locked season, no-JV markup).

Not verified in a browser during implementation.
