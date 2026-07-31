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
 * Idempotent: wipes the tables it owns before re-importing. It does NOT
 * touch leadership (managed by the staff import), news_posts, or the
 * phase-2 CMS tables (sponsors, gallery, page content, admin/auth).
 *
 * CAUTION: re-importing regenerates every row's UUID, so any Next.js
 * unstable_cache entries (seasons, games, schools, ...) go stale until the
 * cache is flushed — locally delete .next/, in production redeploy.
 *
 * Run: npm run db:seed:gold
 */
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { readRecords } from './import-archive';

const GOLD_DIR = 'sharepoint/gold_data';

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
 * Called once per row from step 0, BEFORE the wipe — see the comment there. It
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

async function main() {
  console.log('Importing gold archive data...');

  // 0. Read and validate the one CSV this loader can reject, before anything is
  //    deleted. Step 1 wipes the whole archive, so a standings_format this
  //    script refuses to guess at has to fail here: a stale gold_seasons.csv is
  //    the normal state of a fresh clone (gold_data/ is gitignored), and failing
  //    after the wipe would leave the live site with zero seasons, matches,
  //    standings, rosters and players. The validated values are carried down to
  //    step 4 rather than re-derived there, so there is only one call site to
  //    keep in front of the deletes.
  const seasonRows = gold('gold_seasons.csv');
  const seasonFormats = seasonRows.map(standingsFormatOf);

  // 1. Wipe owned tables (FK-safe order). leadership/news/CMS untouched;
  //    leadership.member_id is null for all rows, so wiping members is safe.
  console.log('Clearing existing data...');
  await db.delete(schema.seasonStandings);
  await db.delete(schema.matches);
  await db.delete(schema.players);
  await db.delete(schema.rosters);
  await db.delete(schema.teams);
  await db.delete(schema.seasons);
  await db.delete(schema.members);
  await db.delete(schema.schools);
  await db.delete(schema.games);

  // 2. Games.
  const gameRows = gold('gold_games.csv');
  const games = await db
    .insert(schema.games)
    .values(gameRows.map((g) => ({
      slug: g.slug,
      displayName: g.display_name,
      shortName: g.short_name,
      imageUrl: g.image_url,
    })))
    .returning();
  const gameBySlug = new Map(games.map((g) => [g.slug, g]));
  console.log(`  games:            ${games.length}`);

  // 3. Schools.
  const schoolRows = gold('gold_schools.csv');
  const schools = await db
    .insert(schema.schools)
    .values(schoolRows.map((s) => ({
      slug: s.slug,
      name: s.name,
      displayOrder: parseInt(s.display_order, 10),
    })))
    .returning();
  const schoolBySlug = new Map(schools.map((s) => [s.slug, s]));
  console.log(`  schools:          ${schools.length}`);

  // 4. Seasons — keyed `${gameSlug}|${name}`. Rows and formats both come from
  //    step 0, already validated.
  const seasons = await db
    .insert(schema.seasons)
    .values(seasonRows.map((s, i) => ({
      gameId: gameBySlug.get(s.game_slug)!.id,
      name: s.name,
      isActive: s.is_active === 'True',
      standingsFormat: seasonFormats[i],
    })))
    .returning();
  const seasonByKey = new Map<string, { id: string }>();
  seasonRows.forEach((s, i) => seasonByKey.set(`${s.game_slug}|${s.name}`, seasons[i]));
  console.log(`  seasons:          ${seasons.length}`);

  // 5. Teams — distinct (school, game, season) derived from rosters.
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
    .returning();
  const teamByKey = new Map(teamKeys.map((key, i) => [key, teams[i]]));
  console.log(`  teams:            ${teams.length}`);

  // 6. Rosters — name doubles as the division label (site convention).
  const rosters = await db
    .insert(schema.rosters)
    .values(rosterRows.map((r) => ({
      teamId: teamByKey.get(`${r.season}|${r.game_slug}|${r.school_slug}`)!.id,
      name: r.division,
      division: r.division,
    })))
    .returning();
  const rosterByKey = new Map<string, { id: string }>();
  rosterRows.forEach((r, i) =>
    rosterByKey.set(rosterKey(r.season, r.game_slug, r.school_slug, r.division), rosters[i])
  );
  console.log(`  rosters:          ${rosters.length}`);

  // 7. Members (already deduped across seasons/games by the normalizer).
  const memberRows = gold('gold_members.csv');
  const members = await db
    .insert(schema.members)
    .values(memberRows.map((m) => ({
      firstName: m.first_name,
      lastName: m.last_name,
      discord: orNull(m.discord),
      graduationYear: intOrNull(m.graduation_year),
      schoolId: schoolBySlug.get(m.school_slug)!.id,
    })))
    .returning();
  const memberByKey = new Map<string, { id: string }>();
  memberRows.forEach((m, i) => memberByKey.set(m.member_key, members[i]));
  console.log(`  members:          ${members.length}`);

  // 8. Players.
  const playerRows = gold('gold_players.csv');
  await db.insert(schema.players).values(playerRows.map((p) => ({
    rosterId: rosterByKey.get(rosterKey(p.season, p.game_slug, p.school_slug, p.division))!.id,
    memberId: memberByKey.get(p.member_key)!.id,
    role: p.role as (typeof schema.playerRoleEnum.enumValues)[number],
    ign: orNull(p.ign),
    bio: orNull(p.bio),
    isCaptain: p.is_captain === 'True',
  })));
  console.log(`  players:          ${playerRows.length}`);

  // 9. Matches. Each side resolves its own roster — cross-division matches
  //    exist (e.g. 2023-24 LoL ran Midwood Varsity vs Midwood JV).
  const matchRows = gold('gold_matches.csv');
  await db.insert(schema.matches).values(matchRows.map((m) => ({
    seasonId: seasonByKey.get(`${m.game_slug}|${m.season}`)!.id,
    homeRosterId: rosterByKey.get(rosterKey(m.season, m.game_slug, m.home_school_slug, m.home_division))!.id,
    awayRosterId: rosterByKey.get(rosterKey(m.season, m.game_slug, m.away_school_slug, m.away_division))!.id,
    scheduledAt: parseEastern(m.scheduled_at),
    homeScore: intOrNull(m.home_score),
    awayScore: intOrNull(m.away_score),
    status: m.status as (typeof schema.matchStatusEnum.enumValues)[number],
    mvp: orNull(m.mvp),
    notes: orNull(m.notes),
  })));
  console.log(`  matches:          ${matchRows.length}`);

  // 10. Season standings snapshots.
  const standingRows = gold('gold_standings.csv');
  await db.insert(schema.seasonStandings).values(standingRows.map((s) => ({
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
  })));
  console.log(`  season_standings: ${standingRows.length}`);

  console.log('Import complete.');
  console.log('');
  console.log('  NEXT STEP — every row above has a NEW uuid, so every cached query');
  console.log('  now holds primary keys that no longer exist. Until they are retired');
  console.log('  the standings page renders "No standings recorded for this season');
  console.log('  and division yet." for every game and every season, and logs nothing.');
  console.log('');
  console.log('    Bump CACHE_EPOCH in app/lib/db/queries.ts, then deploy.');
  console.log('');
  console.log('  Redeploying alone does NOT clear this on Vercel: the Data Cache is');
  console.log('  infrastructure rather than build output, and outlives a deployment.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
