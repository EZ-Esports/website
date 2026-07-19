import { getStaffForAdminSection } from '@/app/lib/auth';
import { listStaffMembers, listPendingStaffInvites } from '@/app/lib/db/queries';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import TeamManagerClient from '@/app/components/admin/TeamManagerClient';
import { desc } from 'drizzle-orm';
import PermissionDenied from '@/app/components/admin/PermissionDenied';

export default async function TeamAdminPage() {
  const current = await getStaffForAdminSection('/admin/team');
  if (!current) return <PermissionDenied />;

  let staffMembers: Awaited<ReturnType<typeof listStaffMembers>> = [];
  let invites: Awaited<ReturnType<typeof listPendingStaffInvites>> = [];
  let allRoles: (typeof schema.roles.$inferSelect)[] = [];

  try {
    if (process.env.DATABASE_URL) {
      [staffMembers, invites, allRoles] = await Promise.all([
        listStaffMembers(),
        listPendingStaffInvites(),
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

  const serializedStaffMembers = staffMembers.map((member) => ({
    userId: member.userId,
    email: member.email,
    createdAt: member.createdAt,
    roles: member.roles.map((r) => ({
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
      staffMembers={serializedStaffMembers}
      invites={serializedInvites}
      roles={serializedRoles}
    />
  );
}
