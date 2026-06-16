import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, count, desc, eq, isNull, lt, notExists, or } from 'drizzle-orm';

/** Default page size for public-facing paginated lists. */
export const DEFAULT_PAGE_SIZE = 20;

export const getCachedGames = unstable_cache(
  async () => {
    return db.select().from(schema.games);
  },
  ['games-list'],
  { tags: ['games'] }
);

export const getCachedSchools = unstable_cache(
  async () => {
    return db
      .select()
      .from(schema.schools)
      .where(and(eq(schema.schools.isActive, true), isNull(schema.schools.deletedAt)))
      .orderBy(asc(schema.schools.displayOrder), asc(schema.schools.name));
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
      .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
      .where(isNull(schema.schools.deletedAt));
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

/** Uncached: all seasons (incl. inactive) for admin labels/lookups. */
export const getAdminSeasons = () => db.select().from(schema.seasons);

/**
 * Paginated match query for public-facing pages.
 * Use getAdminMatches() in admin views where you need all rows.
 */
export const getCachedMatches = unstable_cache(
  async (limit = DEFAULT_PAGE_SIZE, offset = 0) => {
    return db
      .select()
      .from(schema.matches)
      .orderBy(desc(schema.matches.scheduledAt))
      .limit(limit)
      .offset(offset);
  },
  ['matches-list'],
  { tags: ['matches'] }
);

/** Uncached: returns all matches for admin views. */
export const getAdminMatches = () =>
  db.select().from(schema.matches).orderBy(desc(schema.matches.scheduledAt));

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

/**
 * Paginated published news for public pages.
 * Use getAdminNews() in admin views where you need all statuses.
 */
export const getCachedNews = unstable_cache(
  async (limit = DEFAULT_PAGE_SIZE, offset = 0) => {
    return db
      .select()
      .from(schema.newsPosts)
      .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)))
      .orderBy(desc(schema.newsPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  },
  ['news-list'],
  { tags: ['news'] }
);

/** Uncached: returns all posts (all statuses) for admin views. */
export const getAdminNews = () =>
  db
    .select()
    .from(schema.newsPosts)
    .where(isNull(schema.newsPosts.deletedAt))
    .orderBy(desc(schema.newsPosts.updatedAt));

export const getCachedLeadership = unstable_cache(
  async () => {
    return db
      .select()
      .from(schema.leadership)
      .where(isNull(schema.leadership.deletedAt))
      .orderBy(desc(schema.leadership.year));
  },
  ['leadership-list'],
  { tags: ['leadership'] }
);

export const getCachedSponsors = unstable_cache(
  async () =>
    db
      .select()
      .from(schema.sponsors)
      .where(and(eq(schema.sponsors.isActive, true), isNull(schema.sponsors.deletedAt)))
      .orderBy(schema.sponsors.tier, schema.sponsors.displayOrder),
  ['sponsors'],
  { tags: ['sponsors'] }
);

export const getCachedPageContent = unstable_cache(
  async (key: string) => {
    const rows = await db
      .select()
      .from(schema.pageContent)
      .where(eq(schema.pageContent.key, key))
      .limit(1);
    return rows[0] ?? null;
  },
  ['page-content'],
  { tags: ['page-content'] }
);

export const getSchoolApplications = async (status?: 'pending' | 'reviewed' | 'accepted') => {
  const conditions = status ? [eq(schema.schoolApplications.status, status)] : [];
  return db
    .select()
    .from(schema.schoolApplications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.schoolApplications.submittedAt));
};

/** Count of all scheduled matches (for dashboard). */
export const countScheduledMatches = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.matches)
    .where(eq(schema.matches.status, 'scheduled'));
  return row?.value ?? 0;
};

/** Count of published (non-deleted) news posts (for dashboard). */
export const countPublishedNews = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.newsPosts)
    .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)));
  return row?.value ?? 0;
};

/**
 * Count of past scheduled matches still missing a final score (dashboard alert).
 * Pushes the filter into SQL instead of pulling every match into JS.
 */
export const countPendingResults = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.status, 'scheduled'),
        lt(schema.matches.scheduledAt, new Date()),
        or(isNull(schema.matches.homeScore), isNull(schema.matches.awayScore))
      )
    );
  return row?.value ?? 0;
};

/**
 * Count of registered teams (on non-deleted schools) that have no roster yet
 * (dashboard alert). Uses a NOT EXISTS anti-join rather than computing the
 * full standings view just to test for roster presence.
 */
export const countTeamsWithoutRoster = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.teams)
    .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
    .where(
      and(
        isNull(schema.schools.deletedAt),
        notExists(
          db
            .select({ one: schema.rosters.id })
            .from(schema.rosters)
            .where(eq(schema.rosters.teamId, schema.teams.id))
        )
      )
    );
  return row?.value ?? 0;
};

// --- ADMIN ACCESS CONTROL ---

/** All provisioned admins, oldest first (the bootstrapped admin leads). */
export const listAdminUsers = async () => {
  return db
    .select()
    .from(schema.adminUsers)
    .orderBy(asc(schema.adminUsers.createdAt));
};

/** Outstanding (not yet accepted) admin invites, newest first, each tagged with
 * whether its link has already expired (computed here so the UI stays pure). */
export const listPendingAdminInvites = async () => {
  const rows = await db
    .select()
    .from(schema.adminInvites)
    .where(isNull(schema.adminInvites.acceptedAt))
    .orderBy(desc(schema.adminInvites.createdAt));
  const now = Date.now();
  return rows.map((row) => ({ ...row, expired: row.expiresAt.getTime() < now }));
};

/** Total number of provisioned admins — used to block last-admin lockout. */
export const countAdminUsers = async (): Promise<number> => {
  const [row] = await db.select({ value: count() }).from(schema.adminUsers);
  return row?.value ?? 0;
};
