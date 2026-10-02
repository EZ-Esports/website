import 'server-only';
import { createClient } from '@/app/lib/supabase/server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { Permissions, hasPermission, calculateEffectiveStaffAccess } from '@/app/lib/roles';
import { eq, and, isNull } from 'drizzle-orm';

export interface ManagedSchoolInfo {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  managedGames: string[] | null;
  isPrimaryContact: boolean;
}

export interface SchoolManagerContext {
  userId: string;
  email: string;
  isStaffAdmin: boolean;
  managedSchools: ManagedSchoolInfo[];
}

/**
 * Resolves user from Supabase auth and determines their school management tenancy.
 * - If staff admin (has Permissions.ADMINISTRATOR or isOwner), returns context with access to all active schools.
 * - Otherwise, queries `schoolManagers` for active rows linked to the user's ID.
 * - If optional `schoolId` is specified, ensures the user has authorization for that specific school (or returns null).
 */
export async function getSchoolManagerContext(
  schoolId?: string
): Promise<SchoolManagerContext | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  const email = claimsData?.claims?.email as string | undefined;

  if (!userId) {
    if (process.env.NODE_ENV === 'development') {
      const activeSchools = await db
        .select({
          schoolId: schema.schools.id,
          schoolName: schema.schools.name,
          schoolSlug: schema.schools.slug,
        })
        .from(schema.schools)
        .where(eq(schema.schools.isActive, true));

      if (activeSchools.length > 0) {
        return {
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'manager@stuy.edu',
          isStaffAdmin: true,
          managedSchools: activeSchools.map((s) => ({
            schoolId: s.schoolId,
            schoolName: s.schoolName,
            schoolSlug: s.schoolSlug,
            managedGames: null,
            isPrimaryContact: true,
          })),
        };
      }
    }
    return null;
  }

  // 1. Check if user is staff admin (Permissions.ADMINISTRATOR or isOwner)
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

  const isStaffAdmin = hasPermission(permissions, isOwner, Permissions.ADMINISTRATOR);

  if (isStaffAdmin) {
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

  // 2. Query schoolManagers for active management assignments
  const managerRows = await db
    .select({
      schoolId: schema.schoolManagers.schoolId,
      schoolName: schema.schools.name,
      schoolSlug: schema.schools.slug,
      managedGames: schema.schoolManagers.managedGames,
      isPrimaryContact: schema.schoolManagers.isPrimaryContact,
    })
    .from(schema.schoolManagers)
    .innerJoin(schema.schools, eq(schema.schoolManagers.schoolId, schema.schools.id))
    .where(
      and(
        eq(schema.schoolManagers.userId, userId),
        eq(schema.schoolManagers.isActive, true),
        isNull(schema.schools.deletedAt)
      )
    );

  if (schoolId && !managerRows.some((s) => s.schoolId === schoolId)) {
    return null;
  }

  return {
    userId,
    email: email ?? '',
    isStaffAdmin: false,
    managedSchools: managerRows,
  };
}

/**
 * Asserts that the authenticated user is an authorized manager for the specified school and optional game.
 * Throws an Error with 'Forbidden' if unauthorized.
 */
export async function assertManagerForSchool(
  schoolId: string,
  gameId?: string
): Promise<SchoolManagerContext> {
  const context = await getSchoolManagerContext();
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

  if (gameId && school.managedGames && school.managedGames.length > 0) {
    let matches = school.managedGames.includes(gameId);
    if (!matches) {
      let [game] = await db
        .select({ id: schema.games.id, slug: schema.games.slug })
        .from(schema.games)
        .where(eq(schema.games.id, gameId))
        .limit(1);

      if (!game) {
        [game] = await db
          .select({ id: schema.games.id, slug: schema.games.slug })
          .from(schema.games)
          .where(eq(schema.games.slug, gameId))
          .limit(1);
      }

      if (game) {
        matches = school.managedGames.includes(game.slug) || school.managedGames.includes(game.id);
      }
    }

    if (!matches) {
      throw new Error(`Forbidden: Not authorized for game ${gameId} at school ${schoolId}`);
    }
  }

  return context;
}

/**
 * Traces a roster -> team -> schoolId and asserts school manager authorization.
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
  return {
    context,
    roster: row.roster,
    team: row.team,
  };
}
