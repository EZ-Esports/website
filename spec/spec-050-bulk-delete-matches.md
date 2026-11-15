# spec-050: Bulk delete matches

Status: implemented, unmerged. No migration.

## Behavior
`/admin/matches` has a **Select** toggle beside Generate season. In select mode each row shows a checkbox, a bar offers **Select all shown (N)** (only the rows currently loaded for the active filters and tab), a live "N selected" count, and **Delete selected (N)**. The button opens a `ConfirmActionDialog` (danger tone, Cancel focused) stating the count; confirming calls one server action. On success the rows leave the list, page 1 and tab counts are refetched for the active filters so the next 25 matches fill in, a toast reports the count, and select mode stays on with the selection cleared so a long list can be cleared in repeated batches (press Done selecting to leave). On failure the error shows inside the dialog and it stays open.

## Server
`deleteMatches(ids)` in `app/(admin)/admin/matches/actions.ts`:
- `requirePermission(MANAGE_MATCHES)`, same as `deleteMatch`.
- Rejects empty input, any non-UUID id, and more than `MAX_BULK_DELETE_MATCHES` (200); de-duplicates ids.
- One `db.transaction` with a single `DELETE ... WHERE id IN (...) RETURNING id`. Dependent rows (results, game data, reschedule requests) go through `ON DELETE CASCADE`, exactly as for the single delete; there is no audit log for match deletes today, so none was added.
- On success calls the shared `revalidateMatches()` (`updateTag` matches, rosters, teams, plus the same `revalidatePath`s). Returns `{ success, deleted }`; a failed transaction returns an error and invalidates nothing.

## Client notes
The selection is a set of ids, pruned whenever the loaded rows change (filter, tab, search, reload) and intersected with the rows on screen at delete time, so matches no longer visible can never be deleted. The select-all checkbox is indeterminate (`aria-checked="mixed"`) when only some rows are selected; pressing it then selects all, and pressing it when all are selected clears.

## Tests
`app/(admin)/admin/matches/__tests__/delete-matches.test.ts` (permission rejection means no DB call, validation, lowercased and de-duplicated ids passed to `inArray`, single transaction, tags, failure) and `app/components/admin/__tests__/AdminMatchExplorer.select.test.tsx` (select mode, mixed select-all, confirm and delete with refill, error stays in dialog). Not run against a database.
