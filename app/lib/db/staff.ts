import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { asc, desc, eq, isNull } from 'drizzle-orm';

/** All provisioned staff members, oldest first. */
export const listStaffMembers = async () => {
  const users = await db
    .select({
      userId: schema.staffMembers.userId,
      email: schema.staffMembers.email,
      createdAt: schema.staffMembers.createdAt,
    })
    .from(schema.staffMembers)
    .orderBy(asc(schema.staffMembers.createdAt));

  if (users.length === 0) return [];

  const userRolesRows = await db
    .select({
      userId: schema.userRoles.userId,
      role: {
        id: schema.roles.id,
        name: schema.roles.name,
        color: schema.roles.color,
        isOwner: schema.roles.isOwner,
        position: schema.roles.position,
        permissions: schema.roles.permissions,
      },
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id));

  // Group by userId
  const rolesByUserId = new Map<string, typeof userRolesRows[0]['role'][]>();
  for (const row of userRolesRows) {
    if (!rolesByUserId.has(row.userId)) {
      rolesByUserId.set(row.userId, []);
    }
    rolesByUserId.get(row.userId)!.push(row.role);
  }

  return users.map((u) => {
    const roles = rolesByUserId.get(u.userId) || [];
    // Sort roles by position descending (highest first)
    roles.sort((a, b) => b.position - a.position);
    return {
      ...u,
      roles,
    };
  });
};

/** Outstanding (not yet accepted) staff invites, newest first, each tagged with
 * whether its link has already expired (computed here so the UI stays pure). */
export const listPendingStaffInvites = async () => {
  const rows = await db
    .select({
      id: schema.staffInvites.id,
      email: schema.staffInvites.email,
      expiresAt: schema.staffInvites.expiresAt,
      createdAt: schema.staffInvites.createdAt,
    })
    .from(schema.staffInvites)
    .where(isNull(schema.staffInvites.acceptedAt))
    .orderBy(desc(schema.staffInvites.createdAt));

  if (rows.length === 0) return [];

  const inviteRolesRows = await db
    .select({
      inviteId: schema.staffInviteRoles.inviteId,
      role: {
        id: schema.roles.id,
        name: schema.roles.name,
        color: schema.roles.color,
        position: schema.roles.position,
        isOwner: schema.roles.isOwner,
      },
    })
    .from(schema.staffInviteRoles)
    .innerJoin(schema.roles, eq(schema.staffInviteRoles.roleId, schema.roles.id));

  // Group by inviteId
  const rolesByInviteId = new Map<string, typeof inviteRolesRows[0]['role'][]>();
  for (const row of inviteRolesRows) {
    if (!rolesByInviteId.has(row.inviteId)) {
      rolesByInviteId.set(row.inviteId, []);
    }
    rolesByInviteId.get(row.inviteId)!.push(row.role);
  }

  const now = Date.now();
  return rows.map((row) => {
    const roles = rolesByInviteId.get(row.id) || [];
    // Sort roles by position descending (highest first)
    roles.sort((a, b) => b.position - a.position);
    return {
      ...row,
      roles,
      expired: row.expiresAt.getTime() < now,
    };
  });
};
