/**
 * Gold-tier archival seed.
 *
 * Loads the normalized spreadsheet archive produced by
 * sharepoint/normalize_gold.py (gold_data/*.csv) into the database:
 * games, schools, seasons, teams, rosters, members, players, matches,
 * and season_standings (historical standings snapshots).
 *
 * All entity resolution (school canonicalization, division labels,
 * member dedup, captain recovery, match status inference) happens in the
 * gold normalizer — this script is a dumb loader that only resolves FKs.
 *
 * Idempotent. Every table is upserted on a natural key and keeps its row ids, so
 * running this twice in a row changes nothing: no id churn, no deletes, and no
 * cache to flush afterwards. It does not touch news_posts, leadership, or the
 * phase-2 CMS tables (sponsors, gallery, page content, admin/auth).
 *
 * It used to delete nine tables and re-insert them, which failed in both of the
 * ways a wipe can. Fresh UUIDs on every row left cached queries handing out ids
 * that no longer existed, so standings pages rendered empty against a database
 * that was fine. And re-inserting from a CSV silently dropped every column the
 * CSV does not carry — all 27 school logos, plus 70 leadership rows by cascade,
 * none of which had a backup behind them.
 *
 * The rule that follows from that, and that every upsert here obeys: the CSV
 * owns exactly the columns it carries. See step 1.
 *
 * Keys come from migration 0026 (members.member_key, matches.source_key,
 * season_standings.source_key) and the unique indexes already on games.slug,
 * schools.slug, seasons(game_id,name), teams(school_id,game_id,season_id),
 * rosters(team_id,name) and players(roster_id,member_id). db/gold-keys.ts is the
 * single definition of the three archive keys — the migration's backfill and
 * these upserts have to derive the identical string or nothing matches.
 *
 * Run: npm run db:seed:gold
 */
import { and, isNotNull, notInArray, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { requireFreshBackup } from './backup';
import { assertSeedTargetAllowed } from './seed-target';
import { matchSourceKeys, memberKeyOf, standingSourceKeys } from './gold-keys';
import { readRecords } from './import-archive';

const GOLD_DIR = 'sharepoint/gold_data';

/** Every table this seed touches (insert/upsert/prune), scoping the pre-seed backup. */
const GOLD_SEED_TABLES = [
  'games', 'schools', 'seasons', 'teams', 'rosters',
  'members', 'players', 'matches', 'season_standings',
] as const;

const gold = (file: string) => readRecords(`${GOLD_DIR}/${file}`);

const intOrNull = (v: string) => (v === '' ? null : parseInt(v, 10));
const floatOrNull = (v: string) => (v === '' ? null : parseFloat(v));
const orNull = (v: string) => (v === '' ? null : v);

/** Milliseconds the given timezone is ahead of UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second
  );
  return asUtc - date.getTime();
}

/**
 * "YYYY-MM-DD HH:MM:SS" (America/New_York wall time, as written in the
 * spreadsheets) -> UTC Date. Two passes so the DST offset is taken from the
 * instant itself, not from today.
 */
function parseEastern(s: string): Date {
  const [d, t] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm, ss] = t.split(':').map(Number);
  const wallUtc = Date.UTC(y, m - 1, day, hh, mm, ss ?? 0);
  let instant = wallUtc;
  for (let i = 0; i < 2; i++) {
    instant = wallUtc - tzOffsetMs(new Date(instant), 'America/New_York');
  }
  return new Date(instant);
}

/**
 * Reads a season's standings_format, refusing to guess.
 *
 * gold_data/ is gitignored (member PII), so a checkout whose normalizer writes
 * standings_format can still be paired with a gold_seasons.csv generated before
 * the column existed. Defaulting to 'divided' there would silently split the
 * one combined-format season back across Varsity/JV tabs — the exact bug the
 * column exists to fix — so a stale CSV has to fail the seed instead.
 *
 * Called once per row from step 0c, BEFORE the wipe — see the comment there. It
 * is deliberately not called again at the insert site: a second call would be a
 * second place this check could drift back behind the deletes.
 */
function standingsFormatOf(s: Record<string, string>): string {
  if (!('standings_format' in s)) {
    throw new Error(
      'gold_seasons.csv has no "standings_format" column: it predates the checked-out ' +
        'pipeline. Regenerate it — from sharepoint/, run `python3 normalize_gold.py` — then re-run the seed.'
    );
  }
  if (s.standings_format !== 'divided' && s.standings_format !== 'combined') {
    throw new Error(
      `gold_seasons.csv: season "${s.game_slug}" / "${s.name}" has standings_format ` +
        `"${s.standings_format}" — expected "divided" or "combined".`
    );
  }
  return s.standings_format;
}

const rosterKey = (season: string, game: string, school: string, division: string) =>
  `${season}|${game}|${school}|${division}`;

/**
 * Deletes archive-owned rows whose natural key the CSVs no longer list.
 *
 * Two guards make this narrower than it looks, and both are load-bearing:
 *
 *   - `isNotNull(key)` scopes the delete to rows the archive stamped. A row an
 *     admin created has no source key, so it can never match, whatever the CSV
 *     says. Dropping this predicate turns a prune into the wipe this rewrite
 *     replaced.
 *   - an empty `keys` returns early instead of deleting everything. A CSV that
 *     failed to parse, or a gold_data/ directory that was never generated,
 *     yields zero keys, and `NOT IN ()` over an empty set matches every row.
 *     A seed with nothing to import must delete nothing.
 */
async function pruneByKey(
  table: PgTable,
  key: PgColumn,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) return 0;
  const deleted = await db
    .delete(table)
    .where(and(isNotNull(key), notInArray(key, [...new Set(keys)])))
    .returning({ id: sql<string>`1` });
  return deleted.length;
}

async function main() {
  console.log('Importing gold archive data...');

  // 0a. Refuse a database this seed has no business wiping. `.env` on the
  //     machine this is usually run from holds the production connection
  //     string, so production was the default target and the only safeguard was
  //     the operator remembering. Loopback runs freely; anything else has to be
  //     named in SEED_ALLOW_REMOTE. Checked before the backup so a refused run
  //     does not first spend a minute dumping the database it will not touch.
  assertSeedTargetAllowed();

  // 0b. Back up. Step 1 touches nine tables; this has gone wrong against the
  //     live database twice, and both times there was nothing to restore from.
  //     requireFreshBackup throws unless a complete dump is on disk, which
  //     aborts the seed here — before any write.
  requireFreshBackup(GOLD_SEED_TABLES);

  // 0c. Read and validate the one CSV this loader can reject, before anything is
  //    deleted. Step 1 wipes the whole archive, so a standings_format this
  //    script refuses to guess at has to fail here: a stale gold_seasons.csv is
  //    the normal state of a fresh clone (gold_data/ is gitignored), and failing
  //    after the wipe would leave the live site with zero seasons, matches,
  //    standings, rosters and players. The validated values are carried down to
  //    step 4 rather than re-derived there, so there is only one call site to
  //    keep in front of the deletes.
  const seasonRows = gold('gold_seasons.csv');
  const seasonFormats = seasonRows.map(standingsFormatOf);

  // 1. Nothing is wiped. Every step below upserts on a natural key and keeps the
  //    row's id, which is the whole point of this script's second life.
  //
  //    The old version deleted these nine tables and re-inserted them. That did
  //    two kinds of damage. Every row got a fresh UUID, so cached queries handed
  //    out ids that no longer existed and standings pages rendered empty against
  //    a database that was fine. And it destroyed columns the archive has never
  //    heard of: all 27 school logos, because gold_schools.csv carries only
  //    slug/name/display_order, and 70 leadership rows by cascade.
  //
  //    The rule every upsert below follows, and the one that would have
  //    prevented both: THE CSV OWNS EXACTLY THE COLUMNS IT CARRIES. A column
  //    absent from the CSV is somebody else's — an admin editor's, usually — and
  //    is never written here, not even to a default. When adding a column to a
  //    gold CSV, add it to the `set` of the matching upsert; when adding one to
  //    the schema without adding it to a CSV, do nothing here at all.
  //
  //    Rows the archive dropped are pruned at the end, scoped to rows that came
  //    from the archive in the first place — see step 11.

  // 2. Games — keyed on slug.
  //
  //    image_url is filled only when the row has none. It is the one CSV column
  //    here that the admin league editor also writes, and what the CSV holds is
  //    a static repo path (/images/games/lol-banner.png) that has never changed,
  //    so there is nothing to sync and an uploaded banner would be overwritten
  //    for no gain. storage_key is not in the CSV at all and is left alone.
  const gameRows = gold('gold_games.csv');
  const games = await db
    .insert(schema.games)
    .values(gameRows.map((g) => ({
      slug: g.slug,
      displayName: g.display_name,
      shortName: g.short_name,
      imageUrl: g.image_url,
    })))
    .onConflictDoUpdate({
      target: schema.games.slug,
      set: {
        displayName: sql`excluded.display_name`,
        shortName: sql`excluded.short_name`,
        imageUrl: sql`coalesce(${schema.games.imageUrl}, excluded.image_url)`,
      },
    })
    .returning();
  const gameBySlug = new Map(games.map((g) => [g.slug, g]));
  console.log(`  games:            ${games.length}`);

  // 3. Schools — keyed on slug.
  //
  //    This is the upsert the school-logo loss is about. logo_url, storage_key,
  //    website_url and is_active are all absent from gold_schools.csv and all
  //    set in the admin editor, so none of them appear below. The delete-and
  //    -reinsert this replaces blanked every one of them on every run.
  const schoolRows = gold('gold_schools.csv');
  const schools = await db
    .insert(schema.schools)
    .values(schoolRows.map((s) => ({
      slug: s.slug,
      name: s.name,
      displayOrder: parseInt(s.display_order, 10),
    })))
    .onConflictDoUpdate({
      target: schema.schools.slug,
      set: {
        name: sql`excluded.name`,
        displayOrder: sql`excluded.display_order`,
      },
    })
    .returning();
  const schoolBySlug = new Map(schools.map((s) => [s.slug, s]));
  console.log(`  schools:          ${schools.length}`);

  // Inverse lookups, so the maps below can be built from what each upsert
  // actually returned rather than from the order the rows went in. INSERT ...
  // RETURNING preserves input order; INSERT ... ON CONFLICT ... RETURNING does
  // not promise to, and a silently mis-aligned map here would attach every
  // roster to the wrong team.
  const gameSlugById = new Map(games.map((g) => [g.id, g.slug]));
  const schoolSlugById = new Map(schools.map((s) => [s.id, s.slug]));

  // 4. Seasons — keyed (game_id, name). Rows and formats both come from step 0c,
  //    already validated.
  const seasons = await db
    .insert(schema.seasons)
    .values(seasonRows.map((s, i) => ({
      gameId: gameBySlug.get(s.game_slug)!.id,
      name: s.name,
      isActive: s.is_active === 'True',
      standingsFormat: seasonFormats[i],
    })))
    .onConflictDoUpdate({
      target: [schema.seasons.gameId, schema.seasons.name],
      set: {
        isActive: sql`excluded.is_active`,
        standingsFormat: sql`excluded.standings_format`,
      },
    })
    .returning();
  const seasonByKey = new Map(
    seasons.map((s) => [`${gameSlugById.get(s.gameId)}|${s.name}`, s])
  );
  const seasonKeyById = new Map(
    seasons.map((s) => [s.id, `${gameSlugById.get(s.gameId)}|${s.name}`])
  );
  console.log(`  seasons:          ${seasons.length}`);

  // 5. Teams — distinct (school, game, season) derived from rosters. The table
  //    has no payload of its own, so the conflict branch writes a column back to
  //    itself: that changes nothing but still makes the row eligible for
  //    RETURNING, which onConflictDoNothing would skip, leaving the id unknown.
  const rosterRows = gold('gold_rosters.csv');
  const teamKeys = [...new Set(rosterRows.map((r) => `${r.season}|${r.game_slug}|${r.school_slug}`))];
  const teams = await db
    .insert(schema.teams)
    .values(teamKeys.map((key) => {
      const [season, gameSlug, schoolSlug] = key.split('|');
      return {
        schoolId: schoolBySlug.get(schoolSlug)!.id,
        gameId: gameBySlug.get(gameSlug)!.id,
        seasonId: seasonByKey.get(`${gameSlug}|${season}`)!.id,
      };
    }))
    .onConflictDoUpdate({
      target: [schema.teams.schoolId, schema.teams.gameId, schema.teams.seasonId],
      set: { schoolId: sql`excluded.school_id` },
    })
    .returning();
  const teamByKey = new Map(
    teams.map((t) => {
      const season = seasonKeyById.get(t.seasonId)!.split('|')[1];
      return [`${season}|${gameSlugById.get(t.gameId)}|${schoolSlugById.get(t.schoolId)}`, t];
    })
  );
  const teamKeyById = new Map([...teamByKey].map(([key, t]) => [t.id, key]));
  console.log(`  teams:            ${teams.length}`);

  // 6. Rosters — keyed (team_id, name); name doubles as the division label
  //    (site convention).
  const rosters = await db
    .insert(schema.rosters)
    .values(rosterRows.map((r) => ({
      teamId: teamByKey.get(`${r.season}|${r.game_slug}|${r.school_slug}`)!.id,
      name: r.division,
      division: r.division,
    })))
    .onConflictDoUpdate({
      target: [schema.rosters.teamId, schema.rosters.name],
      set: { division: sql`excluded.division` },
    })
    .returning();
  const rosterByKey = new Map(
    rosters.map((r) => {
      // teamKey is `${season}|${gameSlug}|${schoolSlug}`; rosterKey wants those
      // three plus the division, in a different order.
      const [season, gameSlug, schoolSlug] = teamKeyById.get(r.teamId)!.split('|');
      return [rosterKey(season, gameSlug, schoolSlug, r.name), r];
    })
  );
  console.log(`  rosters:          ${rosters.length}`);

  // 7. Members (already deduped across seasons/games by the normalizer).
  //    member_key is written here so the rows this seed creates carry the same
  //    natural key migration 0026 backfilled onto the rows already in the
  //    database. Without it a single run of this seed would blank the column
  //    again and PR2's first upsert would match nothing.
  const memberRows = gold('gold_members.csv');
  const members = await db
    .insert(schema.members)
    .values(memberRows.map((m) => ({
      firstName: m.first_name,
      lastName: m.last_name,
      discord: orNull(m.discord),
      graduationYear: intOrNull(m.graduation_year),
      schoolId: schoolBySlug.get(m.school_slug)!.id,
      memberKey: memberKeyOf(m),
    })))
    .onConflictDoUpdate({
      target: schema.members.memberKey,
      set: {
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        discord: sql`excluded.discord`,
        graduationYear: sql`excluded.graduation_year`,
        schoolId: sql`excluded.school_id`,
      },
    })
    .returning();
  const memberByKey = new Map(members.map((m) => [m.memberKey!, m]));
  console.log(`  members:          ${members.length}`);

  // 8. Players — keyed (roster_id, member_id).
  const playerRows = gold('gold_players.csv');
  const players = await db
    .insert(schema.players)
    .values(playerRows.map((p) => ({
      rosterId: rosterByKey.get(rosterKey(p.season, p.game_slug, p.school_slug, p.division))!.id,
      memberId: memberByKey.get(p.member_key)!.id,
      role: p.role as (typeof schema.playerRoleEnum.enumValues)[number],
      ign: orNull(p.ign),
      bio: orNull(p.bio),
      isCaptain: p.is_captain === 'True',
    })))
    .onConflictDoUpdate({
      target: [schema.players.rosterId, schema.players.memberId],
      set: {
        role: sql`excluded.role`,
        ign: sql`excluded.ign`,
        bio: sql`excluded.bio`,
        isCaptain: sql`excluded.is_captain`,
      },
    })
    .returning();
  console.log(`  players:          ${players.length}`);

  // 9. Matches. Each side resolves its own roster — cross-division matches
  //    exist (e.g. 2023-24 LoL ran Midwood Varsity vs Midwood JV).
  //    source_key, like member_key above, keeps the rows this seed writes
  //    aligned with what migration 0026 backfilled. See db/gold-keys.ts for why
  //    the key needs an occurrence ordinal.
  const matchRows = gold('gold_matches.csv');
  const sourceKeys = matchSourceKeys(matchRows);
  const matches = await db
    .insert(schema.matches)
    .values(matchRows.map((m, i) => ({
      seasonId: seasonByKey.get(`${m.game_slug}|${m.season}`)!.id,
      homeRosterId: rosterByKey.get(rosterKey(m.season, m.game_slug, m.home_school_slug, m.home_division))!.id,
      awayRosterId: rosterByKey.get(rosterKey(m.season, m.game_slug, m.away_school_slug, m.away_division))!.id,
      scheduledAt: parseEastern(m.scheduled_at),
      homeScore: intOrNull(m.home_score),
      awayScore: intOrNull(m.away_score),
      status: m.status as (typeof schema.matchStatusEnum.enumValues)[number],
      mvp: orNull(m.mvp),
      notes: orNull(m.notes),
      sourceKey: sourceKeys[i],
    })))
    .onConflictDoUpdate({
      target: schema.matches.sourceKey,
      set: {
        seasonId: sql`excluded.season_id`,
        homeRosterId: sql`excluded.home_roster_id`,
        awayRosterId: sql`excluded.away_roster_id`,
        scheduledAt: sql`excluded.scheduled_at`,
        homeScore: sql`excluded.home_score`,
        awayScore: sql`excluded.away_score`,
        status: sql`excluded.status`,
        mvp: sql`excluded.mvp`,
        notes: sql`excluded.notes`,
      },
    })
    .returning();
  console.log(`  matches:          ${matches.length}`);

  // 10. Season standings snapshots.
  //     source_key, like the two above, keeps the rows this seed writes aligned
  //     with what migration 0026 backfilled. It deliberately excludes `rank` —
  //     see db/gold-keys.ts for why rank is payload rather than identity.
  const standingRows = gold('gold_standings.csv');
  const standingKeys = standingSourceKeys(standingRows);
  const standings = await db
    .insert(schema.seasonStandings)
    .values(standingRows.map((s, i) => ({
      seasonId: seasonByKey.get(`${s.game_slug}|${s.season}`)!.id,
      schoolId: schoolBySlug.get(s.school_slug)!.id,
      division: s.division,
      rank: intOrNull(s.rank),
      wins: intOrNull(s.wins),
      losses: intOrNull(s.losses),
      gamesPlayed: intOrNull(s.games_played),
      winPct: floatOrNull(s.win_pct),
      points: floatOrNull(s.points),
      playerName: orNull(s.player_name),
      playerIgn: orNull(s.player_ign),
      notes: orNull(s.notes),
      sourceKey: standingKeys[i],
    })))
    .onConflictDoUpdate({
      target: schema.seasonStandings.sourceKey,
      set: {
        seasonId: sql`excluded.season_id`,
        schoolId: sql`excluded.school_id`,
        division: sql`excluded.division`,
        rank: sql`excluded.rank`,
        wins: sql`excluded.wins`,
        losses: sql`excluded.losses`,
        gamesPlayed: sql`excluded.games_played`,
        winPct: sql`excluded.win_pct`,
        points: sql`excluded.points`,
        playerName: sql`excluded.player_name`,
        playerIgn: sql`excluded.player_ign`,
        notes: sql`excluded.notes`,
      },
    })
    .returning();
  console.log(`  season_standings: ${standings.length}`);

  // 11. Prune what the archive dropped — matches and standings only.
  //
  //     Both carry a source_key the archive stamps, so "this row came from a
  //     CSV that no longer lists it" is a fact rather than an inference. A NULL
  //     source_key means an admin created the row, and those are never touched.
  //     Both tables also have no dependents, so a delete here cascades nowhere.
  //
  //     These are the two where a stale row is actively wrong rather than merely
  //     untidy: a match the archive retracted keeps rendering on the schedule,
  //     and a withdrawn standings row keeps occupying a rank.
  //
  //     Deliberately NOT pruned:
  //       - members and players. Neither can be pruned safely. players has no
  //         archive key at all — its identity is (roster_id, member_id), which
  //         an admin roster editor produces exactly the same way an import does,
  //         so "not in the CSV" and "added by hand" are indistinguishable. And
  //         players.member_id is RESTRICT, so pruning members would fail against
  //         any member who still has one. A departed member costs a stale roster
  //         entry, not a wrong result.
  //       - games, schools, seasons, teams, rosters. No archive key, referenced
  //         by admin-authored content, and they cascade hard: dropping a school
  //         takes its teams, rosters, players and standings with it. The archive
  //         has never removed one, and if it ever does that should be an admin
  //         decision, not a side effect of a re-import.
  const prunedStandings = await pruneByKey(
    schema.seasonStandings, schema.seasonStandings.sourceKey, standingKeys
  );
  const prunedMatches = await pruneByKey(schema.matches, schema.matches.sourceKey, sourceKeys);
  console.log(`  pruned:           ${prunedMatches} matches, ${prunedStandings} standings`);

  console.log('Import complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
