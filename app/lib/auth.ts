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
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
