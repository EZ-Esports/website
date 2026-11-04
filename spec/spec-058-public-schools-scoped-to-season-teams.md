# spec-058: Public school lists scoped to teams in the season

Status: implemented, unmerged. No migration, no schema change.

## Rule

On every public page that lists schools in a game context, a school appears only if it has a `teams` row (school x game x season) for the season the page shows. Having played the game in some other season, having a `season_standings` snapshot row, or merely existing in `schools` is not enough.

## Audit (public routes)

| Surface | Source | Result |
|---|---|---|
| `/{game}/teams` | `getGameTeamsPageData` | Already team-backed (joins `teams`); the client defaults to the active season and its season dropdown is built from teams. Unchanged. |
| `/{game}/teams/[school]` | `getSchoolGameTeamsPageData` | Returned an empty page for any school, even one with no team in the game. Now returns `null` (404) when the school has no team in the game. |
| `/{game}/standings` | `getSeasonStandingsFor` | Computed fallback was already team-backed; the archived snapshot branch listed schools by `season_standings` only. Snapshot now requires a team in the season (`schoolHasTeamInSeason`) and a non-deleted school. |
| Game hub standings tile | `getGameSeasonSummary` | Same snapshot gap, same fix (extracted `buildSeasonSummarySnapshotQuery`). |
| `/archives` champions | `getArchiveIndex` | Rank-1 snapshot row now requires a team in that season. |
| Schedule, hub next match/results, homepage League Pulse | match queries | Match rows are reached through roster -> team -> school, so they are team-backed by construction. Unchanged. |
| Homepage School Wall, `/about` school count | `getCachedSchools` | No game context ("Member Schools"). Left alone. |
| `/{game}/bracket`, tournament matches | `tournaments` tables | Decoupled from seasons/teams (spec-010). Left alone. |

## Implementation

- `schoolHasTeamInSeason(schoolId, seasonId)` in `app/lib/db/standings.ts`: a plain SQL `exists (select 1 from teams ...)` fragment (not a `db.select` subquery, so it adds no extra query call). `teams.season_id` already pins the game.
- Fixed at the query layer, so every caller (standings page, hub, archives) benefits.
- Cache keys unchanged: the affected reads are uncached or already keyed by season id; the `teams`, `seasons` and `schools` tags already invalidate the cached consumers.
- Season choice is unchanged: the page's selected season, else the game's active season. Unpublished-season rules (spec-022, spec-049) are untouched: team lists still render with the pending notice.

## Tests

`app/lib/db/__tests__/public-school-season-scope.test.ts` asserts the compiled SQL of the snapshot, combined-snapshot and summary queries contains the team-exists predicate scoped to the season, and that the computed query stays season-pinned.

## Known edge

An archived snapshot row for a school that never had a `teams` row in that season is now hidden. If such legacy rows exist in production they disappear from public standings/archives until a team row exists; not verified against the live database.
