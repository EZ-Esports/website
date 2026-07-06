import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { listAdminUsers, listPendingAdminInvites } from '@/app/lib/db/queries';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import TeamManagerClient from '@/app/components/admin/TeamManagerClient';
import { desc } from 'drizzle-orm';

export default async function TeamAdminPage() {
  const current = await requirePermission(Permissions.MANAGE_ROLES);

  let admins: Awaited<ReturnType<typeof listAdminUsers>> = [];
  let invites: Awaited<ReturnType<typeof listPendingAdminInvites>> = [];
  let allRoles: (typeof schema.roles.$inferSelect)[] = [];

  try {
    if (process.env.DATABASE_URL) {
      [admins, invites, allRoles] = await Promise.all([
        listAdminUsers(),
        listPendingAdminInvites(),
        db
          .select()
          .from(schema.roles)
          .orderBy(desc(schema.roles.position)),
      ]);
    }
  } catch (error) {
    console.error('Failed to load team data on server', error);
  }

  // Serialize BigInt to string for Client Component props compatibility (JSON boundary)
  const serializedCurrent = {
    id: current.id,
    email: current.email,
    permissions: current.permissions.toString(),
    isOwner: current.isOwner,
    highestRolePosition: current.highestRolePosition,
  };

  const serializedAdmins = admins.map((a) => ({
    userId: a.userId,
    email: a.email,
    createdAt: a.createdAt,
    roles: a.roles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      permissions: r.permissions.toString(),
      position: r.position,
      isOwner: r.isOwner,
    })),
  }));

  const serializedInvites = invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    expiresAt: inv.expiresAt,
    expired: inv.expired,
    roles: inv.roles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
      isOwner: r.isOwner,
    })),
  }));

  const serializedRoles = allRoles.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    permissions: r.permissions.toString(),
    position: r.position,
    isOwner: r.isOwner,
    isSystem: r.isSystem,
  }));

  return (
    <TeamManagerClient
      current={serializedCurrent}
      admins={serializedAdmins}
      invites={serializedInvites}
      roles={serializedRoles}
    />
  );
}
