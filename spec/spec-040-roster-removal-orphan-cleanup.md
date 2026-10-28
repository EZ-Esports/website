# spec-040: Roster removal deletes the student's leftover records

- **Spec ID:** spec-040
- **Title:** Removing a player from a roster also deletes the student's onboarding record when nothing else needs it
- **Status:** Implemented on branch `fix/roster-removal-orphan-cleanup` (not merged at the time of writing). No migration, no schema change.
- **PR / Commit:** pending
- **Date:** 2026-10-28
- **Scope:** `app/lib/db/roster-removal.ts` (one shared helper), staff `deleteRosterMember` and `deleteRoster`, manager `removePlayerFromRoster`, the confirmation wording (`app/lib/roster-removal-copy.ts`), the manager portal's new remove confirmation, and a small wording audit of other delete buttons.

## Context & Motivation

Both removal paths used to delete only the `players` row. The student's `members` row and onboarding leftovers (invite, consent, identities, demographics) stayed behind, and those rows kept colliding with new onboarding (spent invites, a Discord id still bound to a person who is no longer on a roster, a member found by email with stale data). Owner's rule: "just delete their roster data, not all historical data from them. At this time there shouldn't be any [historical data] anyway."

The request mentioned "onboarding content flags"; they do not exist in this repo (no table, no `app/lib/db/content-flags.ts`); nothing to clean there. The tolerant-of-missing-table pattern used here follows `app/lib/db/thumbnail-columns.ts` (42703) extended to 42P01.

## Reference graph (from `app/lib/db/schema.ts` and `db/migrations/`)

Nothing has a foreign key to `players.id`; the only table that points at `players` data is the roster link itself. Every foreign key to `members.id`:

| Table | Column | onDelete | Decision |
| --- | --- | --- | --- |
| `players` | `member_id` | restrict | The removed row is deleted first. Any OTHER row (any roster, team, season) = keep the member (`other_roster`). The restrict is also a last-line guard on the final member delete. |
| `onboarding_consents` | `member_id` | cascade | Deleted explicitly (count reported). Onboarding leftover. |
| `student_demographics` | `member_id` | cascade | Deleted explicitly. Onboarding leftover (PII). |
| `player_identities` | `member_id` | cascade | Deleted explicitly. Frees the Discord/Riot id (`player_identities_provider_user_idx` is unique). Riot ids are first read to look for match history. |
| `player_invites` | `member_id` | set null | **Deleted**, not reset (see Invites). |
| `manager_invites` | `member_id` | set null | Read only. Any row = the member is/was a school manager: keep (`school_manager`). Never deleted here. |
| `school_managers` | `member_id` | set null | Read only. Any row (active or not) = keep (`school_manager`). |
| `staff_members` | `member_id` | set null | Read only. Linked by member id, or by a case-insensitive email match to the member = keep (`staff`). |
| `leadership` | `member_id` | set null | Read only. Any row = keep (`profile`). Set null would silently orphan the term record. |
| `people` | `member_id` | set null | Read only. By member id or email = keep (`profile`). |
| `members.member_key` | (column) | | Non-null = gold-archive member, keep (`archive_member`), same rule as spec-036. |

Soft evidence of match history (no FK, so read by identity and by what the removed roster played). Any hit keeps the member (`match_history`):

| Source | Check |
| --- | --- |
| `matches` (home or away = the removed roster) | any score set, or status live/completed/forfeit |
| `match_games` joined to `matches` on that roster | any stored game |
| `season_standings` | `player_name` equals the member's full name, or `player_name`/`player_ign` equals the in-game name or a Riot id (case-insensitive) |
| `matches.mvp` | text contains the full name, in-game name or Riot id |
| `valorant_game_players` | `name#tag` or `name` equals the in-game name or a Riot id |

Name matches are deliberately loose: a false positive keeps a record that could have been deleted; it never deletes one that should stay. Tables that carry no member link and are therefore untouched: `match_reschedule_requests/options` (school and Auth user ids), `match_result_submissions/attempts` (Auth user ids), `tournament_matches` (schools), `season_standings` (schools), `staff_*`, `user_roles`, sponsors, news, gallery, applications. A member with a `staff_audit_logs` trail is a staff member (covered by `staff_members`).

## Design Decisions

- **One helper, three callers.** `removePlayerFromRosterTx(tx, { playerId, rosterId })` deletes the player (`WHERE id AND roster_id ... RETURNING`, so a stale or moved row matches nothing and the caller is told) and then `cleanupOrphanMember`. Callers: staff `deleteRosterMember`, manager `removePlayerFromRoster`, and staff `deleteRoster` (calls `cleanupOrphanMember` per distinct member after deleting the roster, same transaction; the roster is already refused when it has matches, so there is no roster history to protect). The manager `deleteSchoolRoster` only deletes empty rosters.
- **Same transaction, own savepoint.** The player delete is in the caller's transaction. The member cleanup runs in a nested transaction (savepoint). Any unexpected error rolls back the cleanup alone, logs only the Postgres code, and returns `keptReason: 'cleanup_error'`; the roster removal itself still commits. Fail closed: when in doubt, the member stays.
- **Race safety.** The cleanup starts with `SELECT ... FROM members WHERE id = ... FOR UPDATE`. An enrol that inserts a `players` row takes a key-share lock on the member through the foreign key, so it waits for us (or we wait for it and then see its row). The `restrict` foreign key on `players` is a second guard.
- **Missing tables.** Every optional read or delete runs in its own savepoint; a 42P01 (no table) or 42703 (no column) counts as "no rows". Any other error propagates to the cleanup savepoint and keeps the member. This change needs no migration.
- **Invites: deleted, not reset.** A `player_invites` row is single-use; once accepted its token hash must never work again, and resetting it to pending would revive a link the departed student still holds. Deleting also removes the only row whose `member_id` would otherwise point at nothing. A re-invite creates a new row and a new token; onboarding looks the person up by email, finds no member and creates a fresh one. When the member is KEPT the invite is kept too (it is the audit link for the kept record). `onboarding_consents.invite_id` has no foreign key; the consents go with the member.
- **Result shape.** Staff `deleteRosterMember` returns `{ success, studentRecord: 'deleted' | 'kept' | 'unchanged', message }`; the manager action returns the same (`RemovePlayerFromRosterResult`). `message` is the sentence from `removalNotice` ("... was removed from the roster. Their student record was kept because they have match history."). The UI shows it as the toast (staff) or the roster notice (portal). `unchanged` = the row was already gone.
- **Cache tags.** `rosters` and `players` always; `members` only when a member was deleted (manager adds `teams` as before; staff roster delete keeps `rosters, players, teams, matches` and adds `members`). `refreshSchoolRosters`, the permission checks, `playerInSchool` school scoping and the post-commit `notifyRosterMembershipChanged` are unchanged.
- **Portal player pool.** After a removal the manager's local pool drops the person entirely when the member was deleted, and otherwise drops only that person's enrolment on the roster (the old code stripped the roster from every pool entry).

## Confirmations

`rosterRemovalConfirmMessage` (client-safe, one source for staff and portal) states: the roster spot is permanently deleted; if the person is on no other roster and has no match history their student record (profile, onboarding answers, signed consent form, linked Discord and Riot accounts, used invite) is deleted too and they would have to be invited and onboarded again; staff, school managers and anyone with match history keep their record; it cannot be undone. The manager portal previously removed a player on one click with no confirmation (and used `alert()` on failure); it now uses `ConfirmActionDialog` through `useConfirmAction` (spec-037, portal appearance, danger tone) and shows failures in the dialog.

### Delete-button audit (wording only; all already had in-app confirms except the portal remove)

| Button | Change |
| --- | --- |
| Portal roster card: remove player | Had no confirmation; now spec-037 dialog with the copy above |
| Staff roster: remove player | "They stay in the school's member list" was false; replaced with the copy above |
| Staff roster: delete roster | Now says players on no other roster lose their student record too |
| League Setup: delete game | Said "linked seasons"; now lists seasons, teams, roster spots, matches, results, standings; students and schools kept |
| League Setup: delete season | Now lists teams, rosters, standings; matches block it |
| Schools: delete school | It is a soft delete that also removes logo and images from storage; text now says so and that teams, rosters and students stay in the database |
| Matches: delete match | Adds that its result, game data and reschedule requests go with it |
| Applications: remove (school and staff) | "Are you sure...?" replaced by: hidden from the list, cannot be restored from the admin (soft delete) |
| Managers: remove manager access | Adds that the student record and roster spots are not deleted (it deactivates the manager) |
| Careers: delete opening | Inline "Delete?" now says it is hidden from the site and cannot be restored from the admin |
| Unchanged, copy already accurate | news, sponsors, gallery image, standings row, leadership term, staff access revoke, staff invite cancel, manager invite revoke, role delete, portal empty-roster delete |

## Invariants & Boundaries

- A member is deleted only if: no other `players` row, no staff / school-manager / manager-invite / leadership / people link (or matching email), no `member_key`, no match-history evidence above. Everything else is kept and the UI says why.
- The helper never touches `matches`, `season_standings`, `valorant_*`, reschedule tables, schools, teams, rosters or seasons.
- App-level only: SQL run by hand or seed scripts can still remove a `players` row and leave an orphan member; the gold ingest still upserts members by `member_key`.
- Not applied (documented in open threads): deleting a game or season cascades to players without the app reading them; deleting a school does not touch members (soft delete); the spec-034 move keeps the row.
- Existing orphan members created before this change are not swept; the spec-036 purge script remains the tool for that.

## Verification

- `app/lib/db/__tests__/roster-removal.test.ts`: orphan deleted in order (player, consents, demographics, identities, invites, member); member lock before any check; stale row; kept for other roster, staff, school manager (and manager invite), leadership and people profile, archive key, each history source; missing table/column (42P01/42703) tolerated; other errors keep the member, roll the cleanup back and keep the removal; member delete must affect one row; copy and notice wording; cache tags.
- `app/(admin)/admin/schools/__tests__/roster-edit-actions.test.ts`: staff actions call the helper inside the transaction with the school-scoped player and roster; deleteRoster runs the cleanup per distinct member; refused rosters never run it.
- `app/lib/onboarding/__tests__/milestone3-portal-actions.test.ts`: manager action uses a transaction, cache tags and message.
- `app/components/admin/__tests__/player-removal-confirm.test.tsx`, `app/(portal)/portal/__tests__/remove-player-confirm.test.tsx`: dialogs show the copy, cancel never acts, confirm acts once, failures stay in the dialog.
- Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Not run against a database (production `.env` is not used); the SQL (`FOR UPDATE`, savepoints, `position(... in ...)`) is exercised only through mocks and was not rehearsed on PGlite or a real Postgres.
