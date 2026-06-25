import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { createClient } from '@/app/lib/supabase/server';
import { db } from '@/app/lib/db';
import { adminUsers, userRoles, roles } from '@/app/lib/db/schema';
import { hasPermission } from '@/app/lib/roles';

export interface AdminIdentity {
  id: string;
  email: string | undefined;
  permissions: bigint;
  isOwner: boolean;
  highestRolePosition: number;
}

/**
 * Resolve the current request's admin identity, or null if the caller is not a
 * provisioned admin. Authentication alone is NOT enough: a valid Supabase Auth
 * session must also have a matching row in `admin_users` (the allowlist).
 *
 * It queries the user's assigned roles (plus the `@everyone` role) and combines
 * their permissions using bitwise OR, along with determining the owner status
 * and highest role position in the hierarchy.
 *
 * Wrapped in React.cache() so repeated calls within a single request collapse.
 */
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return null;
  }

  const userId = claims.sub as string;
  const [row] = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.userId, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  // Fetch explicitly assigned roles
  const userRolesRows = await db
    .select({
      permissions: roles.permissions,
      position: roles.position,
      isOwner: roles.isOwner,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  // Also fetch @everyone role (baseline fallback)
  const [everyoneRole] = await db
    .select({
      permissions: roles.permissions,
      position: roles.position,
      isOwner: roles.isOwner,
    })
    .from(roles)
    .where(eq(roles.name, '@everyone'))
    .limit(1);

  const allRoles = [...userRolesRows];
  if (everyoneRole) {
    allRoles.push(everyoneRole);
  }

  const isOwner = allRoles.some((r) => r.isOwner);
  const permissions = allRoles.reduce((acc, r) => acc | BigInt(r.permissions), BigInt(0));
  const highestRolePosition = allRoles.reduce((max, r) => (r.position > max ? r.position : max), 0);

  return {
    id: userId,
    email: (claims.email as string | undefined) ?? row.email,
    permissions,
    isOwner,
    highestRolePosition,
  };
});

/**
 * Guard for general admin access.
 * Throws when the caller is not an authenticated, allowlisted admin.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  return admin;
}

/**
 * Guard for specific permission gates.
 * Throws when the caller does not have the required permission.
 */
export async function requirePermission(permission: bigint): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  if (!hasPermission(admin.permissions, admin.isOwner, permission)) {
    throw new Error('Forbidden');
  }
  return admin;
}
