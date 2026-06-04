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

export const getCachedTeams = unstable_cache(
  async () => {
    return db.select().from(schema.teams);
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
    return db.select().from(schema.rosters);
  },
  ['rosters-list'],
  { tags: ['rosters'] }
);

export const getCachedNews = unstable_cache(
  async () => {
    return db.select().from(schema.newsPosts).orderBy(desc(schema.newsPosts.publishedAt));
  },
  ['news-list'],
  { tags: ['news'] }
);
