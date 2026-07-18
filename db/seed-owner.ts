/**
 * Bootstrap the first owner.
 *
 * Every valid portal identity receives staff membership. This script promotes
 * an EXISTING Supabase Auth user to the Owner role,
 * allowing them to access the staff panel, create roles, and invite others.
 *
 * Usage:
 *   npm run db:seed-owner -- you@example.com
 *   npm run db:seed-owner -- you@example.com --restore-revoked
 *
 * Idempotent: re-running for the same email ensures the Owner role exists and
 * links the user to it.
 */
import { eq, or, sql } from 'drizzle-orm';
import { db } from '../app/lib/db';
import * as schema from '../app/lib/db/schema';
import { createServiceClient } from '../app/lib/supabase/service';
import { STAFF_REVOCATION_LOCK_KEY } from '../app/lib/staff-revocation';

const ADMINISTRATOR = BigInt(1) << BigInt(0);

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const restoreRevoked = process.argv.includes('--restore-revoked');
  if (!email) {
    console.error('Usage: npm run db:seed-owner -- <email>');
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
    .select({ userId: schema.staffMembers.userId })
    .from(schema.staffMembers)
    .where(eq(schema.staffMembers.email, email))
    .limit(1);
  if (existingByEmail && existingByEmail.userId !== userId) {
    console.error(
      `A staff row already exists for "${email}" under a different user id (${existingByEmail.userId}). ` +
        `The auth account may have been recreated. Reconcile the stale staff_members identity, then re-run.`,
    );
    process.exit(1);
  }

  // 1. Ensure the system Owner role exists
  let [ownerRole] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.name, 'Owner'))
    .limit(1);

  if (!ownerRole) {
    console.log('Creating "Owner" system role...');
    [ownerRole] = await db
      .insert(schema.roles)
      .values({
        name: 'Owner',
        color: '#ef4444', // Red
        permissions: ADMINISTRATOR,
        position: 9999, // Absolute top
        isOwner: true,
        isSystem: true,
      })
      .returning();
  }

  // 2. Ensure the system @everyone role exists
  let [everyoneRole] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.name, '@everyone'))
    .limit(1);

  if (!everyoneRole) {
    console.log('Creating "@everyone" system role...');
    [everyoneRole] = await db
      .insert(schema.roles)
      .values({
        name: '@everyone',
        color: '#94a3b8', // Slate/gray
        permissions: BigInt(0), // baseline is read-only / no permissions
        position: 0, // Absolute bottom
        isOwner: false,
        isSystem: true,
      })
      .returning();
  }

  // 3. Explicitly clear a revocation (when requested), restore membership,
  // and associate the Owner role as one atomic authorization change.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${STAFF_REVOCATION_LOCK_KEY})`);

    const [revocation] = await tx
      .select({ userId: schema.staffRevocations.userId, email: schema.staffRevocations.email })
      .from(schema.staffRevocations)
      .where(
        or(
          eq(schema.staffRevocations.userId, userId),
          eq(schema.staffRevocations.email, email),
        ),
      )
      .limit(1);

    if (revocation && !restoreRevoked) {
      throw new Error(
        `Staff access for "${email}" was explicitly revoked. Re-run with --restore-revoked ` +
          'only if an Owner has intentionally approved restoring this identity.',
      );
    }

    if (revocation) {
      await tx
        .delete(schema.staffRevocations)
        .where(
          or(
            eq(schema.staffRevocations.userId, userId),
            eq(schema.staffRevocations.email, email),
          ),
        );

      await tx.insert(schema.staffAuditLogs).values({
        event: 'staff_access_restored_by_owner_seed',
        userId,
        email,
        details: `Cleared revocation for prior identity ${revocation.userId}`,
      });
    }

    await tx
      .insert(schema.staffMembers)
      .values({ userId, email })
      .onConflictDoUpdate({
        target: schema.staffMembers.userId,
        set: { email },
      });

    await tx
      .insert(schema.userRoles)
      .values({ userId, roleId: ownerRole.id })
      .onConflictDoNothing();
  });

  console.log(`✓ ${email} is now an Owner (user_id ${userId}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
