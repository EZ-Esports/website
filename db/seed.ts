/**
 * Database seed / archival import.
 *
 * Imports two archived CSV exports living at the repo root:
 *   - "complete_matches_valorant 2022-26.csv"  -> schools, seasons, teams, rosters, matches
 *   - "staff_completeroster.csv"               -> leadership
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
 * Idempotent: clears the tables it owns before re-importing. Phase-2 CMS tables
 * (sponsors, gallery, page content) are managed by seed-phase2.ts and untouched.
 */
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { buildImportPlan, readRecords, slugify, MATCHES_CSV, STAFF_CSV } from './import-archive';

async function main() {
  console.log('Importing archived data...');

  const plan = buildImportPlan(readRecords(MATCHES_CSV), readRecords(STAFF_CSV));

  // 1. Wipe data owned by this seed (FK-safe order).
  console.log('Clearing existing data...');
  await db.delete(schema.newsPosts);
  await db.delete(schema.leadership);
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

  // 8. Leadership.
  console.log(`Seeding ${plan.leadership.length} leadership records...`);
  await db.insert(schema.leadership).values(plan.leadership.map((l) => ({ memberId: null, ...l })));

  console.log('\nImport complete:');
  console.log(`  games:       ${games.length}`);
  console.log(`  schools:     ${schools.length}`);
  console.log(`  seasons:     ${seasons.length}`);
  console.log(`  teams:       ${teamRows.length}`);
  console.log(`  rosters:     ${rosterRows.length}`);
  console.log(`  matches:     ${plan.matches.length}`);
  console.log(`  leadership:  ${plan.leadership.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
