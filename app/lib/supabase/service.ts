import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Uses the secret key, so it BYPASSES Row Level
 * Security — never import this into client code or expose it to the browser.
 *
 * Use it only in server actions / route handlers that have already authorized
 * the caller (e.g. via requireAdmin()). The cookie-based anon client from
 * `./server` is RLS-enforced and cannot delete objects in the private
 * `admin-uploads` bucket; storage writes/removes must go through this client.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}
