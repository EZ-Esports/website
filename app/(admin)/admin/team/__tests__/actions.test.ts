import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Schema and lock keys
import * as schema from '@/app/lib/db/schema';
import { Permissions } from '@/app/lib/roles';
import { STAFF_REVOCATION_LOCK_KEY } from '@/app/lib/staff-revocation';

const mocks = vi.hoisted(() => {
  const mockRevalidatePath = vi.fn();
  const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });
  const mockRequirePermission = vi.fn();

  interface RoleRecord {
    id: string;
    name: string;
    color: string;
    permissions: bigint;
    position: number;
    isOwner: boolean;
    isSystem: boolean;
  }

  interface StaffMemberRecord {
    userId: string;
    email: string;
    invitedBy?: string | null;
  }

  interface UserRoleRecord {
    userId: string;
    roleId: string;
  }

  interface StaffInviteRecord {
    id: string;
    email: string;
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
    acceptedAt: Date | null;
  }

  interface StaffInviteRoleRecord {
    inviteId: string;
    roleId: string;
  }

  const state = {
    rolesStore: [] as RoleRecord[],
    staffMembersStore: [] as StaffMemberRecord[],
    userRolesStore: [] as UserRoleRecord[],
    staffInvitesStore: [] as StaffInviteRecord[],
    staffInviteRolesStore: [] as StaffInviteRoleRecord[],
    onLockHook: null as (() => void) | null,
    executedLocks: [] as number[],
  };

  function extractConditions(clause: any): Array<{ col: string; op: 'eq' | 'in' | 'isNull'; val?: any }> {
    if (!clause || !clause.queryChunks) return [];
    const chunks = clause.queryChunks;
    const conditions: Array<{ col: string; op: 'eq' | 'in' | 'isNull'; val?: any }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk && chunk.queryChunks) {
        conditions.push(...extractConditions(chunk));
      } else if (chunk && typeof chunk === 'object' && 'name' in chunk) {
        const colName = chunk.name;
        const opChunk = (chunks[i + 1] && chunks[i + 1].value) ? chunks[i + 1].value[0] : '';
        if (opChunk.includes('=')) {
          const valChunk = chunks[i + 2];
          const val = valChunk?.value !== undefined ? valChunk.value : valChunk;
          conditions.push({ col: colName, op: 'eq', val });
        } else if (opChunk.includes('in')) {
          const valChunk = chunks[i + 2];
          const vals = Array.isArray(valChunk) ? valChunk.map((p: any) => p.value ?? p) : [];
          conditions.push({ col: colName, op: 'in', val: vals });
        } else if (opChunk.includes('is null')) {
          conditions.push({ col: colName, op: 'isNull' });
        }
      }
    }
    return conditions;
  }

  function matchesRow(row: any, cond: { col: string; op: string; val?: any }): boolean {
    const camelCol = cond.col.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    const actualVal = row[camelCol] !== undefined ? row[camelCol] : row[cond.col];
    if (cond.op === 'eq') {
      return actualVal === cond.val;
    }
    if (cond.op === 'in') {
      return Array.isArray(cond.val) && cond.val.includes(actualVal);
    }
    if (cond.op === 'isNull') {
      return actualVal === null || actualVal === undefined;
    }
    return true;
  }

  const mockDb = {
    select: () => {
      let currentTable: unknown = null;
      let isJoin = false;
      let joinTable: unknown = null;
      let whereClause: unknown = null;

      const builder = {
        from: vi.fn((tbl: unknown) => {
          currentTable = tbl;
          return builder;
        }),
        innerJoin: vi.fn((tbl: unknown) => {
          isJoin = true;
          joinTable = tbl;
          return builder;
        }),
        where: vi.fn((clause: unknown) => {
          whereClause = clause;
          return builder;
        }),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(async () => executeQuery()),
        then: (resolve: (val: unknown) => void) => {
          resolve(executeQuery());
        },
      };

      function executeQuery(): any[] {
        const conds = extractConditions(whereClause);
        if (currentTable === schema.roles) {
          return state.rolesStore
            .filter((r) => conds.every((c) => matchesRow(r, c)))
            .map((r) => ({ ...r }));
        }
        if (currentTable === schema.staffMembers) {
          return state.staffMembersStore
            .filter((s) => conds.every((c) => matchesRow(s, c)))
            .map((s) => ({ ...s }));
        }
        if (currentTable === schema.userRoles && isJoin && joinTable === schema.roles) {
          const results: any[] = [];
          for (const ur of state.userRolesStore) {
            const role = state.rolesStore.find((r) => r.id === ur.roleId);
            if (role) {
              const joinedRow = {
                userId: ur.userId,
                id: role.id,
                name: role.name,
                position: role.position,
                isOwner: role.isOwner,
                permissions: role.permissions,
              };
              if (conds.every((c) => matchesRow(joinedRow, c))) {
                results.push(joinedRow);
              }
            }
          }
          return results;
        }
        if (currentTable === schema.staffInviteRoles && isJoin && joinTable === schema.roles) {
          const results: any[] = [];
          for (const sir of state.staffInviteRolesStore) {
            const role = state.rolesStore.find((r) => r.id === sir.roleId);
            if (role) {
              const joinedRow = {
                inviteId: sir.inviteId,
                name: role.name,
                position: role.position,
                isOwner: role.isOwner,
                permissions: role.permissions,
              };
              if (conds.every((c) => matchesRow(joinedRow, c))) {
                results.push(joinedRow);
              }
            }
          }
          return results;
        }
        if (currentTable === schema.staffInvites) {
          return state.staffInvitesStore
            .filter((i) => conds.every((c) => matchesRow(i, c)))
            .map((i) => ({ ...i }));
        }
        return [];
      }

      return builder;
    },

    insert: (table: unknown) => ({
      values: vi.fn((data: any) => {
        const rows = Array.isArray(data) ? data : [data];
        if (table === schema.userRoles) {
          for (const r of rows) {
            state.userRolesStore.push({ userId: r.userId, roleId: r.roleId });
          }
        } else if (table === schema.roles) {
          for (const r of rows) {
            state.rolesStore.push({ ...r, id: r.id ?? `role-${state.rolesStore.length + 1}` });
          }
        } else if (table === schema.staffInvites) {
          for (const r of rows) {
            state.staffInvitesStore.push({ ...r, id: r.id ?? `invite-${state.staffInvitesStore.length + 1}` });
          }
        } else if (table === schema.staffInviteRoles) {
          for (const r of rows) {
            state.staffInviteRolesStore.push({ ...r });
          }
        }
        return {
          returning: vi.fn(async () => rows.map((r: any, idx: number) => ({ id: r.id ?? `id-${idx}` }))),
          then: (resolve: (val: unknown) => void) => resolve(rows),
        };
      }),
    }),

    update: (table: unknown) => {
      let updateSet: any = null;
      let updateClause: any = null;
      const builder = {
        set: vi.fn((vals: any) => {
          updateSet = vals;
          return builder;
        }),
        where: vi.fn(async (clause: any) => {
          updateClause = clause;
          const conds = extractConditions(updateClause);
          if (table === schema.roles) {
            for (const r of state.rolesStore) {
              if (conds.every((c) => matchesRow(r, c))) {
                Object.assign(r, updateSet);
              }
            }
          }
          return updateSet;
        }),
        then: (resolve: (val: unknown) => void) => resolve(updateSet),
      };
      return builder;
    },

    delete: (table: unknown) => {
      let deleteClause: any = null;
      const builder = {
        where: vi.fn((clause: unknown) => {
          deleteClause = clause;
          return builder;
        }),
        returning: vi.fn(async () => executeDelete()),
        then: (resolve: (val: unknown) => void) => resolve(executeDelete()),
      };

      function executeDelete(): any[] {
        const conds = extractConditions(deleteClause);
        if (table === schema.userRoles) {
          const removed = state.userRolesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
          state.userRolesStore = state.userRolesStore.filter((r) => !conds.every((c) => matchesRow(r, c)));
          return removed.map((r) => ({ userId: r.userId }));
        }
        if (table === schema.staffInvites) {
          const removed = state.staffInvitesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
          state.staffInvitesStore = state.staffInvitesStore.filter((r) => !conds.every((c) => matchesRow(r, c)));
          return removed.map((r) => ({ id: r.id }));
        }
        return [{ id: 'deleted-id' }];
      }

      return builder;
    },

    execute: vi.fn(async () => {
      state.executedLocks.push(8765001);
      if (state.onLockHook) {
        const hook = state.onLockHook;
        state.onLockHook = null;
        hook();
      }
      return undefined;
    }),

    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(mockDb);
    }),
  };

  return {
    mockRevalidatePath,
    mockDeleteUser,
    mockRequirePermission,
    mockDb,
    state,
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.mockRevalidatePath(...args),
}));

vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        deleteUser: mocks.mockDeleteUser,
      },
    },
  }),
}));

vi.mock('@/app/lib/auth', () => ({
  requirePermission: (...args: unknown[]) => mocks.mockRequirePermission(...args),
}));

vi.mock('@/app/lib/db', () => ({ db: mocks.mockDb }));

import {
  updateUserRoles,
  updateRole,
  revokeInvite,
  revokeStaff,
} from '../actions';

describe('Team actions lock-then-re-read concurrency authorization (Issue #156)', () => {
  const everyoneRole = {
    id: 'role-everyone',
    name: '@everyone',
    color: '#94a3b8',
    permissions: BigInt(0),
    position: 0,
    isOwner: false,
    isSystem: true,
  };

  const viewerRole = {
    id: 'role-viewer',
    name: 'Viewer',
    color: '#3b82f6',
    permissions: BigInt(0),
    position: 10,
    isOwner: false,
    isSystem: false,
  };

  const managerRole = {
    id: 'role-manager',
    name: 'Manager',
    color: '#10b981',
    permissions: Permissions.MANAGE_ROLES,
    position: 50,
    isOwner: false,
    isSystem: false,
  };

  const adminRole = {
    id: 'role-admin',
    name: 'Admin',
    color: '#f59e0b',
    permissions: Permissions.MANAGE_ROLES | Permissions.ADMINISTRATOR,
    position: 80,
    isOwner: false,
    isSystem: false,
  };

  const ownerRole = {
    id: 'role-owner',
    name: 'Owner',
    color: '#ef4444',
    permissions: Permissions.ADMINISTRATOR,
    position: 100,
    isOwner: true,
    isSystem: true,
  };

  const managerUser = {
    id: 'user-manager',
    email: 'manager@example.com',
    permissions: Permissions.MANAGE_ROLES,
    isOwner: false,
    highestRolePosition: 50,
  };

  const targetUser = {
    userId: 'user-target',
    email: 'target@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.onLockHook = null;
    mocks.state.executedLocks.length = 0;

    mocks.state.rolesStore = [everyoneRole, viewerRole, managerRole, adminRole, ownerRole];
    mocks.state.staffMembersStore = [
      { userId: managerUser.id, email: managerUser.email },
      { userId: targetUser.userId, email: targetUser.email },
      { userId: 'user-owner', email: 'owner@example.com' },
    ];
    mocks.state.userRolesStore = [
      { userId: managerUser.id, roleId: managerRole.id },
      { userId: targetUser.userId, roleId: viewerRole.id },
      { userId: 'user-owner', roleId: ownerRole.id },
    ];
    mocks.state.staffInvitesStore = [];
    mocks.state.staffInviteRolesStore = [];

    mocks.mockRequirePermission.mockResolvedValue(managerUser);
  });

  describe('updateUserRoles (assign / edit member roles)', () => {
    it('aborts when target member is concurrently promoted above actor before lock acquisition', async () => {
      // Simulate Manager M (pos 50) attempting to update target X (initially pos 10).
      // Between pre-lock check and lock acquisition, Owner promotes X to Admin (pos 80).
      mocks.state.onLockHook = () => {
        mocks.state.userRolesStore = mocks.state.userRolesStore.filter((ur) => ur.userId !== targetUser.userId);
        mocks.state.userRolesStore.push({ userId: targetUser.userId, roleId: adminRole.id });
      };

      const result = await updateUserRoles(targetUser.userId, [viewerRole.id]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/role hierarchy changed/i);
      expect(mocks.state.executedLocks).toContain(STAFF_REVOCATION_LOCK_KEY);
      // Verify userRolesStore was NOT overwritten with viewerRole
      expect(mocks.state.userRolesStore.some((ur) => ur.userId === targetUser.userId && ur.roleId === adminRole.id)).toBe(true);
      expect(mocks.state.userRolesStore.some((ur) => ur.userId === targetUser.userId && ur.roleId === viewerRole.id)).toBe(false);
    });

    it('aborts when target member is concurrently promoted to Owner before lock acquisition', async () => {
      mocks.state.onLockHook = () => {
        mocks.state.userRolesStore.push({ userId: targetUser.userId, roleId: ownerRole.id });
      };

      const result = await updateUserRoles(targetUser.userId, [viewerRole.id]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/role hierarchy changed/i);
      expect(mocks.state.executedLocks).toContain(STAFF_REVOCATION_LOCK_KEY);
    });

    it('aborts when actor manager is concurrently demoted below target before lock acquisition', async () => {
      // Manager M (pos 50) demoted to pos 5, target X is pos 10.
      const juniorRole = {
        id: 'role-junior',
        name: 'Junior',
        color: '#64748b',
        permissions: Permissions.MANAGE_ROLES,
        position: 5,
        isOwner: false,
        isSystem: false,
      };
      mocks.state.rolesStore.push(juniorRole);

      mocks.state.onLockHook = () => {
        mocks.state.userRolesStore = mocks.state.userRolesStore.filter((ur) => ur.userId !== managerUser.id);
        mocks.state.userRolesStore.push({ userId: managerUser.id, roleId: juniorRole.id });
      };

      const result = await updateUserRoles(targetUser.userId, [viewerRole.id]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/role hierarchy changed/i);
    });

    it('aborts when actor manager concurrently loses MANAGE_ROLES permission', async () => {
      mocks.state.onLockHook = () => {
        mocks.state.userRolesStore = mocks.state.userRolesStore.filter((ur) => ur.userId !== managerUser.id);
        mocks.state.userRolesStore.push({ userId: managerUser.id, roleId: viewerRole.id });
      };

      const result = await updateUserRoles(targetUser.userId, [viewerRole.id]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission to manage roles/i);
    });

    it('aborts when target member is concurrently removed from staff', async () => {
      mocks.state.onLockHook = () => {
        mocks.state.staffMembersStore = mocks.state.staffMembersStore.filter((sm) => sm.userId !== targetUser.userId);
      };

      const result = await updateUserRoles(targetUser.userId, [viewerRole.id]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no longer a staff member/i);
    });

    it('succeeds when hierarchy is preserved under lock', async () => {
      const result = await updateUserRoles(targetUser.userId, [viewerRole.id]);

      expect(result.success).toBe(true);
      expect(mocks.state.executedLocks).toContain(STAFF_REVOCATION_LOCK_KEY);
      expect(mocks.mockRevalidatePath).toHaveBeenCalledWith('/admin/team');
    });
  });

  describe('updateRole (edit role)', () => {
    it('aborts when target role is concurrently moved above actor position', async () => {
      const targetRole = {
        id: 'role-custom',
        name: 'Editor',
        color: '#a855f7',
        permissions: BigInt(0),
        position: 30, // below manager (50)
        isOwner: false,
        isSystem: false,
      };
      mocks.state.rolesStore.push(targetRole);

      mocks.state.onLockHook = () => {
        // Concurrently elevated to pos 90 (above manager's 50)
        const r = mocks.state.rolesStore.find((item) => item.id === targetRole.id);
        if (r) r.position = 90;
      };

      const fd = new FormData();
      fd.append('name', 'Editor Renamed');
      fd.append('color', '#a855f7');
      fd.append('permissions', '0');

      const result = await updateRole(targetRole.id, fd);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/role hierarchy/i);
      expect(mocks.state.executedLocks).toContain(STAFF_REVOCATION_LOCK_KEY);
    });

    it('aborts when actor manager is concurrently demoted below the role position', async () => {
      const targetRole = {
        id: 'role-custom',
        name: 'Editor',
        color: '#a855f7',
        permissions: BigInt(0),
        position: 30,
        isOwner: false,
        isSystem: false,
      };
      mocks.state.rolesStore.push(targetRole);

      mocks.state.onLockHook = () => {
        // Demote manager to viewer (pos 10 < 30)
        mocks.state.userRolesStore = mocks.state.userRolesStore.filter((ur) => ur.userId !== managerUser.id);
        mocks.state.userRolesStore.push({ userId: managerUser.id, roleId: viewerRole.id });
      };

      const fd = new FormData();
      fd.append('name', 'Editor Renamed');
      fd.append('color', '#a855f7');
      fd.append('permissions', '0');

      const result = await updateRole(targetRole.id, fd);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('aborts when manager attempts privilege escalation under lock', async () => {
      const targetRole = {
        id: 'role-custom',
        name: 'Editor',
        color: '#a855f7',
        permissions: BigInt(0),
        position: 30,
        isOwner: false,
        isSystem: false,
      };
      mocks.state.rolesStore.push(targetRole);

      const fd = new FormData();
      fd.append('name', 'Editor');
      fd.append('color', '#a855f7');
      // Attempting to grant ADMINISTRATOR (which manager lacks)
      fd.append('permissions', Permissions.ADMINISTRATOR.toString());

      const result = await updateRole(targetRole.id, fd);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions that you do not possess/i);
    });
  });

  describe('revokeInvite (cancel pending invite)', () => {
    it('aborts when actor manager is concurrently demoted below a role on the invite', async () => {
      const inviteRole = {
        id: 'role-invitee',
        name: 'Moderator',
        color: '#06b6d4',
        permissions: BigInt(0),
        position: 40, // initially below manager (50)
        isOwner: false,
        isSystem: false,
      };
      mocks.state.rolesStore.push(inviteRole);

      const inviteId = 'invite-123';
      mocks.state.staffInvitesStore.push({
        id: inviteId,
        email: 'newbie@example.com',
        tokenHash: 'hash123',
        invitedBy: managerUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
      });
      mocks.state.staffInviteRolesStore.push({
        inviteId,
        roleId: inviteRole.id,
      });

      mocks.state.onLockHook = () => {
        // Demote manager to pos 35 (< 40)
        const demotedManager = {
          id: 'role-demoted',
          name: 'Demoted Manager',
          color: '#10b981',
          permissions: Permissions.MANAGE_ROLES,
          position: 35,
          isOwner: false,
          isSystem: false,
        };
        mocks.state.rolesStore.push(demotedManager);
        mocks.state.userRolesStore = mocks.state.userRolesStore.filter((ur) => ur.userId !== managerUser.id);
        mocks.state.userRolesStore.push({ userId: managerUser.id, roleId: demotedManager.id });
      };

      const result = await revokeInvite(inviteId);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/higher than your own highest role/i);
      expect(mocks.state.executedLocks).toContain(STAFF_REVOCATION_LOCK_KEY);
    });

    it('aborts when invite is already accepted or removed concurrently before lock', async () => {
      const inviteId = 'invite-123';
      mocks.state.staffInvitesStore.push({
        id: inviteId,
        email: 'newbie@example.com',
        tokenHash: 'hash123',
        invitedBy: managerUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
      });

      mocks.state.onLockHook = () => {
        // Concurrently accepted
        const inv = mocks.state.staffInvitesStore.find((i) => i.id === inviteId);
        if (inv) inv.acceptedAt = new Date();
      };

      const result = await revokeInvite(inviteId);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found or already accepted/i);
    });
  });

  describe('revokeStaff (revoke staff access)', () => {
    it('aborts when manager is concurrently demoted below target staff member before lock', async () => {
      mocks.state.onLockHook = () => {
        // Target promoted to position 60 (above manager's 50)
        const promotedRole = {
          id: 'role-promoted',
          name: 'Promoted',
          color: '#06b6d4',
          permissions: BigInt(0),
          position: 60,
          isOwner: false,
          isSystem: false,
        };
        mocks.state.rolesStore.push(promotedRole);
        mocks.state.userRolesStore = mocks.state.userRolesStore.filter((ur) => ur.userId !== targetUser.userId);
        mocks.state.userRolesStore.push({ userId: targetUser.userId, roleId: promotedRole.id });
      };

      const result = await revokeStaff(targetUser.userId);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/role hierarchy changed/i);
      expect(mocks.state.executedLocks).toContain(STAFF_REVOCATION_LOCK_KEY);
    });
  });

  describe('Static structural invariant checks', () => {
    const actionsSource = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/team/actions.ts'),
      'utf8',
    );

    it('ensures updateUserRoles acquires pg_advisory_xact_lock and re-reads under lock', () => {
      const fnStart = actionsSource.indexOf('export async function updateUserRoles');
      const fnSource = actionsSource.slice(fnStart);

      const lockIdx = fnSource.indexOf('pg_advisory_xact_lock(${STAFF_REVOCATION_LOCK_KEY})');
      const freshActorIdx = fnSource.indexOf('getFreshActorAccess(admin.id, tx)', lockIdx);
      const targetRolesIdx = fnSource.indexOf('getUserRolesInfo(targetUserId, tx)', freshActorIdx);
      const hierarchyCheckIdx = fnSource.indexOf('STAFF_HIERARCHY_CHANGED', targetRolesIdx);
      const mutateIdx = fnSource.indexOf('.delete(schema.userRoles)', hierarchyCheckIdx);

      expect(lockIdx).toBeGreaterThan(-1);
      expect(freshActorIdx).toBeGreaterThan(lockIdx);
      expect(targetRolesIdx).toBeGreaterThan(freshActorIdx);
      expect(hierarchyCheckIdx).toBeGreaterThan(targetRolesIdx);
      expect(mutateIdx).toBeGreaterThan(hierarchyCheckIdx);
    });

    it('ensures updateRole acquires pg_advisory_xact_lock and re-reads under lock', () => {
      const fnStart = actionsSource.indexOf('export async function updateRole');
      const fnEnd = actionsSource.indexOf('export async function deleteRole', fnStart);
      const fnSource = actionsSource.slice(fnStart, fnEnd);

      const lockIdx = fnSource.indexOf('pg_advisory_xact_lock(${STAFF_REVOCATION_LOCK_KEY})');
      const freshActorIdx = fnSource.indexOf('getFreshActorAccess(admin.id, tx)', lockIdx);
      const reReadRoleIdx = fnSource.indexOf('.from(schema.roles)', freshActorIdx);
      const hierarchyCheckIdx = fnSource.indexOf('canManageRole(freshActor.highestRolePosition', reReadRoleIdx);
      const updateIdx = fnSource.indexOf('.update(schema.roles)', hierarchyCheckIdx);

      expect(lockIdx).toBeGreaterThan(-1);
      expect(freshActorIdx).toBeGreaterThan(lockIdx);
      expect(reReadRoleIdx).toBeGreaterThan(freshActorIdx);
      expect(hierarchyCheckIdx).toBeGreaterThan(reReadRoleIdx);
      expect(updateIdx).toBeGreaterThan(hierarchyCheckIdx);
    });

    it('ensures revokeInvite acquires pg_advisory_xact_lock and re-reads under lock', () => {
      const fnStart = actionsSource.indexOf('export async function revokeInvite');
      const fnEnd = actionsSource.indexOf('export async function revokeStaff', fnStart);
      const fnSource = actionsSource.slice(fnStart, fnEnd);

      const lockIdx = fnSource.indexOf('pg_advisory_xact_lock(${STAFF_REVOCATION_LOCK_KEY})');
      const freshActorIdx = fnSource.indexOf('getFreshActorAccess(admin.id, tx)', lockIdx);
      const inviteRolesIdx = fnSource.indexOf('.from(schema.staffInviteRoles)', freshActorIdx);
      const hierarchyCheckIdx = fnSource.indexOf('canManageRole(freshActor.highestRolePosition', inviteRolesIdx);
      const deleteIdx = fnSource.indexOf('.delete(schema.staffInvites)', hierarchyCheckIdx);

      expect(lockIdx).toBeGreaterThan(-1);
      expect(freshActorIdx).toBeGreaterThan(lockIdx);
      expect(inviteRolesIdx).toBeGreaterThan(freshActorIdx);
      expect(hierarchyCheckIdx).toBeGreaterThan(inviteRolesIdx);
      expect(deleteIdx).toBeGreaterThan(hierarchyCheckIdx);
    });

    it('ensures revokeStaff re-reads actor under lock', () => {
      const fnStart = actionsSource.indexOf('export async function revokeStaff');
      const fnEnd = actionsSource.indexOf('/* --- ROLE MANAGEMENT ACTIONS --- */', fnStart);
      const fnSource = actionsSource.slice(fnStart, fnEnd);

      const lockIdx = fnSource.indexOf('pg_advisory_xact_lock(${STAFF_REVOCATION_LOCK_KEY})');
      const freshActorIdx = fnSource.indexOf('getFreshActorAccess(staff.id, tx)', lockIdx);
      const hierarchyCheckIdx = fnSource.indexOf('canActOnMember(\n        freshActor.highestRolePosition', freshActorIdx);

      expect(lockIdx).toBeGreaterThan(-1);
      expect(freshActorIdx).toBeGreaterThan(lockIdx);
      expect(hierarchyCheckIdx).toBeGreaterThan(freshActorIdx);
    });
  });
});
