import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import { members, schoolManagers, staffMembers } from '@/app/lib/db/schema';

/** Any query surface that can run selects: the pool or a transaction handle. */
type Selectable = Pick<typeof db, 'select'>;

/**
 * True when the auth identity is an active school manager, either directly
 * (`school_managers.user_id`) or through the member record that shares its
 * email, mirroring the portal login check. Staff-only accounts are never
 * managers, so a false result must not be read as "not staff".
 */
export async function isActiveSchoolManager(
  executor: Selectable,
  userId: string,
  email: string,
): Promise<boolean> {
  const [byUser] = await executor
    .select({ id: schoolManagers.id })
    .from(schoolManagers)
    .where(and(eq(schoolManagers.userId, userId), eq(schoolManagers.isActive, true)))
    .limit(1);
  if (byUser) return true;

  const [member] = await executor
    .select({ id: members.id })
    .from(members)
    .where(sql`lower(${members.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  if (!member) return false;

  const [byMember] = await executor
    .select({ id: schoolManagers.id })
    .from(schoolManagers)
    .where(and(eq(schoolManagers.memberId, member.id), eq(schoolManagers.isActive, true)))
    .limit(1);
  return Boolean(byMember);
}

/**
 * Where a freshly signed-in identity belongs. School managers are portal-only
 * users: sending them to /admin would otherwise provision a staff directory row
 * as a side effect. Anyone who already has a staff row (including people who
 * are both staff and managers) keeps /admin.
 */
export async function resolvePostLoginDestination(
  userId: string,
  email: string,
): Promise<'/admin' | '/portal'> {
  const [staffRow] = await db
    .select({ userId: staffMembers.userId })
    .from(staffMembers)
    .where(eq(staffMembers.userId, userId))
    .limit(1);
  if (staffRow) return '/admin';
  return (await isActiveSchoolManager(db, userId, email)) ? '/portal' : '/admin';
}
