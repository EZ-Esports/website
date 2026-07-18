'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { requirePermission } from '@/app/lib/auth';
import { Permissions, canActOnMember, canManageRole, canGrantPermissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
import { isValidEmail, sanitizeDbError } from '@/app/lib/text-utils';
import { ActionError } from '@/app/lib/errors';
import { rateLimit } from '@/app/lib/rate-limit';
import { generateInviteToken, hashInviteToken } from '@/app/lib/invite-token';
import { INVITE_TTL_DAYS } from './constants';
import { buildStaffInviteRoleRows } from '@/app/lib/staff-invites';

const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
const INVITE_RATE_LIMIT = 10;
const INVITE_RATE_WINDOW_MS = 60_000;
const STAFF_REVOKE_LOCK_KEY = 8765001;
const ROLE_MUTATE_LOCK_KEY = 8765002;

/** Helper to fetch a user's roles from the database */
async function getUserRolesInfo(userId: string) {
  const userRolesRows = await db
    .select({
      id: schema.roles.id,
      name: schema.roles.name,
      position: schema.roles.position,
      isOwner: schema.roles.isOwner,
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, userId));

  const isOwner = userRolesRows.some((r) => r.isOwner);
  const highestPosition = userRolesRows.reduce((max, r) => (r.position > max ? r.position : max), 0);
  return { roles: userRolesRows, isOwner, highestPosition };
}

/** Create a single-use staff invite, optionally mapping it to initial roles. */
export async function inviteStaff(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  token?: string;
  email?: string;
}> {
  const staff = await requirePermission(Permissions.MANAGE_ROLES);

  const rl = rateLimit(`staff-invite:${staff.id}`, INVITE_RATE_LIMIT, INVITE_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return { success: false, error: 'Too many invites. Please slow down and try again shortly.' };
  }

  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase();
  const roleIds = formData.getAll('roleIds') as string[];

  if (!isValidEmail(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const selectedRoles = roleIds.length > 0
    ? await db.select().from(schema.roles).where(inArray(schema.roles.id, roleIds))
    : [];

  if (selectedRoles.length !== roleIds.length) {
    return { success: false, error: 'One or more selected roles do not exist.' };
  }
  if (selectedRoles.some((role) => role.name === '@everyone')) {
    return { success: false, error: '@everyone is implicit and must not be assigned explicitly.' };
  }

  // Verify that all requested roles are lower in hierarchy and within the inviter's permissions subset
  for (const role of selectedRoles) {
    if (!canManageRole(staff.highestRolePosition, staff.isOwner, role.position)) {
      return {
        success: false,
        error: `You cannot grant the role "${role.name}" because it is equal to or higher than your own highest role.`,
      };
    }
    if (!canGrantPermissions(staff.permissions, staff.isOwner, BigInt(role.permissions))) {
      return {
        success: false,
        error: `You cannot grant the role "${role.name}" because it contains permissions you do not possess.`,
      };
    }
  }

  const [existingStaff] = await db
    .select({ userId: schema.staffMembers.userId })
    .from(schema.staffMembers)
    .where(eq(schema.staffMembers.email, email))
    .limit(1);
  if (existingStaff) {
    return { success: false, error: 'That email already belongs to a staff member.' };
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    await db.transaction(async (tx) => {
      // Clear out previous pending invites for this email
      const supersededInvites = await tx
        .select({ id: schema.staffInvites.id })
        .from(schema.staffInvites)
        .where(and(eq(schema.staffInvites.email, email), isNull(schema.staffInvites.acceptedAt)));

      if (supersededInvites.length > 0) {
        const supersededInviteIds = supersededInvites.map((i) => i.id);

        // Verify the actor has permission to revoke the superseded invite roles
        const associatedRoles = await tx
          .select({ name: schema.roles.name, position: schema.roles.position })
          .from(schema.staffInviteRoles)
          .innerJoin(schema.roles, eq(schema.staffInviteRoles.roleId, schema.roles.id))
          .where(inArray(schema.staffInviteRoles.inviteId, supersededInviteIds));

        for (const role of associatedRoles) {
          if (!canManageRole(staff.highestRolePosition, staff.isOwner, role.position)) {
            throw new ActionError(
              'SUPERSEDE_FORBIDDEN',
              `Only staff with a higher role rank can replace this pending invite containing the "${role.name}" role.`
            );
          }
        }

        await tx.delete(schema.staffInvites).where(inArray(schema.staffInvites.id, supersededInviteIds));
      }

      const [newInvite] = await tx
        .insert(schema.staffInvites)
        .values({
          email,
          tokenHash,
          invitedBy: staff.id,
          expiresAt,
        })
        .returning({ id: schema.staffInvites.id });

      if (roleIds.length > 0) {
        await tx.insert(schema.staffInviteRoles).values(
          buildStaffInviteRoleRows(newInvite.id, roleIds),
        );
      }
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message };
    }
    console.error('Failed to create staff invite', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidatePath('/admin/team');
  return { success: true, token, email };
}

/** Cancel a pending (unaccepted) invite. */
export async function revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requirePermission(Permissions.MANAGE_ROLES);

  // Fetch roles attached to the invite first to run hierarchy check
  const inviteRoles = await db
    .select({ name: schema.roles.name, position: schema.roles.position })
    .from(schema.staffInviteRoles)
    .innerJoin(schema.roles, eq(schema.staffInviteRoles.roleId, schema.roles.id))
    .where(eq(schema.staffInviteRoles.inviteId, inviteId));

  for (const role of inviteRoles) {
    if (!canManageRole(admin.highestRolePosition, admin.isOwner, role.position)) {
      return {
        success: false,
        error: `You cannot revoke this invite because it contains the "${role.name}" role which is equal to or higher than your own highest role.`,
      };
    }
  }

  try {
    const deleted = await db
      .delete(schema.staffInvites)
      .where(and(eq(schema.staffInvites.id, inviteId), isNull(schema.staffInvites.acceptedAt)))
      .returning({ id: schema.staffInvites.id });

    if (deleted.length === 0) {
      return { success: false, error: 'Invite not found or already accepted.' };
    }
  } catch (error) {
    console.error('Failed to revoke staff invite', error);
    return { success: false, error: 'Could not revoke invite. Please try again.' };
  }

  revalidatePath('/admin/team');
  return { success: true };
}

/** Explicitly revoke staff access, checking hierarchy and owner counts. */
export async function revokeStaff(userId: string): Promise<{ success: boolean; error?: string }> {
  const staff = await requirePermission(Permissions.MANAGE_ROLES);

  if (userId === staff.id) {
    return { success: false, error: 'You cannot revoke your own staff access.' };
  }

  // Fetch the target user's role info
  const targetInfo = await getUserRolesInfo(userId);
  const [targetUserRow] = await db
    .select()
    .from(schema.staffMembers)
    .where(eq(schema.staffMembers.userId, userId))
    .limit(1);

  if (!targetUserRow) {
    return { success: false, error: 'That user is not a staff member.' };
  }

  // Hierarchy check: Actor highest role position must be strictly greater than target's highest position
  if (!canActOnMember(staff.highestRolePosition, staff.isOwner, targetInfo.highestPosition, targetInfo.isOwner)) {
    return { success: false, error: 'You do not have permission to remove this staff member due to role hierarchy.' };
  }

  let deleted: { userId: string }[] = [];
  let wasLastOwner = false;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${STAFF_REVOKE_LOCK_KEY})`);

      // If target is an owner, verify there is at least one other owner in the database
      if (targetInfo.isOwner) {
        const owners = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
          .where(eq(schema.roles.isOwner, true));

        if (owners[0].count <= 1) {
          wasLastOwner = true;
          return;
        }
      }

      // Revoke the auth identity before deleting membership. If Supabase
      // rejects the revocation, the transaction rolls back and getStaff()
      // cannot recreate a deleted row from a still-valid identity.
      const supabase = createServiceClient();
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        throw new ActionError('AUTH_REVOKE_FAILED', 'Could not revoke the staff identity. No membership changes were made.');
      }

      deleted = await tx
        .delete(schema.staffMembers)
        .where(eq(schema.staffMembers.userId, userId))
        .returning({ userId: schema.staffMembers.userId });
    });
  } catch (error) {
    console.error('Failed to revoke staff access', error);
    return {
      success: false,
      error: error instanceof ActionError ? error.message : 'Could not revoke staff access. Please try again.',
    };
  }

  if (deleted.length === 0) {
    if (wasLastOwner) {
      return { success: false, error: 'Cannot remove the last remaining Owner.' };
    }
    revalidatePath('/admin/team');
    return { success: true };
  }

  revalidatePath('/admin/team');
  return { success: true };
}

/* --- ROLE MANAGEMENT ACTIONS --- */

/** List all roles ordered by position descending */
export async function listAllRoles() {
  await requirePermission(Permissions.MANAGE_ROLES);
  return db
    .select()
    .from(schema.roles)
    .orderBy(sql`${schema.roles.position} desc`);
}

/** Create a new custom role */
export async function createRole(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const admin = await requirePermission(Permissions.MANAGE_ROLES);

  const name = ((formData.get('name') as string) ?? '').trim();
  const color = ((formData.get('color') as string) ?? '#94a3b8').trim();
  const permissionsVal = BigInt((formData.get('permissions') as string) ?? '0');

  if (!name) {
    return { success: false, error: 'Role name is required.' };
  }

  if (name.toLowerCase() === '@everyone' || name.toLowerCase() === 'owner') {
    return { success: false, error: 'Role name cannot be "@everyone" or "owner" (system reserved).' };
  }

  // Prevent privilege escalation
  if (!canGrantPermissions(admin.permissions, admin.isOwner, permissionsVal)) {
    return { success: false, error: 'You cannot grant permissions that you do not possess.' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROLE_MUTATE_LOCK_KEY})`);

      // Determine initial position (1 + maximum position below actor's highest role, or position 1)
      let initialPosition = 1;
      const [maxPosRow] = await tx
        .select({ maxPos: sql<number>`max(${schema.roles.position})::int` })
        .from(schema.roles)
        .where(
          admin.isOwner
            ? undefined
            : sql`${schema.roles.position} < ${admin.highestRolePosition}`
        );

      if (maxPosRow && maxPosRow.maxPos !== null) {
        initialPosition = maxPosRow.maxPos + 1;
      }

      // Shifting roles at and above initialPosition to make space, keeping Owners at the top
      await tx
        .update(schema.roles)
        .set({ position: sql`${schema.roles.position} + 1` })
        .where(
          and(
            sql`${schema.roles.position} >= ${initialPosition}`,
            eq(schema.roles.isOwner, false)
          )
        );

      await tx.insert(schema.roles).values({
        name,
        color,
        permissions: permissionsVal,
        position: initialPosition,
        isOwner: false,
        isSystem: false,
      });
    });
  } catch (error) {
    console.error('Failed to create role', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidatePath('/admin/team');
  return { success: true };
}

/** Update an existing role's name, color, or permissions */
export async function updateRole(roleId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  const admin = await requirePermission(Permissions.MANAGE_ROLES);

  const name = ((formData.get('name') as string) ?? '').trim();
  const color = ((formData.get('color') as string) ?? '#94a3b8').trim();
  const permissionsVal = BigInt((formData.get('permissions') as string) ?? '0');

  if (!name) {
    return { success: false, error: 'Role name is required.' };
  }

  // Fetch existing role
  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
    .limit(1);

  if (!role) {
    return { success: false, error: 'Role not found.' };
  }

  // Check hierarchy: actor highest position must be strictly higher than target role's position
  if (!canManageRole(admin.highestRolePosition, admin.isOwner, role.position)) {
    return { success: false, error: 'You do not have permission to manage this role due to role hierarchy.' };
  }

  // Block renaming system roles
  if (role.isSystem && name !== role.name) {
    return { success: false, error: 'You cannot rename a system-defined role.' };
  }

  // Prevent privilege escalation
  if (!canGrantPermissions(admin.permissions, admin.isOwner, permissionsVal)) {
    return { success: false, error: 'You cannot grant permissions that you do not possess.' };
  }

  // Prevent modifying Owner role permissions
  if (role.isOwner && permissionsVal !== BigInt(role.permissions)) {
    return { success: false, error: 'The Owner role permissions are immutable.' };
  }

  try {
    await db
      .update(schema.roles)
      .set({
        name,
        color,
        permissions: permissionsVal,
      })
      .where(eq(schema.roles.id, roleId));
  } catch (error) {
    console.error('Failed to update role', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidatePath('/admin/team');
  return { success: true };
}

/** Delete a custom role */
export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requirePermission(Permissions.MANAGE_ROLES);

  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
    .limit(1);

  if (!role) {
    return { success: false, error: 'Role not found.' };
  }

  if (role.isSystem) {
    return { success: false, error: 'System-defined roles cannot be deleted.' };
  }

  // Check hierarchy: actor highest position must be strictly higher than target role's position
  if (!canManageRole(admin.highestRolePosition, admin.isOwner, role.position)) {
    return { success: false, error: 'You do not have permission to delete this role due to role hierarchy.' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROLE_MUTATE_LOCK_KEY})`);

      // Shifting position indexes of roles above the deleted one down to prevent index fragmentation
      await tx
        .update(schema.roles)
        .set({ position: sql`${schema.roles.position} - 1` })
        .where(
          and(
            sql`${schema.roles.position} > ${role.position}`,
            eq(schema.roles.isOwner, false)
          )
        );

      await tx.delete(schema.roles).where(eq(schema.roles.id, roleId));
    });
  } catch (error) {
    console.error('Failed to delete role', error);
    return { success: false, error: 'Could not delete role. Please try again.' };
  }

  revalidatePath('/admin/team');
  return { success: true };
}

/** Reorder roles (excluding Owner and @everyone) */
export async function reorderRoles(orderedRoleIds: string[]): Promise<{ success: boolean; error?: string }> {
  const admin = await requirePermission(Permissions.MANAGE_ROLES);

  if (orderedRoleIds.length === 0) {
    return { success: true };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROLE_MUTATE_LOCK_KEY})`);

      // Fetch all roles to compare positions
      const allRoles = await tx.select().from(schema.roles);
      const rolesMap = new Map(allRoles.map((r) => [r.id, r]));

      // Verify that all role IDs in the reorder request are manageable by the actor
      for (const roleId of orderedRoleIds) {
        const role = rolesMap.get(roleId);
        if (!role) {
          throw new ActionError('INVALID_ROLE', 'One or more role IDs are invalid.');
        }
        if (role.isOwner || role.name === '@everyone') {
          throw new ActionError('IMMUTABLE_ROLE', 'Cannot reorder Owner or @everyone roles.');
        }
        if (!canManageRole(admin.highestRolePosition, admin.isOwner, role.position)) {
          throw new ActionError('HIERARCHY_VIOLATION', `You do not have permission to reorder the role "${role.name}".`);
        }
      }

      // Reorder roles by assigning positions: starting from 1 (above @everyone) up to the length
      // Owner is unaffected because it stays at the top.
      for (let i = 0; i < orderedRoleIds.length; i++) {
        const roleId = orderedRoleIds[i];
        const newPosition = i + 1; // position 0 is @everyone

        const role = rolesMap.get(roleId)!;
        // Verify that the new position doesn't exceed/equal the actor's own highest role position
        if (!canManageRole(admin.highestRolePosition, admin.isOwner, newPosition)) {
          throw new ActionError(
            'HIERARCHY_VIOLATION',
            `You do not have permission to move "${role.name}" to position ${newPosition} (equals or exceeds your own highest role rank).`
          );
        }

        await tx
          .update(schema.roles)
          .set({ position: newPosition })
          .where(eq(schema.roles.id, roleId));
      }
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message };
    }
    console.error('Failed to reorder roles', error);
    return { success: false, error: 'Could not reorder roles. Please try again.' };
  }

  revalidatePath('/admin/team');
  return { success: true };
}

/** Assign/unassign roles for a staff member, observing hierarchies. */
export async function updateUserRoles(targetUserId: string, roleIds: string[]): Promise<{ success: boolean; error?: string }> {
  const admin = await requirePermission(Permissions.MANAGE_ROLES);

  // Fetch actor hierarchy info
  const actorInfo = admin;

  // Fetch target member details and current roles
  const targetInfo = await getUserRolesInfo(targetUserId);
  const [targetUserRow] = await db
    .select()
    .from(schema.staffMembers)
    .where(eq(schema.staffMembers.userId, targetUserId))
    .limit(1);

  if (!targetUserRow) {
    return { success: false, error: 'Staff member not found.' };
  }

  // Hierarchy rule: Actor highest role position must be strictly higher than target user's current highest position
  if (!canActOnMember(actorInfo.highestRolePosition, actorInfo.isOwner, targetInfo.highestPosition, targetInfo.isOwner)) {
    return { success: false, error: 'You do not have permission to manage this staff member due to role hierarchy.' };
  }

  // Fetch the new roles to validate
  const newRoles = roleIds.length > 0
    ? await db.select().from(schema.roles).where(inArray(schema.roles.id, roleIds))
    : [];

  if (newRoles.length !== roleIds.length) {
    return { success: false, error: 'One or more selected roles do not exist.' };
  }
  if (newRoles.some((role) => role.name === '@everyone')) {
    return { success: false, error: '@everyone is implicit and must not be assigned explicitly.' };
  }

  // Determine what is being added and removed to enforce hierarchy checks on those specific roles
  const currentRoleIds = targetInfo.roles.map((r) => r.id);
  const addedRoles = newRoles.filter((r) => !currentRoleIds.includes(r.id));

  // Determine roles being removed
  const targetRoleIds = newRoles.map((r) => r.id);
  const removedRoles = targetInfo.roles.filter((r) => !targetRoleIds.includes(r.id));

  // Validate added roles: must be strictly lower than actor's highest role, and actor must possess their permissions
  for (const role of addedRoles) {
    if (!canManageRole(actorInfo.highestRolePosition, actorInfo.isOwner, role.position)) {
      return { success: false, error: `You cannot add the role "${role.name}" because its rank equals or exceeds yours.` };
    }
    if (!canGrantPermissions(actorInfo.permissions, actorInfo.isOwner, BigInt(role.permissions))) {
      return { success: false, error: `You cannot grant the role "${role.name}" because it contains permissions you do not possess.` };
    }
  }

  // Validate removed roles: must be strictly lower than actor's highest role
  for (const role of removedRoles) {
    if (!canManageRole(actorInfo.highestRolePosition, actorInfo.isOwner, role.position)) {
      return { success: false, error: `You cannot remove the role "${role.name}" because its rank equals or exceeds yours.` };
    }
  }

  let wasLastOwner = false;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${STAFF_REVOKE_LOCK_KEY})`);

      // If target currently has the Owner role but is being stripped of it, verify there's at least one other owner
      const isLosingOwner = targetInfo.roles.some((r) => r.isOwner) && !newRoles.some((r) => r.isOwner);
      if (isLosingOwner) {
        const owners = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
          .where(eq(schema.roles.isOwner, true));

        if (owners[0].count <= 1) {
          wasLastOwner = true;
          return;
        }
      }

      // Wipe current user roles and insert the new set
      await tx.delete(schema.userRoles).where(eq(schema.userRoles.userId, targetUserId));

      if (roleIds.length > 0) {
        await tx.insert(schema.userRoles).values(
          roleIds.map((roleId) => ({
            userId: targetUserId,
            roleId,
          }))
        );
      }
    });
  } catch (error) {
    console.error('Failed to update user roles', error);
    return { success: false, error: 'Could not update user roles. Please try again.' };
  }

  if (wasLastOwner) {
    return { success: false, error: 'Cannot remove the Owner role from the last remaining Owner.' };
  }

  revalidatePath('/admin/team');
  return { success: true };
}
