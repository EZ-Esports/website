import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { canonicalGameSlug } from '../constants';
import { areOutcomesPublic } from '../season-outcomes';

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
        outcomesFinalizedAt: schema.seasons.outcomesFinalizedAt,
        gameId: schema.games.id,
        gameSlug: schema.games.slug,
        gameName: schema.games.displayName,
      })
      .from(schema.seasons)
      .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
      .orderBy(asc(schema.games.slug), desc(schema.seasons.name));

    // Only the boolean leaves this cached function: the timestamp is staff
    // bookkeeping, and a Date would round-trip through the cache as a string.
    return rows.map(({ outcomesFinalizedAt, ...r }) => ({
      ...r,
      outcomesPublic: areOutcomesPublic({ outcomesFinalizedAt }),
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
  await db.transaction(async (tx) => {
    // Refused, never cascaded: a game with matches keeps its rosters, players and scores until the
    // matches are removed on purpose (matches -> rosters is RESTRICT, spec-060).
    const [matchCount] = await tx
      .select({ count: count() })
      .from(schema.matches)
      .innerJoin(schema.seasons, eq(schema.matches.seasonId, schema.seasons.id))
      .where(eq(schema.seasons.gameId, id));
    if ((matchCount?.count ?? 0) > 0) {
      throw new Error('Cannot delete a game with existing matches. Please delete its matches first.');
    }
    // Rosters belong to the school, game and season themselves, so nothing reaches them through a
    // membership row any more: delete them (and their players) explicitly, then the game.
    await deleteRostersWhere(tx, eq(schema.rosters.gameId, id));
    await tx.delete(schema.games).where(eq(schema.games.id, id));
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Deletes the players of the matching rosters, then the rosters. Callers have already refused when matches exist. */
async function deleteRostersWhere(tx: Tx, where: ReturnType<typeof eq>) {
  const ids = (await tx.select({ id: schema.rosters.id }).from(schema.rosters).where(where)).map((r) => r.id);
  if (ids.length === 0) return;
  await tx.delete(schema.players).where(inArray(schema.players.rosterId, ids));
  await tx.delete(schema.rosters).where(inArray(schema.rosters.id, ids));
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
        .set(retireSeasonSet)
        .where(and(eq(schema.seasons.gameId, values.gameId), eq(schema.seasons.isActive, true)));
    }
    const res = await tx.insert(schema.seasons).values(values).returning();
    return res[0];
  });
}

/**
 * Retiring a season is what ends it, so its results go public in the same
 * write. Otherwise archiving would silently blank a finished season's scores
 * until someone remembered to press Publish (migration 0051 applies the same
 * rule to seasons already retired). `coalesce` keeps an earlier publish stamp.
 */
const retireSeasonSet = {
  isActive: false,
  outcomesFinalizedAt: sql`coalesce(${schema.seasons.outcomesFinalizedAt}, now())`,
};

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
          .set(retireSeasonSet)
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
      .set(values.isActive === false ? { ...values, ...retireSeasonSet } : values)
      .where(eq(schema.seasons.id, id))
      .returning();
    return res[0];
  });
}

export async function deleteSeasonInDb(id: string) {
  await db.transaction(async (tx) => {
    const matchCount = await tx
      .select({ count: count() })
      .from(schema.matches)
      .where(eq(schema.matches.seasonId, id));

    if ((matchCount[0]?.count ?? 0) > 0) {
      throw new Error('Cannot delete season with existing matches. Please reassign or delete matches first.');
    }

    // Explicit, not cascaded through a membership row (spec-060): the season's rosters and their
    // players, then the season (which removes its memberships and standings).
    await deleteRostersWhere(tx, eq(schema.rosters.seasonId, id));
    await tx.delete(schema.seasons).where(eq(schema.seasons.id, id));
  });
}
