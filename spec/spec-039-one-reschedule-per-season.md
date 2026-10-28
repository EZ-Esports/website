# spec-039: One Reschedule Request Per School Per Season

- **Spec ID:** spec-039
- **Title:** Each school may make at most one reschedule request per season, across all its matches
- **Status:** Implemented on branch `feat/reschedule-one-per-season`. No migration.
- **PR / Commit:** pending (branch `feat/reschedule-one-per-season`)
- **Date:** 2026-10-27
- **Scope:** a per-season allowance on the request action, the portal request button, and the rule constant. Builds on [spec-032](spec-032-match-reschedule-requests.md).

## Rule

- `MAX_RESCHEDULE_REQUESTS_PER_SEASON = 1` in `app/lib/reschedule-rules.ts` is the single source.
- A school's count is its `match_reschedule_requests` rows with `requested_by_school_id` = that school, whose match is in the season, and whose status is not `cancelled`. Open, approved and declined requests all count; a request the requester cancelled does not.
- Counter-offers and the opponent's accept or decline do not use the opponent's allowance. Staff edits do not count, and staff are not limited.
- A school at its allowance gets "Your school has already used its one reschedule for this season." from the request action, and the portal hides "Request reschedule" with that note.

## Enforcement (race-safe, no migration)

`requestRescheduleImpl` runs the count and the insert in one transaction. The first statement locks the requesting school's `schools` row (`SELECT ... FOR UPDATE`). The count is a separate statement after that lock, so under READ COMMITTED it sees any request committed by a concurrent transaction for the same school. Two simultaneous requests from one school therefore serialize: the second waits for the first to commit, then counts it and is refused. Requests from different schools lock different rows and do not wait on each other.

The portal reads the same count through `getSeasonsWithRescheduleAllowanceUsed` (one grouped query per schedule load) for display only. The action's check is the requirement.

## Known limits

- The lock relies on READ COMMITTED (the Supabase default). Under REPEATABLE READ the second transaction would fail with a serialization error rather than be counted, which is still a refusal but a generic one.
- Only the portal button is hidden; a stale page that still shows it gets the server's message.
- Unit tests use the query-builder stand-in, so they prove the lock is taken before the count and that the filters are right, not the SQL itself. Not verified against a real database in this change.
