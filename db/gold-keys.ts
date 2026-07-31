/**
 * Natural keys for the gold archive.
 *
 * Pure, DB-free, and deliberately the single definition of these keys: the
 * migration that backfilled the existing rows (0026), the seed that writes them
 * now, and the upsert that will read them in PR2 all have to agree on the exact
 * string, or the upsert matches nothing and re-inserts the whole archive.
 */

/**
 * `${school_slug}|${lower first_name}|${lower last_name}` — unique across all
 * 772 archive rows.
 *
 * gold_members.csv also ships this as a `member_key` column, and the two agree
 * today. The seed derives it here rather than reading that column because
 * migration 0026 backfilled the existing production rows from this formula in
 * SQL: if the normalizer ever changed how it builds member_key, reading the
 * column would quietly stop matching rows already in the database, while
 * deriving it keeps the seed and the backfill defined the same way. The two
 * are asserted equal over the real CSV in db/__tests__/gold-keys.test.ts, so
 * drift fails the build rather than corrupting a seed.
 */
export function memberKeyOf(row: GoldRecord): string {
  return `${row.school_slug}|${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}`;
}

/**
 * A row as `readRecords` hands it over: every gold CSV column, all strings.
 * Typed loosely on purpose so these helpers take a record straight from the
 * parser, the same way the rest of the seed does.
 */
export type GoldRecord = Record<string, string>;

/**
 * The natural fields of a match, joined. Not unique on its own — see below.
 * Reads season, game_slug, home_school_slug, home_division, away_school_slug,
 * away_division, and scheduled_at ("YYYY-MM-DD HH:MM:SS", America/New_York wall
 * time as written in the sheets).
 */
export function matchNaturalPrefix(row: GoldRecord): string {
  return [
    row.season,
    row.game_slug,
    row.home_school_slug,
    row.home_division,
    row.away_school_slug,
    row.away_division,
    row.scheduled_at,
  ].join('|');
}

/**
 * Source keys for every match row, in file order.
 *
 * The natural fields are NOT unique: the 2022-23 Valorant season's scheduled_at
 * is synthesized from a weekly date block ("All matches at 7:30PM"), so two
 * different rounds of New Dorp vs Cardozo land on 2022-12-28 19:30 — once in
 * Varsity and once in JV, 4 rows out of 719. Those four are identical in every
 * column except free-text `notes`.
 *
 * So the key appends a `#n` occurrence ordinal, assigned in file order within a
 * collision group. Keying on `notes` instead would also be unique, but then
 * editing a note would change a match's identity and churn its UUID; the
 * ordinal is stable when unrelated fields change, which is the property that
 * matters. Every row gets an explicit `#n` — `#0` for the 717 that never
 * collide — so a future third collision cannot shift the keys of rows already
 * in the database.
 */
export function matchSourceKeys(rows: GoldRecord[]): string[] {
  return withOccurrenceOrdinal(rows, matchNaturalPrefix);
}

/**
 * The natural fields of a standings row, joined. Not unique on its own — see
 * below. Reads season, game_slug, division, school_slug and player_name.
 *
 * `division` is part of the key because a season can publish separate Varsity
 * and JV tables (and TFT publishes one league-wide "All" table), and a school
 * can appear in more than one of them.
 */
export function standingNaturalPrefix(row: GoldRecord): string {
  return [row.season, row.game_slug, row.division, row.school_slug, row.player_name ?? ''].join('|');
}

/**
 * Source keys for every standings row, in file order.
 *
 * `rank` is deliberately NOT in the key. It is payload — the thing an admin
 * edits when a result is corrected — and putting it in the key would mean a
 * rank correction re-keys the row, so the seed's upsert would insert a
 * duplicate instead of updating. That is worst for the 45 TFT rows in the "All"
 * division, which carry league-wide ranks: adding a single player would shift
 * the rank of dozens of rows at once and churn every one of their UUIDs, which
 * is the exact failure this work exists to prevent.
 *
 * What is left is not quite unique. Two groups collide, both TFT 2021-22
 * Varsity: Midwood at ranks 2 and 6, and Stuyvesant at ranks 3 and 5. Those are
 * per-player rows whose `player_name` the normalizer never recovered, so they
 * are blank — 4 rows out of 183 that carry no identity in the data at all. Any
 * discriminator for them is therefore arbitrary; the `#n` occurrence ordinal is
 * chosen so that the arbitrariness is confined to those 4 rows instead of
 * making all 183 fragile the way keying on `rank` would.
 *
 * As with matches, every row gets an explicit `#n` (`#0` for the 179 that never
 * collide) so a future third row in a group cannot renumber rows already in the
 * database.
 */
export function standingSourceKeys(rows: GoldRecord[]): string[] {
  return withOccurrenceOrdinal(rows, standingNaturalPrefix);
}

/**
 * `${prefix}#${n}`, where n counts prior rows with the same prefix in the order
 * given. Shared by matches and standings so the two conventions cannot drift.
 */
function withOccurrenceOrdinal(rows: GoldRecord[], prefixOf: (row: GoldRecord) => string): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const prefix = prefixOf(row);
    const n = seen.get(prefix) ?? 0;
    seen.set(prefix, n + 1);
    return `${prefix}#${n}`;
  });
}
