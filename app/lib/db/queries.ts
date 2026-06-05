import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { desc, eq } from 'drizzle-orm';

export const getCachedGames = unstable_cache(
  async () => {
    return db.select().from(schema.games);
  },
  ['games-list'],
  { tags: ['games'] }
);

export const getCachedSchools = unstable_cache(
  async () => {
    return db.select().from(schema.schools);
  },
  ['schools-list'],
  { tags: ['schools'] }
);

export const getCachedMembers = unstable_cache(
  async () => {
    return db.select().from(schema.members);
  },
  ['members-list'],
  { tags: ['members'] }
);

export const getCachedTeams = unstable_cache(
  async () => {
    return db
      .select({
        id: schema.teams.id,
        schoolId: schema.teams.schoolId,
        gameId: schema.teams.gameId,
        seasonId: schema.teams.seasonId,
        createdAt: schema.teams.createdAt,
        updatedAt: schema.teams.updatedAt,
        name: schema.schools.name,
      })
      .from(schema.teams)
      .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id));
  },
  ['teams-list'],
  { tags: ['teams'] }
);

export const getCachedSeasons = unstable_cache(
  async () => {
    return db.select().from(schema.seasons).where(eq(schema.seasons.isActive, true));
  },
  ['seasons-active'],
  { tags: ['seasons'] }
);

export const getCachedMatches = unstable_cache(
  async () => {
    return db.select().from(schema.matches).orderBy(desc(schema.matches.scheduledAt));
  },
  ['matches-list'],
  { tags: ['matches'] }
);

export const getCachedRosters = unstable_cache(
  async () => {
    return db.select().from(schema.rosterStandings);
  },
  ['rosters-list'],
  { tags: ['rosters'] }
);

export const getCachedPlayers = unstable_cache(
  async () => {
    return db.select().from(schema.players);
  },
  ['players-list'],
  { tags: ['players'] }
);

export const getCachedNews = unstable_cache(
  async () => {
    return db.select().from(schema.newsPosts).orderBy(desc(schema.newsPosts.publishedAt));
  },
  ['news-list'],
  { tags: ['news'] }
);

export const getCachedLeadership = unstable_cache(
  async () => {
    return db.select().from(schema.leadership).orderBy(desc(schema.leadership.year));
  },
  ['leadership-list'],
  { tags: ['leadership'] }
);
