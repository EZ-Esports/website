# spec-045: Player invites carry a season; roster enrollment is season-scoped

- **Spec ID:** spec-045
- **Title:** `player_invites.season_id`, season-scoped invite lists and review, and one season-eligibility rule for portal enrollment
- **Status:** Implemented on branch `feat/253-invite-season-scope`, PR TBD. Issue #253. Migration `0056` is written but NOT applied to production (needs the owner's go-ahead and a backup, and must be applied before the code deploys: every `db.select().from(schema.playerInvites)` selects the new column).
- **Date:** 2026-10-28
- **Scope:** `app/lib/db/schema.ts`, `db/migrations/0056_player_invites_season.sql` (+ journal), `app/lib/onboarding/portal-actions.ts`, `app/lib/db/onboarding.ts` (`ensurePlayerSubmission`), `wizard/submission-pipeline.ts`, `app/lib/season-name.ts`, `EnrollPlayerModal.tsx`.
- **Builds on:** [spec-019](spec-019-manager-portal-season-scope.md) / [spec-026](spec-026-manager-season-by-name.md) (a manager's season is resolved by name), [spec-028](spec-028-manager-past-season-view-only.md) (inactive = view-only), [spec-020](spec-020-season-roster-lock.md) (lock). Closes the "invites have no season column" gap those specs list. #224 (spec-018) landed first, so `manager_invites` is separate and untouched.

## Part 1: invites carry a season

- **Column:** nullable `player_invites.season_id` -> `seasons.id`, `ON DELETE SET NULL` (an invite outlives its season but then behaves like a legacy seasonless one), indexed.
- **Stamped at creation:** `createPlayerInvite` stores the season the invite is issued for: a manager's resolved season (necessarily active, since creation is refused on an inactive one), or for a staff admin the game's active season. A staff admin creating an invite for a game with no active season is refused (`NO_ACTIVE_SEASON_ERROR`): such an invite could never be shown to or approved by a manager. `ensurePlayerSubmission` (spec-043, manager also plays) stamps the season of the game named like the manager's chosen affiliation, else the game's active season, else null; its "live application already exists" dedupe is now per season, so a returning student can re-apply each season.
- **Reads:** `getSchoolInvites` / `getPendingSubmissions` add `inviteSeasonCondition(scopes)`: for each game the manager has a scope for, `game_id = scope.game AND season_id = scope.season`. The scope season is the manager's resolved season (spec-026), which is the active season whenever the manager can edit, and the named (inactive) season when they are viewing one read-only. This is deliberately "the manager's season", not "the game's active season": it keeps spec-028's single-season visibility (a manager viewing 2025-26 sees 2025-26 invites). Staff admins (`scopes === null`) get no condition.
- **Review:** `reviewPlayerInvite` (approve AND reject) refuses a non-staff manager unless `invite.season_id === managerSeason.id` ("belongs to a different season than your manager affiliation"). Staff admins review anything. Earlier guards (school, game, view-only) still run first.
- **Legacy null-season rule (documented decision):** a null season is treated as a PAST season for managers: hidden from both lists and refused in review. Staff admins still see and review them. The migration backfills what it can so the in-flight queue does not vanish on deploy.

### Migration `0056_player_invites_season` (hand-written, like 0047-0055; snapshots stop at 0042)

Adds the column, FK (guarded by `duplicate_object`) and index, then three idempotent backfills that only touch rows still NULL, in this order:

1. **Accepted** invites whose student is on exactly one team of the invite's school and game: that team's season.
2. **Open** invites (`submitted`, or `pending` and not yet expired): the game's active season, when the game has exactly one. A lapsed pending link is dead and is not placed by this rule.
3. **Any remaining** invite of a game that has only ever had one season: that season.

Everything else (for example a rejected or expired invite of a multi-season game, or an accepted one whose student sits on teams of two seasons) stays NULL and is therefore invisible to managers. No `created_at` cut-off is used (rejected as unsound in spec-019), and the multi-season ambiguity is intentionally not guessed. Tested against an in-memory PGlite built from all migrations (`player-invites-season-migration.test.ts`): each rule, unplaceable rows, idempotence, `SET NULL`.

## Part 2: roster enrollment scope (the precise rule)

Enrollment paths found: manager `enrollPlayerToRoster`; manager/staff `reviewPlayerInvite` approve (default roster or explicit `rosterId`); `movePlayerToRoster` (same team only, so same season by construction; no new rule); staff `createPlayer` / `moveRosterMember` in `app/(admin)/admin/schools/[schoolId]/rosters/actions.ts`.

A player may be put on roster R (team T: school X, game G, season S) only if ALL hold:

1. **Roster/season access (existing, reused):** `assertManagerForRoster` -> the manager's resolved season equals `T.season_id`, it is active (spec-028) and unlocked (spec-020). Staff admins are exempt from those three, so they can still correct a past or locked season.
2. **School:** the member's `school_id` equals `T.school_id` (existing check; the invite's school too).
3. **Invite approval only (new, applies to staff too):** an explicit `rosterId` must be in the invite's game and, when the invite has a season, in the invite's season. Without a `rosterId` the default roster is the one of the invite's own season, and only if that is the season being managed (the manager's, or the game's active season for staff); otherwise approval is refused with a returned error asking for an explicit roster. A seasonless legacy invite (staff only) always needs an explicit roster.
4. **Student eligibility for the season (new, `isEligibleForSeason` in `season-name.ts`):** members have no season column, so the only season-bound fact about a student is `members.graduation_year`. A student whose class year is before the year S ends (`seasonEndYear`: `2026-27` -> 2027) had already graduated when the season began and is refused ("(class of 2026) graduated before the 2026-27 season"). A null class year or a non-`YYYY-YY` season name is never excluded: the rule only fires on data that proves ineligibility. Applied in `enrollPlayerToRoster` and the approve path of `reviewPlayerInvite`, to managers AND staff admins using the portal. The refusal is RETURNED (`{ success: false, error }`, spec-034); for an invite it stays pending.

Staff `createPlayer` (admin roster editor) enforces rule 4 too (there is no staff carve-out): for an existing member the stored class year, for a new member the class year typed in the form, against the roster's season (`seasonNameForTeam`). The refusal says to correct the class year on the member first (managers are told to ask a league admin). `moveRosterMember` stays within one team, hence one season. Staff `updatePlayer` can still change a class year, which is how a wrong one is corrected.

**UI:** `EnrollPlayerModal` (portal) and `AddPlayerPanel` (staff) filter their pickers with the same `isEligibleForSeason`, and each says how many students are hidden and why. The server rule is authoritative.

## Invariants

- Invite season visibility is `season_id = the manager's resolved season for that game`; never re-derive it from `created_at`.
- Any new code that creates a `player_invites` row must set `season_id`.
- The eligibility rule lives only in `season-name.ts` (`seasonEndYear`, `isEligibleForSeason`); the UI and server both call it.

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests: `milestone3-portal-actions.test.ts` section 13 (stamp on create for manager and staff, no active season refused, lists with match / past-season / no-season invites for a manager and for staff, review approve and reject refused for past and no-season invites, staff may review them, explicit roster of another season or game refused, graduated-student refusals for approve and direct enroll, eligible and null-class-year students enrolled); existing sections 3, 4, 8-12 updated for seasoned invites and class-of-2027 fixtures; `roster-edit-actions.test.ts` (staff `createPlayer` eligibility), a staff past-season invite approved without `rosterId`, `ensurePlayerSubmission` stamping; `season-name.test.ts` (eligibility helpers); `app/lib/db/__tests__/player-invites-season-migration.test.ts` (PGlite). Not verified: the portal UI in a browser; `npm run build`.

## Open

- Apply `0056` to production (owner's go-ahead and a backup first; it must precede the deploy).
- The class-year rule is the only member-vs-season signal available; replace `isEligibleForSeason` if per-season eligibility is ever stored.
- Staff creation of an invite for a game with no active season is now refused; pre-season invites would need an explicit season picker.
