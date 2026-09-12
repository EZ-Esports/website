import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permissions } from '@/app/lib/roles';
import type { StaffIdentity } from '@/app/lib/auth';

const dbMock = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const insertCalls: unknown[] = [];
  const updateCalls: unknown[] = [];
  const deleteCalls: unknown[] = [];

  const db = {
    select: vi.fn(() => {
      const rows = selectQueue.shift() ?? [];
      const builder: any = {
        from: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        where: vi.fn(() => builder),
        orderBy: vi.fn(async () => rows),
        limit: vi.fn(async () => rows),
        then: (onfulfilled: any) => Promise.resolve(rows).then(onfulfilled),
      };
      return builder;
    }),
    insert: vi.fn(() => ({
      values: vi.fn((vals: any) => {
        insertCalls.push(vals);
        return {
          returning: vi.fn(async () => [{ id: 'new-member-id', ...vals }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: any) => {
        updateCalls.push(vals);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: 'updated-member-id', ...vals }]),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (cond: any) => {
        deleteCalls.push(cond);
        return undefined;
      }),
    })),
  };

  return { db, selectQueue, insertCalls, updateCalls, deleteCalls };
});

const authMock = vi.hoisted(() => {
  let currentStaff: StaffIdentity | null = null;
  return {
    getCurrentStaff: () => currentStaff,
    setCurrentStaff: (staff: StaffIdentity | null) => {
      currentStaff = staff;
    },
    requirePermission: vi.fn(async () => {
      if (!currentStaff) {
        throw new Error('Forbidden');
      }
      return currentStaff;
    }),
  };
});

vi.mock('@/app/lib/db', () => ({
  db: dbMock.db,
}));

vi.mock('@/app/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/auth')>();
  return {
    ...actual,
    requirePermission: authMock.requirePermission,
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  getScopedSchoolId,
  createMember,
  updateMember,
  deleteMember,
  listSchoolMembers,
  requireRosterPermission,
} from '@/app/(admin)/admin/roster/actions';

describe('Roster Actions RBAC (Issue #114)', () => {
  const globalAdminOwner: StaffIdentity = {
    id: 'admin-owner',
    email: 'owner@ezesports.gg',
    permissions: BigInt(0),
    isOwner: true,
    highestRolePosition: 100,
    schoolId: null,
  };

  const globalAdminWithPerms: StaffIdentity = {
    id: 'admin-staff',
    email: 'admin@ezesports.gg',
    permissions: Permissions.ADMINISTRATOR | Permissions.MANAGE_ROSTERS,
    isOwner: false,
    highestRolePosition: 80,
    schoolId: null,
  };

  const advisorSchoolA: StaffIdentity = {
    id: 'advisor-a',
    email: 'advisor.a@brooklyntech.edu',
    permissions: Permissions.MANAGE_ROSTERS,
    isOwner: false,
    highestRolePosition: 10,
    schoolId: 'school-a',
  };

  const advisorSchoolB: StaffIdentity = {
    id: 'advisor-b',
    email: 'advisor.b@stuy.edu',
    permissions: Permissions.MANAGE_ROSTERS,
    isOwner: false,
    highestRolePosition: 10,
    schoolId: 'school-b',
  };

  const unassignedStaff: StaffIdentity = {
    id: 'staff-no-school',
    email: 'no.school@ezesports.gg',
    permissions: Permissions.MANAGE_ROSTERS,
    isOwner: false,
    highestRolePosition: 5,
    schoolId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.selectQueue.length = 0;
    dbMock.insertCalls.length = 0;
    dbMock.updateCalls.length = 0;
    dbMock.deleteCalls.length = 0;
  });

  describe('getScopedSchoolId helper', () => {
    it('allows global admin owner to access any requested school', () => {
      const result = getScopedSchoolId(globalAdminOwner, 'school-a');
      expect(result).toEqual({ success: true, schoolId: 'school-a' });

      const resultB = getScopedSchoolId(globalAdminOwner, 'school-b');
      expect(resultB).toEqual({ success: true, schoolId: 'school-b' });

      const unconstrained = getScopedSchoolId(globalAdminOwner);
      expect(unconstrained).toEqual({ success: true, schoolId: null });
    });

    it('allows global admin with ADMINISTRATOR permission to access any requested school', () => {
      const result = getScopedSchoolId(globalAdminWithPerms, 'school-z');
      expect(result).toEqual({ success: true, schoolId: 'school-z' });

      const unconstrained = getScopedSchoolId(globalAdminWithPerms);
      expect(unconstrained).toEqual({ success: true, schoolId: null });
    });

    it('allows school advisor to access their assigned school', () => {
      const result = getScopedSchoolId(advisorSchoolA, 'school-a');
      expect(result).toEqual({ success: true, schoolId: 'school-a' });

      const resultB = getScopedSchoolId(advisorSchoolB, 'school-b');
      expect(resultB).toEqual({ success: true, schoolId: 'school-b' });

      const unconstrained = getScopedSchoolId(advisorSchoolA);
      expect(unconstrained).toEqual({ success: true, schoolId: 'school-a' });
    });

    it('rejects school advisor requesting a different school with unauthorized error', () => {
      const result = getScopedSchoolId(advisorSchoolA, 'school-b');
      expect(result).toEqual({
        success: false,
        error: 'Unauthorized: You are only authorized to manage rosters for your assigned school.',
      });
    });

    it('rejects staff without an assigned school and without admin privileges', () => {
      const result = getScopedSchoolId(unassignedStaff, 'school-a');
      expect(result).toEqual({
        success: false,
        error: 'Unauthorized: You are only authorized to manage rosters for your assigned school.',
      });

      const unconstrained = getScopedSchoolId(unassignedStaff);
      expect(unconstrained).toEqual({
        success: false,
        error: 'Unauthorized: You are only authorized to manage rosters for your assigned school.',
      });
    });
  });

  describe('requireRosterPermission', () => {
    it('returns the authenticated staff identity', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      const staff = await requireRosterPermission();
      expect(staff).toBe(advisorSchoolA);
      expect(staff.schoolId).toBe('school-a');
    });

    it('throws when requirePermission fails', async () => {
      authMock.setCurrentStaff(null);
      await expect(requireRosterPermission()).rejects.toThrow('Forbidden');
    });
  });

  describe('createMember action', () => {
    const buildFormData = (schoolId?: string, firstName = 'John', lastName = 'Doe') => {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (schoolId !== undefined) {
        fd.append('schoolId', schoolId);
      }
      fd.append('email', 'john.doe@example.com');
      return fd;
    };

    it('allows global admin to create members for any school', async () => {
      authMock.setCurrentStaff(globalAdminOwner);
      const fdA = buildFormData('school-a');
      const resA = await createMember(fdA);
      expect(resA.success).toBe(true);
      expect(dbMock.insertCalls[0]).toMatchObject({ schoolId: 'school-a', firstName: 'John' });

      const fdB = buildFormData('school-b');
      const resB = await createMember(fdB);
      expect(resB.success).toBe(true);
      expect(dbMock.insertCalls[1]).toMatchObject({ schoolId: 'school-b', firstName: 'John' });
    });

    it('allows school advisor to create members for their assigned school', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      const fd = buildFormData('school-a');
      const res = await createMember(fd);
      expect(res.success).toBe(true);
      expect(dbMock.insertCalls[0]).toMatchObject({ schoolId: 'school-a', firstName: 'John' });
    });

    it('defaults schoolId to advisor schoolId when schoolId is omitted in form', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      const fd = buildFormData(); // No schoolId provided
      const res = await createMember(fd);
      expect(res.success).toBe(true);
      expect(dbMock.insertCalls[0]).toMatchObject({ schoolId: 'school-a', firstName: 'John' });
    });

    it('rejects school advisor creating a member for another school (cross-school)', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      const fd = buildFormData('school-b'); // Advisor A trying to create for School B
      const res = await createMember(fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized: You are only authorized to manage rosters for your assigned school.');
      expect(dbMock.insertCalls).toHaveLength(0);
    });
  });

  describe('updateMember action', () => {
    const buildFormData = (schoolId?: string, firstName = 'Updated', lastName = 'Name') => {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (schoolId !== undefined) {
        fd.append('schoolId', schoolId);
      }
      return fd;
    };

    it('allows global admin to update member of any school', async () => {
      authMock.setCurrentStaff(globalAdminOwner);
      dbMock.selectQueue.push([{ id: 'm-1', schoolId: 'school-b' }]);

      const fd = buildFormData('school-b');
      const res = await updateMember('m-1', fd);
      expect(res.success).toBe(true);
      expect(dbMock.updateCalls[0]).toMatchObject({ schoolId: 'school-b', firstName: 'Updated' });
    });

    it('allows school advisor to update member of their own school', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      dbMock.selectQueue.push([{ id: 'm-1', schoolId: 'school-a' }]);

      const fd = buildFormData('school-a');
      const res = await updateMember('m-1', fd);
      expect(res.success).toBe(true);
      expect(dbMock.updateCalls[0]).toMatchObject({ schoolId: 'school-a', firstName: 'Updated' });
    });

    it('rejects school advisor updating member of another school (cross-school target)', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      // Member m-2 belongs to school-b
      dbMock.selectQueue.push([{ id: 'm-2', schoolId: 'school-b' }]);

      const fd = buildFormData('school-b');
      const res = await updateMember('m-2', fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized: You are only authorized to manage rosters for your assigned school.');
      expect(dbMock.updateCalls).toHaveLength(0);
    });

    it('rejects school advisor moving their own member to another school (cross-school destination)', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      // Member m-1 belongs to school-a
      dbMock.selectQueue.push([{ id: 'm-1', schoolId: 'school-a' }]);

      // Attempting to change schoolId to school-b
      const fd = buildFormData('school-b');
      const res = await updateMember('m-1', fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized: You are only authorized to manage rosters for your assigned school.');
      expect(dbMock.updateCalls).toHaveLength(0);
    });

    it('returns error when member does not exist', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      dbMock.selectQueue.push([]); // Not found

      const fd = buildFormData('school-a');
      const res = await updateMember('nonexistent', fd);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Member not found.');
    });
  });

  describe('deleteMember action', () => {
    it('allows global admin to delete member of any school', async () => {
      authMock.setCurrentStaff(globalAdminOwner);
      dbMock.selectQueue.push([{ id: 'm-1', schoolId: 'school-b' }]);

      const res = await deleteMember('m-1');
      expect(res.success).toBe(true);
      expect(dbMock.deleteCalls).toHaveLength(1);
    });

    it('allows school advisor to delete member of their assigned school', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      dbMock.selectQueue.push([{ id: 'm-1', schoolId: 'school-a' }]);

      const res = await deleteMember('m-1');
      expect(res.success).toBe(true);
      expect(dbMock.deleteCalls).toHaveLength(1);
    });

    it('rejects school advisor deleting member of another school (cross-school)', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      dbMock.selectQueue.push([{ id: 'm-2', schoolId: 'school-b' }]);

      const res = await deleteMember('m-2');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized: You are only authorized to manage rosters for your assigned school.');
      expect(dbMock.deleteCalls).toHaveLength(0);
    });

    it('returns error when member to delete does not exist', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      dbMock.selectQueue.push([]); // Not found

      const res = await deleteMember('nonexistent');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Member not found.');
    });
  });

  describe('listSchoolMembers action', () => {
    it('allows global admin to list members of any school', async () => {
      authMock.setCurrentStaff(globalAdminOwner);
      dbMock.selectQueue.push([{ id: 'm-1', firstName: 'Alice', lastName: 'A', schoolId: 'school-b' }]);

      const members = await listSchoolMembers('school-b');
      expect(members).toHaveLength(1);
      expect(members[0].schoolId).toBe('school-b');
    });

    it('allows school advisor to list members of their assigned school', async () => {
      authMock.setCurrentStaff(advisorSchoolA);
      dbMock.selectQueue.push([{ id: 'm-1', firstName: 'Alice', lastName: 'A', schoolId: 'school-a' }]);

      const members = await listSchoolMembers('school-a');
      expect(members).toHaveLength(1);
      expect(members[0].schoolId).toBe('school-a');
    });

    it('rejects school advisor listing members of another school (cross-school)', async () => {
      authMock.setCurrentStaff(advisorSchoolA);

      await expect(listSchoolMembers('school-b')).rejects.toThrow(
        'Unauthorized: You are only authorized to manage rosters for your assigned school.',
      );
    });
  });

  describe('auth claims extraction for schoolId', () => {
    const extractSchoolId = (claims: Record<string, unknown>) => {
      const userMetadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
      return (
        (userMetadata.school_id as string | undefined) ??
        (userMetadata.schoolId as string | undefined) ??
        (claims.school_id as string | undefined) ??
        null
      );
    };

    it('extracts snake_case school_id from user_metadata', () => {
      expect(extractSchoolId({ user_metadata: { school_id: 'school-123' } })).toBe('school-123');
    });

    it('extracts camelCase schoolId from user_metadata', () => {
      expect(extractSchoolId({ user_metadata: { schoolId: 'school-camel' } })).toBe('school-camel');
    });

    it('extracts top-level school_id from claims', () => {
      expect(extractSchoolId({ school_id: 'school-top' })).toBe('school-top');
    });

    it('prefers user_metadata.school_id over top-level school_id', () => {
      expect(
        extractSchoolId({
          school_id: 'school-top',
          user_metadata: { school_id: 'school-meta' },
        }),
      ).toBe('school-meta');
    });

    it('returns null when no school ID is present in metadata or claims', () => {
      expect(extractSchoolId({ user_metadata: {} })).toBeNull();
      expect(extractSchoolId({})).toBeNull();
    });
  });
});
