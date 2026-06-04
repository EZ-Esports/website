import { loadEnvConfig } from '@next/env';
// Load env variables before importing database modules
loadEnvConfig(process.cwd());

async function seed() {
  console.log('🌱 Start seeding database...');

  const { db } = await import('../app/lib/db');
  const schema = await import('../app/lib/db/schema');

  // Check if data is already seeded to prevent duplicating or overwriting active data
  try {
    const existingGames = await db.select().from(schema.games).limit(1);
    if (existingGames.length > 0) {
      console.log('⚠️ Database already contains games. Skipping seed to prevent duplicating data.');
      process.exit(0);
    }
  } catch {
    // If table doesn't exist, we let it fail or log it
    console.log('Checking database status... (Tables might not be pushed yet)');
  }

  // 2. Insert Games
  console.log('Seeding games...');
  const insertedGames = await db
    .insert(schema.games)
    .values([
      {
        slug: 'valorant',
        displayName: 'Valorant',
        shortName: 'Valorant',
        imageUrl: '/images/games/val-banner.png',
      },
      {
        slug: 'league-of-legends',
        displayName: 'League of Legends',
        shortName: 'League',
        imageUrl: '/images/games/lol-banner.png',
      },
      {
        slug: 'team-fight-tactics',
        displayName: 'Team fight tactics',
        shortName: 'TFT',
        imageUrl: '/images/games/tft-banner.png',
      },
    ])
    .returning();

  const valorantDb = insertedGames.find((g) => g.slug === 'valorant')!;
  const lolDb = insertedGames.find((g) => g.slug === 'league-of-legends')!;
  const tftDb = insertedGames.find((g) => g.slug === 'team-fight-tactics')!;

  // 3. Insert Active Seasons
  console.log('Seeding seasons...');
  const insertedSeasons = await db
    .insert(schema.seasons)
    .values([
      { gameId: valorantDb.id, name: 'Spring 2025', isActive: true },
      { gameId: lolDb.id, name: 'Spring 2025', isActive: true },
      { gameId: tftDb.id, name: 'Spring 2025', isActive: true },
    ])
    .returning();

  const valSeason = insertedSeasons.find((s) => s.gameId === valorantDb.id)!;
  const lolSeason = insertedSeasons.find((s) => s.gameId === lolDb.id)!;

  // 4. Insert Teams (e.g. Stuyvesant, Bronx Science, Brooklyn Tech, Midwood, Staten Island Tech)
  console.log('Seeding teams...');
  const insertedTeams = await db
    .insert(schema.teams)
    .values([
      // Valorant
      { gameId: valorantDb.id, name: 'Stuyvesant', division: 'Varsity', wins: 12, losses: 3 },
      { gameId: valorantDb.id, name: 'Bronx Science', division: 'Varsity', wins: 11, losses: 4 },
      { gameId: valorantDb.id, name: 'Brooklyn Tech', division: 'Varsity', wins: 10, losses: 5 },
      { gameId: valorantDb.id, name: 'Midwood', division: 'Varsity', wins: 9, losses: 6 },
      { gameId: valorantDb.id, name: 'Staten Island Tech', division: 'Varsity', wins: 8, losses: 7 },

      // League
      { gameId: lolDb.id, name: 'Bronx Science', division: 'Varsity', wins: 13, losses: 2 },
      { gameId: lolDb.id, name: 'Stuyvesant', division: 'Varsity', wins: 10, losses: 5 },
      { gameId: lolDb.id, name: 'Brooklyn Tech', division: 'Varsity', wins: 9, losses: 6 },
      { gameId: lolDb.id, name: 'Midwood', division: 'Varsity', wins: 8, losses: 7 },
      { gameId: lolDb.id, name: 'Staten Island Tech', division: 'Varsity', wins: 7, losses: 8 },

      // TFT
      { gameId: tftDb.id, name: 'Midwood', division: 'Varsity', wins: 11, losses: 4 },
      { gameId: tftDb.id, name: 'Stuyvesant', division: 'Varsity', wins: 9, losses: 6 },
      { gameId: tftDb.id, name: 'Brooklyn Tech', division: 'Varsity', wins: 8, losses: 7 },
      { gameId: tftDb.id, name: 'Bronx Science', division: 'Varsity', wins: 7, losses: 8 },
      { gameId: tftDb.id, name: 'Staten Island Tech', division: 'Varsity', wins: 6, losses: 9 },
    ])
    .returning();

  // Get specific team records for matching
  const stuyVal = insertedTeams.find((t) => t.gameId === valorantDb.id && t.name === 'Stuyvesant')!;
  const bxSciVal = insertedTeams.find((t) => t.gameId === valorantDb.id && t.name === 'Bronx Science')!;
  const bkTechVal = insertedTeams.find((t) => t.gameId === valorantDb.id && t.name === 'Brooklyn Tech')!;
  const midwoodVal = insertedTeams.find((t) => t.gameId === valorantDb.id && t.name === 'Midwood')!;

  const stuyLol = insertedTeams.find((t) => t.gameId === lolDb.id && t.name === 'Stuyvesant')!;
  const bkTechLol = insertedTeams.find((t) => t.gameId === lolDb.id && t.name === 'Brooklyn Tech')!;
  const midwoodLol = insertedTeams.find((t) => t.gameId === lolDb.id && t.name === 'Midwood')!;

  // 5. Seeding sample match rosters
  console.log('Seeding team rosters...');
  await db.insert(schema.rosters).values([
    // Stuyvesant Valorant Roster
    { teamId: stuyVal.id, name: 'Alex Chen', role: 'Captain', bio: 'Dual duelist specialist. Focuses on entry routing.' },
    { teamId: stuyVal.id, name: 'Sam Wu', role: 'Player', bio: 'Initiator/Controller player.' },
    { teamId: stuyVal.id, name: 'Emily Li', role: 'Player', bio: 'Sentinel main. Keeps sites locked down.' },
    { teamId: stuyVal.id, name: 'Leo Lopez', role: 'Player', bio: 'Flex player.' },
    { teamId: stuyVal.id, name: 'Jason Kim', role: 'Player', bio: 'Controller main.' },

    // Stuyvesant LoL Roster
    { teamId: stuyLol.id, name: 'Brian Zhang', role: 'Captain', bio: 'Mid lane main. Enjoys control mages.' },
    { teamId: stuyLol.id, name: 'Kevin Wang', role: 'Player', bio: 'Jungle main. Focuses on objective control.' },
    { teamId: stuyLol.id, name: 'Chloe Ho', role: 'Player', bio: 'Support main. Specializes in enchanters.' },
  ]);

  // 6. Seeding matches
  console.log('Seeding matches...');
  const nextSaturday = new Date();
  nextSaturday.setDate(nextSaturday.getDate() + (6 - nextSaturday.getDay()));
  nextSaturday.setHours(15, 0, 0, 0); // 3 PM

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  await db.insert(schema.matches).values([
    // Valorant Matches
    {
      seasonId: valSeason.id,
      homeTeamId: stuyVal.id,
      awayTeamId: bxSciVal.id,
      scheduledAt: nextSaturday,
      status: 'scheduled',
    },
    {
      seasonId: valSeason.id,
      homeTeamId: stuyVal.id,
      awayTeamId: bkTechVal.id,
      scheduledAt: oneWeekAgo,
      homeScore: 2,
      awayScore: 0,
      status: 'completed',
    },
    {
      seasonId: valSeason.id,
      homeTeamId: stuyVal.id,
      awayTeamId: midwoodVal.id,
      scheduledAt: twoWeeksAgo,
      homeScore: 2,
      awayScore: 1,
      status: 'completed',
    },

    // LoL Matches
    {
      seasonId: lolSeason.id,
      homeTeamId: stuyLol.id,
      awayTeamId: bkTechLol.id,
      scheduledAt: nextSaturday,
      status: 'scheduled',
    },
    {
      seasonId: lolSeason.id,
      homeTeamId: stuyLol.id,
      awayTeamId: midwoodLol.id,
      scheduledAt: oneWeekAgo,
      homeScore: 2,
      awayScore: 0,
      status: 'completed',
    },
  ]);

  // 7. Seeding News Posts
  console.log('Seeding news posts...');
  await db.insert(schema.newsPosts).values([
    {
      title: 'Spring 2025 Season Kicks Off',
      slug: 'spring-2025-season-kicks-off',
      excerpt: 'The Spring 2025 season has officially begun with record participation across all three games.',
      content: 'We are thrilled to launch the Spring 2025 season of the NYC High School Esports League! This season features over 15 participating schools competing across Valorant, League of Legends, and Teamfight Tactics. Good luck to all teams!',
      category: 'Announcement',
    },
    {
      title: 'Championship Tournament Dates Announced',
      slug: 'championship-tournament-dates-announced',
      excerpt: 'Mark your calendars! The championship tournament will take place on May 15-17, 2025.',
      content: 'The postseason championship tournament will bring together the top teams from each division in a live, in-person bracket. Matches will run from May 15th to 17th. Further details about the venue and stream coverage will be released next month.',
      category: 'Tournament',
    },
    {
      title: 'New Streaming Partnership',
      slug: 'new-streaming-partnership',
      excerpt: 'We are excited to announce a new partnership that will enhance our live streaming capabilities.',
      content: 'Thanks to our new partnership, we will now feature multi-cast coverage of match of the week broadcasts, fully equipped with overlay overlays, high-fidelity feeds, and student shoutcasters from across the league.',
      category: 'Partnership',
    },
  ]);

  console.log('✅ Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
