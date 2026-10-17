import 'server-only';
import { createClient } from '@/app/lib/supabase/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { Permissions, hasPermission, calculateEffectiveStaffAccess } from '@/app/lib/roles';
import { eq, and, isNull, sql } from 'drizzle-orm';

/** One `school_managers` row's grant at a school: a season (`YYYY-YY`) and the games it covers. */
export interface ManagerAffiliation {
  academicYear: string;
  /** Game slugs/ids this row covers; null or empty means every game. */
  managedGames: string[] | null;
}

export interface ManagedSchoolInfo {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  /** Union of the games across the school's affiliations (null when any row covers all games). */
  managedGames: string[] | null;
  isPrimaryContact: boolean;
  /** Every active manager row for this school. Empty for a staff admin (unrestricted). */
  affiliations: ManagerAffiliation[];
}

export interface SchoolManagerContext {
  userId: string;
  email: string;
  isStaffAdmin: boolean;
  managedSchools: ManagedSchoolInfo[];
}

export interface ActiveSeasonInfo {
  id: string;
  name: string;
  gameId: string;
}

/** A game a manager may work on at a school, together with its active season. */
export interface AuthorizedGameScope {
  gameId: string;
  gameSlug: string;
  seasonId: string;
  seasonName: string;
}

export const NO_ACTIVE_SEASON_ERROR =
  'No active season for this game; ask an EZ Esports admin to activate one';

type ManagerRow = {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  managedGames: string[] | null;
  academicYear: string;
  isPrimaryContact: boolean;
};

/** Collapses per-row results into one entry per school, keeping every row's season grant. */
function mergeManagerRows(rows: ManagerRow[]): ManagedSchoolInfo[] {
  const bySchool = new Map<string, ManagedSchoolInfo>();
  for (const row of rows) {
    const affiliation: ManagerAffiliation = {
      academicYear: row.academicYear,
      managedGames: row.managedGames,
    };
    const existing = bySchool.get(row.schoolId);
    if (!existing) {
      bySchool.set(row.schoolId, {
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        schoolSlug: row.schoolSlug,
        managedGames: row.managedGames && row.managedGames.length > 0 ? [...row.managedGames] : null,
        isPrimaryContact: row.isPrimaryContact,
        affiliations: [affiliation],
      });
      continue;
    }
    existing.affiliations.push(affiliation);
    existing.isPrimaryContact = existing.isPrimaryContact || row.isPrimaryContact;
    if (!row.managedGames || row.managedGames.length === 0 || existing.managedGames === null) {
      existing.managedGames = null;
    } else {
      existing.managedGames = [...new Set([...existing.managedGames, ...row.managedGames])];
    }
  }
  return [...bySchool.values()];
}

/**
 * Whether the user holds the ADMINISTRATOR permission through their staff roles (the same
 * definition the staff CMS uses). Deliberately not "has a staff_members row": school managers
 * can be given role-less staff rows, which must never widen their portal access.
 */
async function isStaffAdminUser(userId: string): Promise<boolean> {
  const assignedRoles = await db
    .select({
      permissions: schema.roles.permissions,
      position: schema.roles.position,
      isOwner: schema.roles.isOwner,
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, userId));

  const [everyoneRole] = await db
    .select({
      permissions: schema.roles.permissions,
      position: schema.roles.position,
      isOwner: schema.roles.isOwner,
    })
    .from(schema.roles)
    .where(eq(schema.roles.name, '@everyone'))
    .limit(1);

  const { isOwner, permissions } = calculateEffectiveStaffAccess(
    assignedRoles,
    everyoneRole ?? null
  );
  return hasPermission(permissions, isOwner, Permissions.ADMINISTRATOR);
}

/**
 * Resolves user from Supabase auth and determines their school management tenancy.
 * - A user with the ADMINISTRATOR permission is a staff admin and sees every school and season,
 *   even when they also hold `school_managers` rows (unless `options.allowStaffAdmin` is false).
 * - Otherwise access comes from active `school_managers` rows linked to the user's ID or member
 *   record. Each row grants one season (`academic_year`, `YYYY-YY`); the per-game season check
 *   itself lives in `assertManagerForSchool` / `getAuthorizedGameScopes`.
 * - If optional `schoolId` is specified, ensures the user has authorization for that specific
 *   school (or returns null).
 */
export async function getSchoolManagerContext(
  schoolId?: string,
  options?: { allowStaffAdmin?: boolean }
): Promise<SchoolManagerContext | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  const email = claimsData?.claims?.email as string | undefined;

  if (!userId) {
    return null;
  }

  // 1. Staff admins bypass manager scoping entirely.
  if (options?.allowStaffAdmin ?? true) {
    if (await isStaffAdminUser(userId)) {
      const allSchools = await db
        .select({
          id: schema.schools.id,
          name: schema.schools.name,
          slug: schema.schools.slug,
        })
        .from(schema.schools)
        .where(isNull(schema.schools.deletedAt))
        .orderBy(schema.schools.name);

      const managedSchools: ManagedSchoolInfo[] = allSchools.map((s) => ({
        schoolId: s.id,
        schoolName: s.name,
        schoolSlug: s.slug,
        managedGames: null,
        isPrimaryContact: false,
        affiliations: [],
      }));

      if (schoolId && !managedSchools.some((s) => s.schoolId === schoolId)) {
        return null;
      }

      return {
        userId,
        email: email ?? '',
        isStaffAdmin: true,
        managedSchools,
      };
    }
  }

  // 2. School manager: active schoolManagers rows linked to the auth user
  const managerSelect = {
    schoolId: schema.schoolManagers.schoolId,
    schoolName: schema.schools.name,
    schoolSlug: schema.schools.slug,
    managedGames: schema.schoolManagers.managedGames,
    academicYear: schema.schoolManagers.academicYear,
    isPrimaryContact: schema.schoolManagers.isPrimaryContact,
  };

  const managerRows: ManagerRow[] = await db
    .select(managerSelect)
    .from(schema.schoolManagers)
    .innerJoin(schema.schools, eq(schema.schoolManagers.schoolId, schema.schools.id))
    .where(
      and(
        eq(schema.schoolManagers.userId, userId),
        eq(schema.schoolManagers.isActive, true),
        isNull(schema.schools.deletedAt)
      )
    );

  // If no rows found by auth userId, check if linked via members table by verified email
  const isEmailUnverified = claimsData?.claims?.email_verified === false;
  if (managerRows.length === 0 && email && !isEmailUnverified) {
    const [member] = await db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(sql`lower(${schema.members.email}) = ${email.toLowerCase().trim()}`)
      .limit(1);

    if (member) {
      const rowsByMember: ManagerRow[] = await db
        .select(managerSelect)
        .from(schema.schoolManagers)
        .innerJoin(schema.schools, eq(schema.schoolManagers.schoolId, schema.schools.id))
        .where(
          and(
            eq(schema.schoolManagers.memberId, member.id),
            eq(schema.schoolManagers.isActive, true),
            isNull(schema.schools.deletedAt)
          )
        );
      managerRows.push(...rowsByMember);
    }
  }

  if (managerRows.length > 0) {
    const managedSchools = mergeManagerRows(managerRows);
    if (schoolId && !managedSchools.some((s) => s.schoolId === schoolId)) {
      return null;
    }

    return {
      userId,
      email: email ?? '',
      isStaffAdmin: false,
      managedSchools,
    };
  }

  return null;
}

async function resolveGame(idOrSlug: string): Promise<{ id: string; slug: string } | null> {
  let [game] = await db
    .select({ id: schema.games.id, slug: schema.games.slug })
    .from(schema.games)
    .where(eq(schema.games.id, idOrSlug))
    .limit(1);

  if (!game) {
    [game] = await db
      .select({ id: schema.games.id, slug: schema.games.slug })
      .from(schema.games)
      .where(eq(schema.games.slug, idOrSlug))
      .limit(1);
  }
  return game ?? null;
}

/** The game's single active season, or null when none is active. */
export async function getActiveSeasonForGame(gameId: string): Promise<ActiveSeasonInfo | null> {
  const [season] = await db
    .select({ id: schema.seasons.id, name: schema.seasons.name, gameId: schema.seasons.gameId })
    .from(schema.seasons)
    .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.isActive, true)))
    .limit(1);
  return season ?? null;
}

function affiliationCoversGame(
  affiliation: ManagerAffiliation,
  game: { id: string; slug: string }
): boolean {
  const games = affiliation.managedGames;
  if (!games || games.length === 0) return true;
  return games.includes(game.slug) || games.includes(game.id);
}

/**
 * Pure matching rule for the manager portal: a manager may work on a game only through the
 * game's ACTIVE season, and only when one of their rows' `academic_year` equals that season's
 * name (both `YYYY-YY`) and that row covers the game.
 */
export function managerMatchesActiveSeason(
  affiliations: ManagerAffiliation[],
  game: { id: string; slug: string },
  activeSeason: { name: string } | null
): boolean {
  if (!activeSeason) return false;
  return affiliations.some(
    (a) => a.academicYear === activeSeason.name && affiliationCoversGame(a, game)
  );
}

/**
 * Games (with their active season) a manager can see and act on at a school.
 * Returns null for a staff admin, who is unrestricted and sees every season.
 */
export async function getAuthorizedGameScopes(
  context: SchoolManagerContext,
  schoolId: string
): Promise<AuthorizedGameScope[] | null> {
  if (context.isStaffAdmin) return null;
  const school = context.managedSchools.find((s) => s.schoolId === schoolId);
  if (!school) return [];

  const activeSeasons = await db
    .select({ id: schema.seasons.id, name: schema.seasons.name, gameId: schema.seasons.gameId })
    .from(schema.seasons)
    .where(eq(schema.seasons.isActive, true));
  if (activeSeasons.length === 0) return [];

  const games = await db
    .select({ id: schema.games.id, slug: schema.games.slug })
    .from(schema.games);

  const scopes: AuthorizedGameScope[] = [];
  for (const season of activeSeasons) {
    const game = games.find((g) => g.id === season.gameId);
    if (game && managerMatchesActiveSeason(school.affiliations, game, season)) {
      scopes.push({
        gameId: game.id,
        gameSlug: game.slug,
        seasonId: season.id,
        seasonName: season.name,
      });
    }
  }
  return scopes;
}

/** Validates the game-level season grant and returns the game's active season. */
async function assertManagerForGame(
  school: ManagedSchoolInfo,
  schoolId: string,
  gameId: string
): Promise<ActiveSeasonInfo> {
  const game = await resolveGame(gameId);
  if (!game) {
    throw new Error(`Forbidden: Not authorized for game ${gameId} at school ${schoolId}`);
  }

  const season = await getActiveSeasonForGame(game.id);
  if (!season) {
    throw new Error(NO_ACTIVE_SEASON_ERROR);
  }

  if (!managerMatchesActiveSeason(school.affiliations, game, season)) {
    const coversGame = school.affiliations.some((a) => affiliationCoversGame(a, game));
    throw new Error(
      coversGame
        ? `Forbidden: Your manager affiliation does not include the active season (${season.name}) for this game`
        : `Forbidden: Not authorized for game ${gameId} at school ${schoolId}`
    );
  }
  return season;
}

/**
 * Asserts that the authenticated user is an authorized manager for the specified school and,
 * when given, game. For a game the user must hold a manager row whose season equals the game's
 * active season. Staff admins pass unconditionally.
 * Throws an Error with 'Forbidden' if unauthorized.
 */
export async function assertManagerForSchool(
  schoolId: string,
  gameId?: string,
  options?: { allowStaffAdmin?: boolean }
): Promise<SchoolManagerContext> {
  const context = await getSchoolManagerContext(undefined, {
    allowStaffAdmin: options?.allowStaffAdmin ?? true,
  });
  if (!context) {
    throw new Error('Unauthorized');
  }

  if (context.isStaffAdmin) {
    return context;
  }

  const school = context.managedSchools.find((s) => s.schoolId === schoolId);
  if (!school) {
    throw new Error(`Forbidden: Not authorized for school ${schoolId}`);
  }

  if (gameId) {
    await assertManagerForGame(school, schoolId, gameId);
  }

  return context;
}

/**
 * Traces a roster -> team -> schoolId and asserts school manager authorization.
 * A manager may only touch rosters whose team belongs to the game's active season and whose
 * affiliation matches it; a past-season roster is refused. Staff admins may touch any roster.
 * Returns the resolved context, roster, and team records.
 */
export async function assertManagerForRoster(rosterId: string): Promise<{
  context: SchoolManagerContext;
  roster: typeof schema.rosters.$inferSelect;
  team: typeof schema.teams.$inferSelect;
}> {
  const [row] = await db
    .select({
      roster: schema.rosters,
      team: schema.teams,
    })
    .from(schema.rosters)
    .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
    .where(eq(schema.rosters.id, rosterId))
    .limit(1);

  if (!row) {
    throw new Error(`Roster not found: ${rosterId}`);
  }

  const context = await assertManagerForSchool(row.team.schoolId, row.team.gameId);
  if (!context.isStaffAdmin) {
    const activeSeason = await getActiveSeasonForGame(row.team.gameId);
    if (!activeSeason || row.team.seasonId !== activeSeason.id) {
      throw new Error(
        'Forbidden: This roster belongs to a past season and can no longer be changed from the portal'
      );
    }
  }
  return {
    context,
    roster: row.roster,
    team: row.team,
  };
}

/**
 * Whether this auth account has already finished or skipped the portal tour.
 * Read server-side from the session user id; deliberately not a server action so a
 * client can never ask about someone else's account.
 */
export async function hasCompletedPortalTour(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ tourCompletedAt: schema.schoolManagers.tourCompletedAt })
      .from(schema.schoolManagers)
      .where(eq(schema.schoolManagers.userId, userId));
    // A staff admin viewing the portal has no manager row to record dismissal on, so
    // the tour is skipped for them rather than replaying on every visit.
    if (rows.length === 0) return true;
    // Any row counts, so a new school or academic year for the same person never replays it.
    return rows.some((r) => r.tourCompletedAt !== null);
  } catch (error) {
    // Fail safe: the tour is an extra, so a failed lookup (for example before the
    // column's migration is applied) hides it rather than taking the portal down.
    console.error('hasCompletedPortalTour failed; hiding the tour', error);
    return true;
  }
}
