import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';

async function main() {
  console.log('Seeding started...');

  // 1. Clear existing data (in order of dependencies)
  console.log('Clearing old data...');
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

  // 2. Seed Games
  console.log('Seeding games...');
  const insertedGames = await db
    .insert(schema.games)
    .values([
      {
        slug: 'valorant',
        displayName: 'Valorant',
        shortName: 'VAL',
        imageUrl: '/images/games/val-banner.png',
      },
      {
        slug: 'league-of-legends',
        displayName: 'League of Legends',
        shortName: 'LoL',
        imageUrl: '/images/games/lol-banner.png',
      },
      {
        slug: 'team-fight-tactics',
        displayName: 'Teamfight Tactics',
        shortName: 'TFT',
        imageUrl: '/images/games/tft-banner.png',
      },
    ])
    .returning();

  const valorantDb = insertedGames.find((g: any) => g.slug === 'valorant')!;
  const lolDb = insertedGames.find((g: any) => g.slug === 'league-of-legends')!;
  const tftDb = insertedGames.find((g: any) => g.slug === 'team-fight-tactics')!;

  // 3. Seed Schools
  console.log('Seeding schools...');
  const insertedSchools = await db
    .insert(schema.schools)
    .values([
      { name: 'Stuyvesant', slug: 'stuyvesant', logoUrl: '/images/logos/stuy.png' },
      { name: 'Bronx Science', slug: 'bronx-science', logoUrl: '/images/logos/bx-science.png' },
      { name: 'Brooklyn Tech', slug: 'brooklyn-tech', logoUrl: '/images/logos/bk-tech.png' },
      { name: 'Midwood', slug: 'midwood', logoUrl: '/images/logos/midwood.png' },
      { name: 'Staten Island Tech', slug: 'staten-island-tech', logoUrl: '/images/logos/sit.png' },
    ])
    .returning();

  const stuy = insertedSchools.find((s: any) => s.slug === 'stuyvesant')!;
  const bxSci = insertedSchools.find((s: any) => s.slug === 'bronx-science')!;

  // 4. Seed Members (People)
  console.log('Seeding members...');
  const insertedMembers = await db.insert(schema.members).values([
    { firstName: 'Alex', lastName: 'Chen', schoolId: stuy.id, discord: 'alex#1234', graduationYear: 2026 },
    { firstName: 'Sam', lastName: 'Wu', schoolId: stuy.id, discord: 'sam#5678', graduationYear: 2025 },
    { firstName: 'Emily', lastName: 'Li', schoolId: stuy.id, discord: 'emily#9012', graduationYear: 2027 },
    { firstName: 'Brian', lastName: 'Zhang', schoolId: stuy.id, discord: 'brian#3456', graduationYear: 2026 },
    { firstName: 'Jane', lastName: 'Smith', schoolId: bxSci.id, discord: 'jane#7890', graduationYear: 2025 },
  ]).returning();

  const alex = insertedMembers.find((m: any) => m.firstName === 'Alex')!;
  const brian = insertedMembers.find((m: any) => m.firstName === 'Brian')!;

  // 5. Seed Seasons
  console.log('Seeding seasons...');
  const insertedSeasons = await db
    .insert(schema.seasons)
    .values([
      { gameId: valorantDb.id, name: 'Spring 2025', isActive: true },
      { gameId: lolDb.id, name: 'Spring 2025', isActive: true },
      { gameId: tftDb.id, name: 'Spring 2025', isActive: true },
    ])
    .returning();

  const valSeason = insertedSeasons.find((s: any) => s.gameId === valorantDb.id)!;
  const lolSeason = insertedSeasons.find((s: any) => s.gameId === lolDb.id)!;

  // 6. Seed Teams (School-Game-Season link)
  console.log('Seeding teams...');
  const insertedTeams = await db.insert(schema.teams).values([
    { schoolId: stuy.id, gameId: valorantDb.id, seasonId: valSeason.id },
    { schoolId: stuy.id, gameId: lolDb.id, seasonId: lolSeason.id },
    { schoolId: bxSci.id, gameId: valorantDb.id, seasonId: valSeason.id },
  ]).returning();

  const stuyValTeam = insertedTeams.find((t: any) => t.schoolId === stuy.id && t.gameId === valorantDb.id)!;
  const stuyLolTeam = insertedTeams.find((t: any) => t.schoolId === stuy.id && t.gameId === lolDb.id)!;

  // 7. Seed Rosters
  console.log('Seeding rosters...');
  const insertedRosters = await db.insert(schema.rosters).values([
    { teamId: stuyValTeam.id, name: 'Varsity', division: 'A' },
    { teamId: stuyLolTeam.id, name: 'Varsity', division: 'A' },
  ]).returning();

  const stuyValVarsity = insertedRosters.find((r: any) => r.teamId === stuyValTeam.id)!;
  const stuyLolVarsity = insertedRosters.find((r: any) => r.teamId === stuyLolTeam.id)!;

  // 8. Seed Players (Members in Rosters)
  console.log('Seeding players...');
  await db.insert(schema.players).values([
    { rosterId: stuyValVarsity.id, memberId: alex.id, role: 'captain' as any, ign: 'AlexVAL' },
    { rosterId: stuyLolVarsity.id, memberId: brian.id, role: 'captain' as any, ign: 'BrianLoL' },
  ]);

  // 9. Matches
  console.log('Seeding matches...');
  await db.insert(schema.matches).values([
    {
      seasonId: valSeason.id,
      homeRosterId: stuyValVarsity.id,
      awayRosterId: stuyValVarsity.id, // In seed we can just simulate
      scheduledAt: new Date(),
      status: 'scheduled' as any,
    }
  ]);

  console.log('Seed complete!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
