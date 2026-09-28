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
import { parseEastern } from '../app/lib/dates';
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

export interface GoldDiffRow {
  entity: string;
  incoming: number;
  toInsert: number;
  toUpdate: number;
  unchanged: number;
  toPrune: number | null;
}

export function formatGoldDiffTable(rows: GoldDiffRow[]): string {
  const header = ['Entity', 'Total CSV', 'To Insert', 'To Update', 'Unchanged', 'To Prune'];
  const colWidths = [18, 11, 11, 11, 11, 10];
  const pad = (s: string | number, w: number, right = false) => {
    const str = String(s);
    return right ? str.padStart(w) : str.padEnd(w);
  };
  const line = '='.repeat(colWidths.reduce((a, b) => a + b + 2, 0) - 2);
  const div = '-'.repeat(colWidths.reduce((a, b) => a + b + 2, 0) - 2);

  const out: string[] = [];
  out.push('\n📋 Ingestion Plan (--dry-run):');
  out.push(line);
  out.push(
    header.map((h, i) => (i === 0 ? pad(h, colWidths[i]) : pad(h, colWidths[i], true))).join('  ')
  );
  out.push(div);
  for (const r of rows) {
    out.push([
      pad(r.entity, colWidths[0]),
      pad(r.incoming, colWidths[1], true),
      pad(r.toInsert, colWidths[2], true),
      pad(r.toUpdate, colWidths[3], true),
      pad(r.unchanged, colWidths[4], true),
      pad(r.toPrune !== null ? r.toPrune : '-', colWidths[5], true),
    ].join('  '));
  }
  out.push(line);
  out.push('--dry-run: Database inspected. 0 mutations executed.');
  out.push('To apply this ingestion to the database, run without --dry-run.\n');
  return out.join('\n');
}

export async function calculateGoldDiff(
  seasonRows: Record<string, string>[],
  seasonFormats: string[]
): Promise<GoldDiffRow[]> {
  const diffs: GoldDiffRow[] = [];

  // 1. Games
  const gameRows = gold('gold_games.csv');
  const existingGames = await db.select({
    id: schema.games.id,
    slug: schema.games.slug,
    displayName: schema.games.displayName,
    shortName: schema.games.shortName,
    imageUrl: schema.games.imageUrl,
  }).from(schema.games);
  const existingGamesBySlug = new Map(existingGames.map((g) => [g.slug, g]));
  let gamesInsert = 0, gamesUpdate = 0, gamesUnchanged = 0;
  for (const g of gameRows) {
    const ext = existingGamesBySlug.get(g.slug);
    if (!ext) {
      gamesInsert++;
    } else if (
      ext.displayName !== g.display_name ||
      ext.shortName !== g.short_name ||
      (!ext.imageUrl && g.image_url)
    ) {
      gamesUpdate++;
    } else {
      gamesUnchanged++;
    }
  }
  diffs.push({
    entity: 'games',
    incoming: gameRows.length,
    toInsert: gamesInsert,
    toUpdate: gamesUpdate,
    unchanged: gamesUnchanged,
    toPrune: null,
  });

  // 2. Schools
  const schoolRows = gold('gold_schools.csv');
  const existingSchools = await db.select({
    id: schema.schools.id,
    slug: schema.schools.slug,
    name: schema.schools.name,
    displayOrder: schema.schools.displayOrder,
  }).from(schema.schools);
  const existingSchoolsBySlug = new Map(existingSchools.map((s) => [s.slug, s]));
  let schoolsInsert = 0, schoolsUpdate = 0, schoolsUnchanged = 0;
  for (const s of schoolRows) {
    const ext = existingSchoolsBySlug.get(s.slug);
    if (!ext) {
      schoolsInsert++;
    } else if (
      ext.name !== s.name ||
      ext.displayOrder !== parseInt(s.display_order, 10)
    ) {
      schoolsUpdate++;
    } else {
      schoolsUnchanged++;
    }
  }
  diffs.push({
    entity: 'schools',
    incoming: schoolRows.length,
    toInsert: schoolsInsert,
    toUpdate: schoolsUpdate,
    unchanged: schoolsUnchanged,
    toPrune: null,
  });

  // 3. Seasons
  const existingSeasons = await db.select({
    id: schema.seasons.id,
    gameId: schema.seasons.gameId,
    name: schema.seasons.name,
    isActive: schema.seasons.isActive,
    standingsFormat: schema.seasons.standingsFormat,
  }).from(schema.seasons);
  const existingSeasonsByKey = new Map(
    existingSeasons.map((s) => [`${s.gameId}|${s.name}`, s])
  );
  let seasonsInsert = 0, seasonsUpdate = 0, seasonsUnchanged = 0;
  for (let i = 0; i < seasonRows.length; i++) {
    const s = seasonRows[i];
    const game = existingGamesBySlug.get(s.game_slug);
    if (!game) {
      seasonsInsert++;
      continue;
    }
    const ext = existingSeasonsByKey.get(`${game.id}|${s.name}`);
    if (!ext) {
      seasonsInsert++;
    } else if (
      ext.isActive !== (s.is_active === 'True') ||
      ext.standingsFormat !== seasonFormats[i]
    ) {
      seasonsUpdate++;
    } else {
      seasonsUnchanged++;
    }
  }
  diffs.push({
    entity: 'seasons',
    incoming: seasonRows.length,
    toInsert: seasonsInsert,
    toUpdate: seasonsUpdate,
    unchanged: seasonsUnchanged,
    toPrune: null,
  });

  // 4. Teams
  const rosterRows = gold('gold_rosters.csv');
  const teamKeys = [...new Set(rosterRows.map((r) => `${r.season}|${r.game_slug}|${r.school_slug}`))];
  const existingTeams = await db.select({
    id: schema.teams.id,
    schoolId: schema.teams.schoolId,
    gameId: schema.teams.gameId,
    seasonId: schema.teams.seasonId,
  }).from(schema.teams);
  const teamIdByKey = new Map(
    existingTeams.map((t) => [`${t.schoolId}|${t.gameId}|${t.seasonId}`, t.id])
  );
  let teamsInsert = 0, teamsUnchanged = 0;
  for (const key of teamKeys) {
    const [season, gameSlug, schoolSlug] = key.split('|');
    const school = existingSchoolsBySlug.get(schoolSlug);
    const game = existingGamesBySlug.get(gameSlug);
    const seasonObj = game ? existingSeasonsByKey.get(`${game.id}|${season}`) : undefined;
    if (!school || !game || !seasonObj) {
      teamsInsert++;
    } else if (teamIdByKey.has(`${school.id}|${game.id}|${seasonObj.id}`)) {
      teamsUnchanged++;
    } else {
      teamsInsert++;
    }
  }
  diffs.push({
    entity: 'teams',
    incoming: teamKeys.length,
    toInsert: teamsInsert,
    toUpdate: 0,
    unchanged: teamsUnchanged,
    toPrune: null,
  });

  // 5. Rosters
  const existingRosters = await db.select({
    id: schema.rosters.id,
    teamId: schema.rosters.teamId,
    name: schema.rosters.name,
    division: schema.rosters.division,
  }).from(schema.rosters);
  const existingRostersByKey = new Map(
    existingRosters.map((r) => [`${r.teamId}|${r.name}`, r])
  );
  let rostersInsert = 0, rostersUpdate = 0, rostersUnchanged = 0;
  for (const r of rosterRows) {
    const school = existingSchoolsBySlug.get(r.school_slug);
    const game = existingGamesBySlug.get(r.game_slug);
    const seasonObj = game ? existingSeasonsByKey.get(`${game.id}|${r.season}`) : undefined;
    const teamId = (school && game && seasonObj)
      ? teamIdByKey.get(`${school.id}|${game.id}|${seasonObj.id}`)
      : undefined;
    if (!teamId) {
      rostersInsert++;
      continue;
    }
    const ext = existingRostersByKey.get(`${teamId}|${r.division}`);
    if (!ext) {
      rostersInsert++;
    } else if (ext.division !== r.division) {
      rostersUpdate++;
    } else {
      rostersUnchanged++;
    }
  }
  diffs.push({
    entity: 'rosters',
    incoming: rosterRows.length,
    toInsert: rostersInsert,
    toUpdate: rostersUpdate,
    unchanged: rostersUnchanged,
    toPrune: null,
  });

  // 6. Members
  const memberRows = gold('gold_members.csv');
  const existingMembers = await db.select({
    id: schema.members.id,
    memberKey: schema.members.memberKey,
    firstName: schema.members.firstName,
    lastName: schema.members.lastName,
    discord: schema.members.discord,
    graduationYear: schema.members.graduationYear,
    schoolId: schema.members.schoolId,
  }).from(schema.members).where(isNotNull(schema.members.memberKey));
  const existingMembersByKey = new Map(existingMembers.map((m) => [m.memberKey!, m]));
  let membersInsert = 0, membersUpdate = 0, membersUnchanged = 0;
  for (const m of memberRows) {
    const key = memberKeyOf(m);
    const ext = existingMembersByKey.get(key);
    if (!ext) {
      membersInsert++;
    } else if (
      ext.firstName !== m.first_name ||
      ext.lastName !== m.last_name ||
      ext.discord !== orNull(m.discord) ||
      ext.graduationYear !== intOrNull(m.graduation_year)
    ) {
      membersUpdate++;
    } else {
      membersUnchanged++;
    }
  }
  diffs.push({
    entity: 'members',
    incoming: memberRows.length,
    toInsert: membersInsert,
    toUpdate: membersUpdate,
    unchanged: membersUnchanged,
    toPrune: null,
  });

  // 7. Players
  const playerRows = gold('gold_players.csv');
  const existingPlayers = await db.select({
    rosterId: schema.players.rosterId,
    memberId: schema.players.memberId,
    role: schema.players.role,
    ign: schema.players.ign,
    bio: schema.players.bio,
    isCaptain: schema.players.isCaptain,
  }).from(schema.players);
  const existingPlayersByKey = new Map(
    existingPlayers.map((p) => [`${p.rosterId}|${p.memberId}`, p])
  );
  let playersInsert = 0, playersUpdate = 0, playersUnchanged = 0;
  for (const p of playerRows) {
    const member = existingMembersByKey.get(p.member_key);
    if (!member) {
      playersInsert++;
      continue;
    }
    // Search for roster key
    const school = existingSchoolsBySlug.get(p.school_slug);
    const game = existingGamesBySlug.get(p.game_slug);
    const seasonObj = game ? existingSeasonsByKey.get(`${game.id}|${p.season}`) : undefined;
    const teamId = (school && game && seasonObj)
      ? teamIdByKey.get(`${school.id}|${game.id}|${seasonObj.id}`)
      : undefined;
    const roster = teamId ? existingRostersByKey.get(`${teamId}|${p.division}`) : undefined;
    if (!roster) {
      playersInsert++;
      continue;
    }
    const ext = existingPlayersByKey.get(`${roster.id}|${member.id}`);
    if (!ext) {
      playersInsert++;
    } else if (
      ext.role !== p.role ||
      ext.ign !== orNull(p.ign) ||
      (!ext.bio && p.bio) ||
      ext.isCaptain !== (p.is_captain === 'True')
    ) {
      playersUpdate++;
    } else {
      playersUnchanged++;
    }
  }
  diffs.push({
    entity: 'players',
    incoming: playerRows.length,
    toInsert: playersInsert,
    toUpdate: playersUpdate,
    unchanged: playersUnchanged,
    toPrune: null,
  });

  // 8. Matches
  const matchRows = gold('gold_matches.csv');
  const sourceKeys = matchSourceKeys(matchRows);
  const existingMatches = await db.select({
    sourceKey: schema.matches.sourceKey,
    homeScore: schema.matches.homeScore,
    awayScore: schema.matches.awayScore,
    status: schema.matches.status,
    mvp: schema.matches.mvp,
    notes: schema.matches.notes,
  }).from(schema.matches).where(isNotNull(schema.matches.sourceKey));
  const existingMatchesByKey = new Map(existingMatches.map((m) => [m.sourceKey!, m]));
  let matchesInsert = 0, matchesUpdate = 0, matchesUnchanged = 0;
  for (let i = 0; i < matchRows.length; i++) {
    const m = matchRows[i];
    const key = sourceKeys[i];
    const ext = existingMatchesByKey.get(key);
    if (!ext) {
      matchesInsert++;
    } else if (
      ext.homeScore !== intOrNull(m.home_score) ||
      ext.awayScore !== intOrNull(m.away_score) ||
      ext.status !== m.status ||
      ext.mvp !== orNull(m.mvp) ||
      ext.notes !== orNull(m.notes)
    ) {
      matchesUpdate++;
    } else {
      matchesUnchanged++;
    }
  }
  const incomingMatchKeySet = new Set(sourceKeys);
  const matchesToPrune = existingMatches.filter((m) => !incomingMatchKeySet.has(m.sourceKey!)).length;
  diffs.push({
    entity: 'matches',
    incoming: matchRows.length,
    toInsert: matchesInsert,
    toUpdate: matchesUpdate,
    unchanged: matchesUnchanged,
    toPrune: matchesToPrune,
  });

  // 9. Season Standings
  const standingRows = gold('gold_standings.csv');
  const standingKeys = standingSourceKeys(standingRows);
  const existingStandings = await db.select({
    sourceKey: schema.seasonStandings.sourceKey,
    rank: schema.seasonStandings.rank,
    wins: schema.seasonStandings.wins,
    losses: schema.seasonStandings.losses,
    gamesPlayed: schema.seasonStandings.gamesPlayed,
    winPct: schema.seasonStandings.winPct,
    points: schema.seasonStandings.points,
    playerName: schema.seasonStandings.playerName,
    playerIgn: schema.seasonStandings.playerIgn,
    notes: schema.seasonStandings.notes,
  }).from(schema.seasonStandings).where(isNotNull(schema.seasonStandings.sourceKey));
  const existingStandingsByKey = new Map(existingStandings.map((s) => [s.sourceKey!, s]));
  let standingsInsert = 0, standingsUpdate = 0, standingsUnchanged = 0;
  for (let i = 0; i < standingRows.length; i++) {
    const s = standingRows[i];
    const key = standingKeys[i];
    const ext = existingStandingsByKey.get(key);
    if (!ext) {
      standingsInsert++;
    } else if (
      ext.rank !== intOrNull(s.rank) ||
      ext.wins !== intOrNull(s.wins) ||
      ext.losses !== intOrNull(s.losses) ||
      ext.gamesPlayed !== intOrNull(s.games_played) ||
      ext.points !== floatOrNull(s.points) ||
      ext.playerName !== orNull(s.player_name) ||
      ext.playerIgn !== orNull(s.player_ign) ||
      ext.notes !== orNull(s.notes)
    ) {
      standingsUpdate++;
    } else {
      standingsUnchanged++;
    }
  }
  const incomingStandingKeySet = new Set(standingKeys);
  const standingsToPrune = existingStandings.filter((s) => !incomingStandingKeySet.has(s.sourceKey!)).length;
  diffs.push({
    entity: 'season_standings',
    incoming: standingRows.length,
    toInsert: standingsInsert,
    toUpdate: standingsUpdate,
    unchanged: standingsUnchanged,
    toPrune: standingsToPrune,
  });

  return diffs;
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
  const dryRun = process.argv.includes('--dry-run');

  if (!dryRun) {
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
  }

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

  if (dryRun) {
    console.log('Inspecting database against gold archive (--dry-run)...');
    const diffs = await calculateGoldDiff(seasonRows, seasonFormats);
    console.log(formatGoldDiffTable(diffs));
    return;
  }

  console.log('Importing gold archive data...');

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
        bio: sql`coalesce(${schema.players.bio}, excluded.bio)`,
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

if (process.argv[1] && (process.argv[1].endsWith('seed-gold.ts') || process.argv[1].includes('seed-gold'))) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
