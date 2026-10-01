import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { canonicalGameSlug } from '../constants';

export const getCachedGames = unstable_cache(
  async () => {
    return db.select().from(schema.games);
  },
  ['games-list'],
  { tags: ['games'] }
);

export const getCachedSeasons = unstable_cache(
  async () => {
    return db.select().from(schema.seasons).where(eq(schema.seasons.isActive, true));
  },
  ['seasons-active'],
  { tags: ['seasons'] }
);

/** Uncached: all seasons (including inactive) for staff labels/lookups. */
export const getStaffSeasons = () => db.select().from(schema.seasons);

/** Uncached: all games and seasons for the admin league setup view. */
export async function getLeagueAdminData() {
  const [games, seasons] = await Promise.all([
    db.select().from(schema.games).orderBy(schema.games.displayName),
    db.select().from(schema.seasons).orderBy(schema.seasons.gameId, schema.seasons.name),
  ]);
  return { games, seasons };
}

/** Seasons joined with their game, newest season first within each game. */
export const getSeasonsWithGames = unstable_cache(
  async () => {
    const rows = await db
      .select({
        id: schema.seasons.id,
        name: schema.seasons.name,
        isActive: schema.seasons.isActive,
        gameId: schema.games.id,
        gameSlug: schema.games.slug,
        gameName: schema.games.displayName,
      })
      .from(schema.seasons)
      .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
      .orderBy(asc(schema.games.slug), desc(schema.seasons.name));

    return rows.map((r) => ({
      ...r,
      gameSlug: canonicalGameSlug(r.gameSlug),
    }));
  },
  ['seasons-with-games'],
  { tags: ['seasons', 'games'] }
);


/**
 * Resolves the single active season for a game, or null if none is active.
 * Enforces the invariant that at most one season per game can be active.
 */
export async function getActiveSeasonForGame(gameId: string) {
  const rows = await db
    .select()
    .from(schema.seasons)
    .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createGameInDb(values: {
  displayName: string;
  shortName: string;
  slug: string;
  imageUrl?: string | null;
}) {
  const res = await db.insert(schema.games).values(values).returning();
  return res[0];
}

export async function updateGameInDb(
  id: string,
  values: { displayName: string; shortName: string; imageUrl?: string | null }
) {
  const res = await db
    .update(schema.games)
    .set(values)
    .where(eq(schema.games.id, id))
    .returning();
  return res[0];
}

export async function deleteGameInDb(id: string) {
  await db.delete(schema.games).where(eq(schema.games.id, id));
}

export async function createSeasonInDb(values: {
  gameId: string;
  name: string;
  isActive: boolean;
  standingsFormat?: 'divided' | 'combined';
}) {
  return await db.transaction(async (tx) => {
    if (values.isActive) {
      // Invariant: at most one active season per game. Retire other active seasons for this game.
      await tx
        .update(schema.seasons)
        .set({ isActive: false })
        .where(and(eq(schema.seasons.gameId, values.gameId), eq(schema.seasons.isActive, true)));
    }
    const res = await tx.insert(schema.seasons).values(values).returning();
    return res[0];
  });
}

export async function updateSeasonInDb(
  id: string,
  values: {
    name?: string;
    isActive?: boolean;
    standingsFormat?: 'divided' | 'combined';
  }
) {
  return await db.transaction(async (tx) => {
    if (values.isActive) {
      const current = await tx
        .select({ gameId: schema.seasons.gameId })
        .from(schema.seasons)
        .where(eq(schema.seasons.id, id))
        .limit(1);

      if (current[0]) {
        // Invariant: at most one active season per game. Retire other active seasons for this game.
        await tx
          .update(schema.seasons)
          .set({ isActive: false })
          .where(
            and(
              eq(schema.seasons.gameId, current[0].gameId),
              eq(schema.seasons.isActive, true),
              sql`${schema.seasons.id} <> ${id}`
            )
          );
      }
    }

    const res = await tx
      .update(schema.seasons)
      .set(values)
      .where(eq(schema.seasons.id, id))
      .returning();
    return res[0];
  });
}

export async function deleteSeasonInDb(id: string) {
  const matchCount = await db
    .select({ count: count() })
    .from(schema.matches)
    .where(eq(schema.matches.seasonId, id));

  if ((matchCount[0]?.count ?? 0) > 0) {
    throw new Error('Cannot delete season with existing matches. Please reassign or delete matches first.');
  }

  await db.delete(schema.seasons).where(eq(schema.seasons.id, id));
}
