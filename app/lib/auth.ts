import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { createClient } from '@/app/lib/supabase/server';
import { db } from '@/app/lib/db';
import { adminUsers } from '@/app/lib/db/schema';
import type { AdminRole } from '@/app/lib/roles';

export type { AdminRole } from '@/app/lib/roles';
export { isSuperAdmin, canActOnRole } from '@/app/lib/roles';

export interface AdminIdentity {
  id: string;
  email: string | undefined;
  role: AdminRole;
}

/**
 * Resolve the current request's admin identity, or null if the caller is not a
 * provisioned admin. Authentication alone is NOT enough: a valid Supabase Auth
 * session must also have a matching row in `admin_users` (the allowlist). This
 * is the single authorization gate for the whole admin panel.
 *
 * Uses getClaims() rather than getUser(): when the project has JWT signing keys
 * enabled it verifies the token locally (no round-trip to the Supabase Auth
 * API), and transparently falls back to a network call otherwise. The user id
 * lives in the standard `sub` claim. The role is read from the DB on every call
 * (no JWT role claim), so invites/revocations take effect immediately.
 *
 * Wrapped in React.cache() so repeated calls within a single request render
 * (e.g. the (admin) layout's gate plus a page reading the current role)
 * collapse to one JWT verify + DB lookup.
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
    .select({ email: adminUsers.email, role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.userId, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: userId,
    email: (claims.email as string | undefined) ?? row.email,
    role: row.role,
  };
});

/**
 * Guard for admin server actions and protected API routes.
 *
 * Path-based middleware does NOT protect Next.js server actions: an action can
 * be dispatched (by its action id) against any route, including public ones,
 * which bypasses the `/admin` pathname check. Every admin mutation must call
 * this at the top so authorization is enforced in the data layer itself.
 *
 * Throws when the caller is not an authenticated, allowlisted admin.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  return admin;
}
