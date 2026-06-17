/**
 * Bootstrap the first admin.
 *
 * Authorization is now an allowlist: a valid Supabase Auth session is only
 * granted admin access if it has a matching row in `admin_users`. That table
 * starts empty, so after deploying this feature NOBODY can reach the panel —
 * including you. This one-off script promotes an EXISTING Supabase Auth user
 * (create it first in the Supabase dashboard, or it may already exist from
 * before this change) to `super_admin`, so they can invite everyone else.
 *
 * Usage:
 *   npm run db:seed-admin -- you@example.com
 *
 * Idempotent: re-running for the same email updates the role to super_admin.
 */
import { eq } from 'drizzle-orm';
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { createServiceClient } from '../app/lib/supabase/service';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run db:seed-admin -- <email>');
    process.exit(1);
  }

  const supabase = createServiceClient();

  // Find the existing auth user by email (paginate defensively).
  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('Failed to list auth users:', error.message);
      process.exit(1);
    }
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break; // last page
  }

  if (!userId) {
    console.error(
      `No Supabase Auth user found for "${email}". Create the account first ` +
        `(Supabase dashboard → Authentication → Add user), then re-run.`,
    );
    process.exit(1);
  }

  // Guard against the "same email, different user_id" case (e.g. auth account was
  // recreated). The onConflictDoUpdate below targets userId, so a stale row keyed
  // to an old user_id would trigger the email unique constraint instead — giving a
  // cryptic error. Detect and explain it upfront.
  const [existingByEmail] = await db
    .select({ userId: schema.adminUsers.userId })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, email))
    .limit(1);
  if (existingByEmail && existingByEmail.userId !== userId) {
    console.error(
      `An admin row already exists for "${email}" under a different user id (${existingByEmail.userId}). ` +
        `The auth account may have been recreated. Remove the stale admin_users row or reconcile the user id, then re-run.`,
    );
    process.exit(1);
  }

  await db
    .insert(schema.adminUsers)
    .values({ userId, email, role: 'super_admin' })
    .onConflictDoUpdate({
      target: schema.adminUsers.userId,
      set: { role: 'super_admin', email },
    });

  console.log(`✓ ${email} is now a super_admin (user_id ${userId}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
