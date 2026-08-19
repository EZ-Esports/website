/**
 * Database seed / archival import.
 *
 * Imports two archived CSV exports living at the repo root:
 *   - "complete_matches_valorant 2022-26.csv"  -> schools, seasons, teams, rosters, matches
 *   - "staff_completeroster.csv"               -> leadership
 *
 * REQUIRED INPUT: both CSV files must be present at the repo root for this seed
 * to run. They are gitignored (member PII, public repo), so they are NOT in the
 * repository — obtain them out-of-band and drop them in before `npm run db:seed`.
 *
 * Design notes
 * ------------
 * 1. The match CSV is schedule-only (no scores), so every match lands as
 *    `scheduled` with null scores. Standings will read 0-0 until results exist.
 * 2. The CSV's competitive divisions A/B are mapped to the league labels the
 *    public pages filter on: A -> "Varsity", B -> "JV".
 * 3. staff_completeroster.csv is organizational staff, not game competitors, so
 *    it populates the `leadership` table (memberId left null). The season label
 *    (e.g. "2022-23") is collapsed to its start year (e.g. "2022") because the
 *    leadership routing round-trips the value through parseInt() then string
 *    equality.
 *
 * Pure parsing/transform logic lives in import-archive.ts (unit-tested there).
 * Clears the tables it owns before re-importing. Phase-2 CMS tables (sponsors,
 * gallery, page content) are managed by seed-phase2.ts and untouched.
 *
 * DESTRUCTIVE, and more so than db/seed:gold: it wipes leadership, schools and
 * games as well, and regenerates every UUID it re-inserts. Step 0 takes a
 * verified backup first and aborts the run if it cannot get one.
 */
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { requireFreshBackup } from './backup';
import { assertSeedTargetAllowed } from './seed-target';
import { mergeLeadership } from './leadership-merge';
import { buildImportPlan, readRecords, slugify, MATCHES_CSV, STAFF_CSV } from './import-archive';

/** Every table this seed deletes (step 1 below), scoping the pre-seed backup. */
const SEED_TABLES = [
  'news_posts', 'matches', 'players', 'rosters',
  'teams', 'seasons', 'members', 'schools', 'games',
] as const;

async function main() {
  console.log('Importing archived data...');

  // 0a. Refuse a database this seed has no business wiping — before spending a
  //     minute dumping one it is only going to refuse to touch. Loopback runs
  //     freely; anything else has to be named in SEED_ALLOW_REMOTE.
  assertSeedTargetAllowed();

  // 0b. Back up, before a CSV is read or a row is deleted. This seed is
  //     one letter away from `db:seed:gold` in package.json and deletes strictly
  //     more than it does. requireFreshBackup throws unless a complete dump is
  //     on disk, which aborts the run here.
  requireFreshBackup(SEED_TABLES);

  const plan = buildImportPlan(readRecords(MATCHES_CSV), readRecords(STAFF_CSV));

  // 1. Wipe data owned by this seed (FK-safe order).
  //
  //    leadership is deliberately NOT in this list, though it used to be. It is
  //    not this seed's data: it is authored in the admin editor, its rows carry
  //    bios and member links that exist in no CSV, and wiping it is how 70 rows
  //    were destroyed with no backup to restore them from. Step 8 merges into it
  //    instead, which is also what makes re-running this seed safe for it.
  console.log('Clearing existing data...');
  await db.delete(schema.newsPosts);
  await db.delete(schema.matches);
  await db.delete(schema.players);
  await db.delete(schema.rosters);
  await db.delete(schema.teams);
  await db.delete(schema.seasons);
  await db.delete(schema.members);
  await db.delete(schema.schools);
  await db.delete(schema.games);

  // 2. Games. Keep the full game roster so the other game pages render;
  //    only Valorant has archived data attached.
  console.log('Seeding games...');
  const games = await db
    .insert(schema.games)
    .values([
      { slug: 'valorant', displayName: 'Valorant', shortName: 'VAL', imageUrl: '/images/games/val-banner.png' },
      { slug: 'league-of-legends', displayName: 'League of Legends', shortName: 'LoL', imageUrl: '/images/games/lol-banner.png' },
      { slug: 'team-fight-tactics', displayName: 'Teamfight Tactics', shortName: 'TFT', imageUrl: '/images/games/tft-banner.png' },
    ])
    .returning();
  const valorant = games.find((g) => g.slug === 'valorant')!;

  // 3. Schools.
  console.log(`Seeding ${plan.schoolNames.length} schools...`);
  const schools = await db
    .insert(schema.schools)
    .values(plan.schoolNames.map((name, i) => ({ name, slug: slugify(name), displayOrder: i })))
    .returning();
  const schoolByName = new Map(schools.map((s) => [s.name, s]));

  // 4. Seasons (Valorant).
  console.log(`Seeding ${plan.seasonNames.length} seasons...`);
  const seasons = await db
    .insert(schema.seasons)
    .values(plan.seasonNames.map((name) => ({ gameId: valorant.id, name, isActive: name === plan.latestSeason })))
    .returning();
  const seasonByName = new Map(seasons.map((s) => [s.name, s]));

  // 5. Teams — keyed `${season}|${school}`.
  console.log(`Seeding ${plan.teamKeys.length} teams...`);
  const teamByKey = new Map<string, { id: string }>();
  const teamRows = await db
    .insert(schema.teams)
    .values(
      plan.teamKeys.map((key) => {
        const [seasonName, schoolName] = key.split('|');
        return {
          schoolId: schoolByName.get(schoolName)!.id,
          gameId: valorant.id,
          seasonId: seasonByName.get(seasonName)!.id,
        };
      })
    )
    .returning();
  plan.teamKeys.forEach((key, i) => teamByKey.set(key, teamRows[i]));

  // 6. Rosters — keyed `${season}|${school}|${division}`.
  console.log(`Seeding ${plan.rosterKeys.length} rosters...`);
  const rosterByKey = new Map<string, { id: string }>();
  const rosterRows = await db
    .insert(schema.rosters)
    .values(
      plan.rosterKeys.map((key) => {
        const lastSep = key.lastIndexOf('|');
        const teamKey = key.slice(0, lastSep);
        const division = key.slice(lastSep + 1);
        return { teamId: teamByKey.get(teamKey)!.id, name: division, division };
      })
    )
    .returning();
  plan.rosterKeys.forEach((key, i) => rosterByKey.set(key, rosterRows[i]));

  // 7. Matches (schedule-only -> scheduled, null scores).
  console.log(`Seeding ${plan.matches.length} matches...`);
  await db.insert(schema.matches).values(
    plan.matches.map((m) => ({
      seasonId: seasonByName.get(m.seasonName)!.id,
      homeRosterId: rosterByKey.get(m.homeRosterKey)!.id,
      awayRosterId: rosterByKey.get(m.awayRosterKey)!.id,
      scheduledAt: m.scheduledAt,
      status: 'scheduled' as const,
    }))
  );

  // 8. Leadership — merged, not replaced. See step 1 for why it is not wiped.
  console.log(`Merging ${plan.leadership.length} leadership records...`);
  const merged = await mergeLeadership(plan.leadership);
  for (const note of merged.notes) console.log(`  note: ${note}`);

  console.log('\nImport complete:');
  console.log(`  games:       ${games.length}`);
  console.log(`  schools:     ${schools.length}`);
  console.log(`  seasons:     ${seasons.length}`);
  console.log(`  teams:       ${teamRows.length}`);
  console.log(`  rosters:     ${rosterRows.length}`);
  console.log(`  matches:     ${plan.matches.length}`);
  console.log(
    `  leadership:  ${merged.inserted} added, ${merged.updated} bios filled, ` +
      `${merged.skipped} left as they were`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
