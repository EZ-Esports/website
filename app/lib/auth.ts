import { createClient } from '@/app/lib/supabase/server';

/**
 * Guard for admin server actions and protected API routes.
 *
 * Path-based middleware does NOT protect Next.js server actions: an action can
 * be dispatched (by its action id) against any route, including public ones,
 * which bypasses the `/admin` pathname check. Every admin mutation must call
 * this at the top so authorization is enforced in the data layer itself.
 *
 * Throws when there is no authenticated user.
 *
 * Uses getClaims() rather than getUser(): when the project has JWT signing keys
 * enabled it verifies the token locally (no round-trip to the Supabase Auth
 * API), and transparently falls back to a network call otherwise. The user id
 * lives in the standard `sub` claim.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims) {
    throw new Error('Unauthorized');
  }
  return { id: claims.sub, email: claims.email as string | undefined };
}
