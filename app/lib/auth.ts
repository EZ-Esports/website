import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { createClient } from '@/app/lib/supabase/server';
import { db } from '@/app/lib/db';
import { staffAuditLogs, staffMembers, userRoles, roles } from '@/app/lib/db/schema';
import { calculateEffectiveStaffAccess, hasPermission, Permissions } from '@/app/lib/roles';
import { ADMIN_SECTION_PERMISSIONS, type AdminSectionHref } from '@/app/lib/staff-access';

export interface StaffIdentity {
  id: string;
  email: string;
  permissions: bigint;
  isOwner: boolean;
  highestRolePosition: number;
}

/**
 * Raised when Supabase has a valid identity but the local staff directory
 * cannot be reconciled safely. This is an account-integrity error, not an
 * authentication failure, so callers must not redirect to /login or sign out.
 */
export class StaffSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffSetupError';
  }
}

async function recordStaffAuditEvent(
  event: string,
  userId: string,
  email: string | undefined,
  details: string,
) {
  try {
    await db.insert(staffAuditLogs).values({ event, userId, email, details });
  } catch (auditError) {
    console.error('Failed to persist staff audit event', { event, userId, email, auditError });
  }
}

/**
 * Ensure every authenticated portal identity has a staff directory row.
 * Signups remain invite-only, so a missing row represents an interrupted old
 * invite/seed flow and can be repaired safely. We never transfer an existing
 * email's roles to a different auth user id automatically.
 */
async function ensureStaffMember(userId: string, email: string | undefined): Promise<string> {
  if (!email) {
    throw new StaffSetupError('Your authenticated account has no email address. Ask an Owner to repair the account.');
  }

  const [existingById] = await db
    .select({ userId: staffMembers.userId, email: staffMembers.email })
    .from(staffMembers)
    .where(eq(staffMembers.userId, userId))
    .limit(1);

  if (existingById) {
    if (existingById.email !== email) {
      const [emailOwner] = await db
        .select({ userId: staffMembers.userId })
        .from(staffMembers)
        .where(eq(staffMembers.email, email))
        .limit(1);

      if (emailOwner && emailOwner.userId !== userId) {
        console.error('Staff account email conflict', { userId, email });
        await recordStaffAuditEvent('identity_email_conflict', userId, email, `Email is owned by ${emailOwner.userId}`);
        throw new StaffSetupError('This email is linked to another staff identity. Ask an Owner to reconcile the account.');
      }

      await db.update(staffMembers).set({ email }).where(eq(staffMembers.userId, userId));
    }
    return email;
  }

  const [existingByEmail] = await db
    .select({ userId: staffMembers.userId })
    .from(staffMembers)
    .where(eq(staffMembers.email, email))
    .limit(1);

  if (existingByEmail && existingByEmail.userId !== userId) {
    console.error('Staff account identity conflict', { userId, email, existingUserId: existingByEmail.userId });
    await recordStaffAuditEvent('identity_user_id_conflict', userId, email, `Existing user id: ${existingByEmail.userId}`);
    throw new StaffSetupError('This staff email belongs to a different identity. Ask an Owner to reconcile the account.');
  }

  await db
    .insert(staffMembers)
    .values({ userId, email, invitedBy: null })
    .onConflictDoNothing({ target: staffMembers.userId });

  const [created] = await db
    .select({ email: staffMembers.email })
    .from(staffMembers)
    .where(eq(staffMembers.userId, userId))
    .limit(1);

  if (!created) {
    throw new StaffSetupError('Your staff membership could not be initialized. Ask an Owner to repair the account.');
  }

  return created.email;
}

/**
 * Resolve the authenticated staff identity and effective Discord-style
 * permissions. @everyone is implicit; a staff member may validly have no
 * explicit roles and an effective permission mask of zero.
 */
export const getStaff = cache(async (): Promise<StaffIdentity | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return null;
  }

  const userId = claims.sub as string;
  const email = await ensureStaffMember(userId, claims.email as string | undefined);

  const assignedRoles = await db
    .select({
      permissions: roles.permissions,
      position: roles.position,
      isOwner: roles.isOwner,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const [everyoneRole] = await db
    .select({
      permissions: roles.permissions,
      position: roles.position,
      isOwner: roles.isOwner,
    })
    .from(roles)
    .where(eq(roles.name, '@everyone'))
    .limit(1);

  const { isOwner, permissions, highestRolePosition } = calculateEffectiveStaffAccess(
    assignedRoles,
    everyoneRole ?? null,
  );

  return { id: userId, email, permissions, isOwner, highestRolePosition };
});

/** Require an authenticated staff identity, regardless of assigned roles. */
export async function requireStaff(): Promise<StaffIdentity> {
  const staff = await getStaff();
  if (!staff) throw new Error('Unauthorized');
  return staff;
}

/** Require a specific effective permission for mutations and protected APIs. */
export async function requirePermission(permission: bigint): Promise<StaffIdentity> {
  const staff = await requireStaff();
  if (!hasPermission(staff.permissions, staff.isOwner, permission)) {
    throw new Error('Forbidden');
  }
  return staff;
}

/** Resolve a page identity without throwing when the member lacks access. */
export async function getStaffWithPermission(permission: bigint): Promise<StaffIdentity | null> {
  const staff = await getStaff();
  if (!staff || !hasPermission(staff.permissions, staff.isOwner, permission)) return null;
  return staff;
}

/** Authorize a browser section from the navigation's canonical route map. */
export function getStaffForAdminSection(section: AdminSectionHref) {
  return getStaffWithPermission(ADMIN_SECTION_PERMISSIONS[section]);
}

/** Require at least one permission in a mask (used by shared-purpose APIs). */
export async function requireAnyPermission(permissionMask: bigint): Promise<StaffIdentity> {
  const staff = await requireStaff();
  if (
    !staff.isOwner &&
    (staff.permissions & Permissions.ADMINISTRATOR) === BigInt(0) &&
    (staff.permissions & permissionMask) === BigInt(0)
  ) {
    throw new Error('Forbidden');
  }
  return staff;
}
