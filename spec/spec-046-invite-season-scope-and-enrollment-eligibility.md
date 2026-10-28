# spec-046: Player invites carry a season; roster enrollment is season-scoped

- **Spec ID:** spec-046
- **Title:** `player_invites.season_id`, season-scoped invite lists and review, and an onboarded-for-the-season rule for manager enrollment
- **Status:** Implemented on branch `feat/253-invite-season-scope`, PR TBD. Issue #253. Migration `0056` is written but NOT applied to production (needs the owner's go-ahead and a backup, and must be applied before the code deploys: every `db.select().from(schema.playerInvites)` selects the new column).
- **Date:** 2026-10-28
- **Scope:** `app/lib/db/schema.ts`, `db/migrations/0056_player_invites_season.sql` (+ journal), `app/lib/onboarding/portal-actions.ts`, `app/lib/db/onboarding.ts` (`ensurePlayerSubmission`), `wizard/submission-pipeline.ts`, `EnrollPlayerModal.tsx`.
- **Builds on:** [spec-019](spec-019-manager-portal-season-scope.md) / [spec-026](spec-026-manager-season-by-name.md) (a manager's season is resolved by name), [spec-028](spec-028-manager-past-season-view-only.md) (inactive = view-only), [spec-020](spec-020-season-roster-lock.md) (lock). Closes the "invites have no season column" gap those specs list. #224 (spec-018) landed first, so `manager_invites` is separate and untouched.

## Part 1: invites carry a season

- **Column:** nullable `player_invites.season_id` -> `seasons.id`, `ON DELETE SET NULL` (an invite outlives its season but then behaves like a legacy seasonless one), indexed.
- **Stamped at creation:** `createPlayerInvite` stores the season the invite is issued for: a manager's resolved season (necessarily active, since creation is refused on an inactive one), or for a staff admin the game's active season. A staff admin creating an invite for a game with no active season is refused (`NO_ACTIVE_SEASON_ERROR`): such an invite could never be shown to or approved by a manager. `ensurePlayerSubmission` (spec-043, manager also plays) stamps the manager's OWN season of the game: it runs the same `resolveManagerSeason` the portal uses (now in `app/lib/onboarding/manager-season.ts`, re-exported by `manager-auth.ts`) over the manager's active `school_managers` rows at the school (including the row provisioned moments earlier in the same transaction), else the game's active season, else null; its "live application already exists" dedupe is now per season, so a returning student can re-apply each season.
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

Enrollment paths found: manager/staff-in-portal `enrollPlayerToRoster`; `movePlayerToRoster` (same team only, so same season by construction; no new rule); staff `createPlayer` / `moveRosterMember` in `app/(admin)/admin/schools/[schoolId]/rosters/actions.ts`. `reviewPlayerInvite` is NOT an enrollment path any more (see "Approval only accepts").

A player may be put on roster R (team T: school X, game G, season S) only if ALL hold:

1. **Roster/season access (existing, reused):** `assertManagerForRoster` -> the manager's resolved season equals `T.season_id`, it is active (spec-028) and unlocked (spec-020). Staff admins are exempt from those three, so they can still correct a past or locked season.
2. **School:** the member's `school_id` equals `T.school_id` (existing check; the invite's school too).
3. **One tier per game (existing, unchanged):** a student already on a sibling roster (same team = same school, game and season, for example Varsity vs JV) is refused with "Use Move"; either roster is open to a student who is on neither. See the rule statement below.
4. **Season comes from the invite only (decision):** a student's season is determined solely by the accepted application the school manager created for the roster's game and season (see below). The student's school year / class year is NEVER used to decide eligibility: there is no graduation-year rule anywhere (portal, Enroll pool or staff tools). An earlier draft of this spec had such a rule; it was removed.

Staff `createPlayer` / `moveRosterMember` (admin roster editor) have no season rule beyond their existing guards (school-bound, size caps, one tier per game): staff are the override channel. `moveRosterMember` stays within one team, hence one season. Staff `updatePlayer` still edits a member's class year as plain data.

**UI:** `EnrollPlayerModal` (portal) applies the onboarded-for-this-season filter described below and says how many students are hidden and why. Students already on a roster of the game and season stay listed, annotated. The staff `AddPlayerPanel` is unchanged. The server rule is authoritative.

## Approval only accepts; enrolment is a separate step

- `reviewPlayerInvite` approve no longer takes a `rosterId` or role and never chooses, defaults or writes a roster; it sets the invite to `accepted` (and reject sets `rejected`). The result carries no `enrolledPlayer` / `targetRosterId`. Manager guards are unchanged: school and game coverage, the inactive-season view-only refusal (spec-028) and the season-ownership refusal (`invite.season_id` must be the manager's resolved season, spec-046 Part 1). Staff admins may accept any invite. The old "choose a roster explicitly" staff refusals and the default-roster lookup are gone because nothing is rostered.
- **Lock:** accepting touches no roster, so the season roster lock (spec-020) no longer applies to approving; it still applies to every enrolment. This supersedes spec-020's "invite approval refused while locked" row. Reject was always allowed.
- **Rostering an accepted student:** the manager uses Enroll on any roster of the game and season (Varsity or JV, or any extra roster). The Enroll pool (`getSchoolPlayerPool`) is every member of the school, so an accepted-but-unrostered student (empty `enrolledRosters`) is listed, minus students not onboarded for that roster's season (but always including students already on a roster of this game and season, shown annotated and unaffected by the application rule). Enrolment goes through `enrollPlayerToRoster`: manager season access, active, unlocked, same school, size caps, captain rule, one tier per game, class-year eligibility.
- **A manager can enroll a student only if they were onboarded for that season (`app/lib/onboarding/enroll-eligibility.ts`, `hasAcceptedApplicationForSeason`).** For a roster of game G and season S at school X, the student must have an `accepted` `player_invites` row for G at X whose `season_id` is S. Everything else is refused: no application at all (archive-imported or staff-created members), applications only for other seasons, seasonless rows, and `submitted` / `pending` / `rejected` / `expired` rows. So a player from a past season is NOT carried into a new season; they are onboarded again (new invite, student form, Approve) for it. This is the user's explicit decision and replaces the earlier "block only unaccepted rows" rule. Staff admins are exempt (override), and sibling-roster, size and lock rules are unchanged. Class year plays no part. `enrollPlayerToRoster` enforces it server-side (returned error "<name> has not been onboarded for <season>. Send them an invite and approve it first."). `getSchoolPlayerPool` gives each entry `invites: {id, gameId, seasonId, status}[]` (no PII) for a manager and `null` for a staff admin (null = unrestricted); the Enroll modal lists only students with an accepted application for the roster's game and season and its hint says so; after Approve the client flips that application to accepted locally (a newly seen student is added with the accepted row, using the pending submission's `seasonId`). Staff `createPlayer` and its picker (`options.members`) do not use this rule. Not affected: `movePlayerToRoster` (the student is already enrolled for the season on the same team), a removed student re-enrolled in the same season (their accepted row remains unless the removal cleanup deleted the whole student record), and manager-also-plays applications (an ordinary submitted row that becomes accepted on Approve). **Legacy data:** accepted invites whose season the migration `0056` backfill could not determine stay `NULL`, so those students count as not onboarded for any season and need to be onboarded again or enrolled by staff.
- **Portal UI:** the Pending Approvals card shows only Reject and Approve (no roster or role pickers); after approving it says to use Enroll on a roster. Tour copy updated.
- **One tier per game (rule to confirm with the owner):** a student can be on EITHER Varsity OR JV of a given game and season, never both at once. Enrolling a student who is already on a sibling roster is refused with "<name> is already on <roster>. Use Move to put them on <target>." and Move (`movePlayerToRoster`) relocates them in place. A student on neither can be enrolled into any roster. Across different games, or across seasons, a student can be on a different tier.

## Invariants

- Invite season visibility is `season_id = the manager's resolved season for that game`; never re-derive it from `created_at`.
- Any new code that creates a `player_invites` row must set `season_id`.
- Enrollment eligibility lives only in `enroll-eligibility.ts` (`hasAcceptedApplicationForSeason`); the UI and server both call it. Class year is never an input.

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests (approval-only and accepted-student enrolment replace the old approve-and-enroll cases in sections 4, 8-12 and `onboarding-e2e.test.ts`): `milestone3-portal-actions.test.ts` section 13 (stamp on create for manager and staff, no active season refused, lists with match / past-season / no-season invites for a manager and for staff, review approve and reject refused for past and no-season invites, staff may review them, explicit roster of another season or game refused, onboarded students enrolled whatever their class year); existing sections 3, 4, 8-12 updated for seasoned invites and seasoned fixtures; staff accepting past-season and seasonless invites, the accepted student appearing in the pool, `ensurePlayerSubmission` resolving the manager's season through `resolveManagerSeason`, the join wizard prefilling the invite name (`PlayerOnboardingWizard.test.tsx`); `app/lib/db/__tests__/player-invites-season-migration.test.ts` (PGlite). Not verified: the portal UI in a browser; `npm run build`.

## Open

- Apply `0056` to production (owner's go-ahead and a backup first; it must precede the deploy).
- Staff creation of an invite for a game with no active season is now refused; pre-season invites would need an explicit season picker.
