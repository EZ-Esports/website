import 'server-only';
import { createClient } from '@/app/lib/supabase/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { Permissions, hasPermission, calculateEffectiveStaffAccess } from '@/app/lib/roles';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { inactiveSeasonViewOnlyError } from '@/app/lib/season-name';

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

export interface SeasonInfo {
  id: string;
  name: string;
  gameId: string;
  /** Whether this is the game's active season. An inactive season is view-only for managers (spec-028). */
  isActive: boolean;
  /** When staff locked this season's rosters; null while unlocked. */
  rostersLockedAt: Date | null;
}

/** A game a manager may work on at a school, together with the manager's resolved season. */
export interface AuthorizedGameScope {
  gameId: string;
  gameSlug: string;
  seasonId: string;
  seasonName: string;
  /** False when the manager's season is not the game's active season (older or newer): view-only. */
  seasonIsActive: boolean;
  /** True while staff have locked this season's rosters against manager changes. */
  rostersLocked: boolean;
  /** True when the manager may only view this scope (an inactive season). The UI disables writes. */
  readOnly: boolean;
  /** Why the scope is read-only (the same text the server throws), else null. */
  readOnlyReason: string | null;
}

export const ROSTERS_LOCKED_ERROR =
  'Rosters for this season are locked by EZ Esports staff. Contact an admin to request changes.';

/**
 * Refuses a roster change while the season is locked. Staff admins are exempt so EZ Esports can
 * still correct a roster after locking. Every manager roster mutation funnels through this via
 * `assertManagerForRoster` or the create path; reads must not call it.
 */
export function assertSeasonRostersUnlocked(
  context: Pick<SchoolManagerContext, 'isStaffAdmin'>,
  season: { rostersLockedAt: Date | null } | null
): void {
  if (context.isStaffAdmin) return;
  if (season?.rostersLockedAt) {
    throw new Error(ROSTERS_LOCKED_ERROR);
  }
}

/**
 * Refuses any season-data change while the manager's season is inactive (older or newer than the
 * game's active season; spec-028). Staff admins are exempt. Mutations reach this through
 * `assertManagerForSchool` / `assertManagerForSchoolGame` / `assertManagerForRoster` by default;
 * reads opt out with `allowInactive: true`.
 */
export function assertSeasonActive(
  context: Pick<SchoolManagerContext, 'isStaffAdmin'>,
  season: { name: string; isActive: boolean } | null
): void {
  if (context.isStaffAdmin) return;
  if (season && !season.isActive) {
    throw new Error(inactiveSeasonViewOnlyError(season.name));
  }
}

/** Staff-admin paths that still target the game's active season (for example roster creation). */
export const NO_ACTIVE_SEASON_ERROR =
  'No active season for this game; ask an EZ Esports admin to activate one';

/** A manager's season (their affiliation's `YYYY-YY`) does not exist for this game. */
export const NO_MANAGED_SEASON_ERROR =
  'Your season for this game does not exist yet; ask an EZ Esports admin to create it';

const SEASON_COLUMNS = {
  id: schema.seasons.id,
  name: schema.seasons.name,
  gameId: schema.seasons.gameId,
  isActive: schema.seasons.isActive,
  rostersLockedAt: schema.seasons.rostersLockedAt,
};

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
 *   record. Each row grants one season by name (`academic_year`, `YYYY-YY`, active or not); the
 *   per-game resolution lives in `resolveManagerSeason` (spec-026).
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

/** The game's single active season, or null when none is active. Not used for manager scoping. */
export async function getActiveSeasonForGame(gameId: string): Promise<SeasonInfo | null> {
  const [season] = await db
    .select(SEASON_COLUMNS)
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
 * Pure season-resolution rule for the manager portal (spec-026). A manager's season for a game is
 * the game's season whose `name` equals the `academic_year` (`YYYY-YY`) of one of their rows that
 * covers the game. `seasons.is_active` plays no part. When several rows match several seasons,
 * the newest by name wins (`YYYY-YY` sorts lexicographically). Returns null when no season of the
 * game has a matching name. Change the multi-match policy here and nowhere else.
 */
export function resolveManagerSeason<S extends { name: string }>(
  affiliations: ManagerAffiliation[],
  game: { id: string; slug: string },
  gameSeasons: S[]
): S | null {
  const names = new Set(
    affiliations.filter((a) => affiliationCoversGame(a, game)).map((a) => a.academicYear)
  );
  let best: S | null = null;
  for (const season of gameSeasons) {
    if (!names.has(season.name)) continue;
    if (!best || season.name > best.name) best = season;
  }
  return best;
}

async function getSeasonsForGame(gameId: string): Promise<SeasonInfo[]> {
  return db.select(SEASON_COLUMNS).from(schema.seasons).where(eq(schema.seasons.gameId, gameId));
}

/**
 * Games (with the manager's resolved season) a manager can see and act on at a school.
 * Returns null for a staff admin, who is unrestricted and sees every season.
 */
export async function getAuthorizedGameScopes(
  context: SchoolManagerContext,
  schoolId: string
): Promise<AuthorizedGameScope[] | null> {
  if (context.isStaffAdmin) return null;
  const school = context.managedSchools.find((s) => s.schoolId === schoolId);
  if (!school) return [];

  const allSeasons: SeasonInfo[] = await db.select(SEASON_COLUMNS).from(schema.seasons);
  if (allSeasons.length === 0) return [];

  const games = await db
    .select({ id: schema.games.id, slug: schema.games.slug })
    .from(schema.games);

  const scopes: AuthorizedGameScope[] = [];
  for (const game of games) {
    const season = resolveManagerSeason(
      school.affiliations,
      game,
      allSeasons.filter((s) => s.gameId === game.id)
    );
    if (season) {
      scopes.push({
        gameId: game.id,
        gameSlug: game.slug,
        seasonId: season.id,
        seasonName: season.name,
        seasonIsActive: !!season.isActive,
        rostersLocked: !!season.rostersLockedAt,
        readOnly: !season.isActive,
        readOnlyReason: season.isActive ? null : inactiveSeasonViewOnlyError(season.name),
      });
    }
  }
  return scopes;
}

/**
 * Honors a requested `?gameId=` filter only when the caller may see that game. Staff admins
 * (scopes === null) keep any value; for managers a stale or foreign id is ignored so the page
 * renders its normal state instead of throwing Forbidden.
 */
export function resolveRequestedGameId(
  scopes: AuthorizedGameScope[] | null,
  requested: string | undefined
): string | undefined {
  if (!requested) return undefined;
  if (scopes === null) return requested;
  return scopes.some((s) => s.gameId === requested) ? requested : undefined;
}

/**
 * Validates the game-level grant and returns the manager's resolved season for the game: some
 * row must cover the game, and the game must have a season named like that row's year.
 */
async function assertManagerForGame(
  school: ManagedSchoolInfo,
  schoolId: string,
  gameId: string
): Promise<SeasonInfo> {
  const game = await resolveGame(gameId);
  if (!game || !school.affiliations.some((a) => affiliationCoversGame(a, game))) {
    throw new Error(`Forbidden: Not authorized for game ${gameId} at school ${schoolId}`);
  }

  const season = resolveManagerSeason(school.affiliations, game, await getSeasonsForGame(game.id));
  if (!season) {
    throw new Error(NO_MANAGED_SEASON_ERROR);
  }
  return season;
}

async function assertManagerForSchoolWithSeason(
  schoolId: string,
  gameId: string | undefined,
  options?: { allowStaffAdmin?: boolean; allowInactive?: boolean }
): Promise<{ context: SchoolManagerContext; season: SeasonInfo | null }> {
  const context = await getSchoolManagerContext(undefined, {
    allowStaffAdmin: options?.allowStaffAdmin ?? true,
  });
  if (!context) {
    throw new Error('Unauthorized');
  }

  // Staff admins (ADMINISTRATOR) are checked before any manager row and are not tied to a season.
  if (context.isStaffAdmin) {
    return { context, season: null };
  }

  const school = context.managedSchools.find((s) => s.schoolId === schoolId);
  if (!school) {
    throw new Error(`Forbidden: Not authorized for school ${schoolId}`);
  }

  const season = gameId ? await assertManagerForGame(school, schoolId, gameId) : null;
  // Default-deny writes on an inactive season (spec-028); reads opt out with `allowInactive`.
  if (!options?.allowInactive) {
    assertSeasonActive(context, season);
  }
  return { context, season };
}

/**
 * Asserts that the authenticated user is an authorized manager for the specified school and,
 * when given, game. For a game the user must hold a manager row that covers it and whose season
 * (by name, active or not) exists for the game. Staff admins pass unconditionally.
 * Throws an Error with 'Forbidden' if unauthorized.
 * This is also a mutation guard: when the manager's season for the game is inactive it throws
 * the view-only error unless the caller passes `{ allowInactive: true }` (reads only; spec-028).
 */
export async function assertManagerForSchool(
  schoolId: string,
  gameId?: string,
  options?: { allowStaffAdmin?: boolean; allowInactive?: boolean }
): Promise<SchoolManagerContext> {
  return (await assertManagerForSchoolWithSeason(schoolId, gameId, options)).context;
}

/**
 * Like `assertManagerForSchool` for a game, but also returns the manager's resolved season
 * (null for a staff admin, who is not tied to one season).
 */
export async function assertManagerForSchoolGame(
  schoolId: string,
  gameId: string,
  options?: { allowStaffAdmin?: boolean; allowInactive?: boolean }
): Promise<{ context: SchoolManagerContext; season: SeasonInfo | null }> {
  return assertManagerForSchoolWithSeason(schoolId, gameId, options);
}

/**
 * Traces a roster -> team -> schoolId and asserts school manager authorization.
 * A manager may only touch rosters whose team belongs to their resolved season for the game
 * (matched by name, active or not); any other season's roster is refused. Staff admins may touch
 * any roster.
 * Locked seasons and inactive (view-only, spec-028) seasons refuse managers by default (this guard is
 * the mutation guard); read-only callers pass `{ allowLocked: true, allowInactive: true }`.
 * Returns the resolved context, roster, and team records.
 */
export async function assertManagerForRoster(
  rosterId: string,
  options?: { allowLocked?: boolean; allowInactive?: boolean }
): Promise<{
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

  // allowInactive here only so the different-season error keeps precedence; the inactive check follows.
  const { context, season } = await assertManagerForSchoolWithSeason(
    row.team.schoolId,
    row.team.gameId,
    { allowInactive: true }
  );
  if (!context.isStaffAdmin) {
    if (!season || row.team.seasonId !== season.id) {
      throw new Error(
        'Forbidden: This roster belongs to a different season than your manager affiliation and cannot be changed from the portal'
      );
    }
    if (!options?.allowInactive) {
      assertSeasonActive(context, season);
    }
    if (!options?.allowLocked) {
      assertSeasonRostersUnlocked(context, season);
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
