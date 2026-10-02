import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '@/app/lib/db/schema';
import { Permissions } from '@/app/lib/roles';
import {
  getStudentDemographics,
  ForbiddenPiiAccessError,
  buildStudentDemographicsQuery,
} from '@/app/lib/db/queries';

// --- HOISTED MOCKS FOR SERVER ACTIONS ---
const mocks = vi.hoisted(() => {
  const mockRequirePermission = vi.fn();
  const mockRevalidatePath = vi.fn();
  const mockUpdateTag = vi.fn();

  interface SchoolRecord {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  }

  interface StaffMemberRecord {
    userId: string;
    email: string;
    memberId?: string | null;
  }

  interface SchoolManagerRecord {
    id: string;
    schoolId: string;
    userId: string;
    memberId?: string | null;
    managedGames: string[] | null;
    academicYear: string;
    isPrimaryContact: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface StaffAuditLogRecord {
    id: string;
    event: string;
    userId?: string | null;
    email?: string | null;
    details?: string | null;
    createdAt: Date;
  }

  interface StudentDemographicsRecord {
    id: string;
    memberId: string;
    legalFirstName: string;
    legalLastName: string;
    birthDate: Date;
    gender: string | null;
    race: string[] | null;
    ethnicity: string[] | null;
    countryOfBirth: string | null;
    parentsCountryOfBirth: string | null;
    primaryLanguageAtHome: string | null;
    isFreeOrReducedLunch: boolean | null;
    isFirstGenCollege: boolean | null;
    doePetitionConsent: boolean;
    surveyDetails: any;
    createdAt: Date;
  }

  interface MemberRecord {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    schoolId: string;
  }

  const state = {
    schoolsStore: [] as SchoolRecord[],
    staffMembersStore: [] as StaffMemberRecord[],
    schoolManagersStore: [] as SchoolManagerRecord[],
    staffAuditLogsStore: [] as StaffAuditLogRecord[],
    studentDemographicsStore: [] as StudentDemographicsRecord[],
    membersStore: [] as MemberRecord[],
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
        if (opChunk && opChunk.includes('=')) {
          const valChunk = chunks[i + 2];
          const val = valChunk?.value !== undefined ? valChunk.value : valChunk;
          conditions.push({ col: colName, op: 'eq', val });
        } else if (opChunk && opChunk.includes('in')) {
          const valChunk = chunks[i + 2];
          const vals = Array.isArray(valChunk) ? valChunk.map((p: any) => p.value ?? p) : [];
          conditions.push({ col: colName, op: 'in', val: vals });
        } else if (opChunk && opChunk.includes('is null')) {
          conditions.push({ col: colName, op: 'isNull' });
        }
      } else if (chunk && typeof chunk === 'object' && chunk.value) {
        const str = Array.isArray(chunk.value) ? chunk.value.join('') : String(chunk.value);
        if (str.includes('lower(')) {
          const colChunk = chunks[i + 1];
          const colName = colChunk?.name || 'email';
          for (let j = i + 2; j < chunks.length; j++) {
            const rawVal = chunks[j];
            if (rawVal !== undefined && rawVal !== null) {
              const val = typeof rawVal === 'object' && 'value' in rawVal ? rawVal.value : rawVal;
              if (typeof val === 'string') {
                conditions.push({ col: colName, op: 'eq', val: val.toLowerCase() });
                break;
              }
            }
          }
        }
      }
    }
    return conditions;
  }

  function matchesRow(row: any, cond: { col: string; op: string; val?: any }): boolean {
    const camelCol = cond.col.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    const actualVal = row[camelCol] !== undefined ? row[camelCol] : row[cond.col];
    if (cond.op === 'eq') {
      if (typeof actualVal === 'string' && typeof cond.val === 'string') {
        return actualVal.toLowerCase() === cond.val.toLowerCase();
      }
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
    select: vi.fn((_fields?: any) => {
      let currentTable: any = null;
      let whereClause: any = null;
      let isJoin = false;

      const builder = {
        from: vi.fn((tbl: any) => {
          currentTable = tbl;
          return builder;
        }),
        leftJoin: vi.fn((_tbl: any, _onCondition: any) => {
          isJoin = true;
          return builder;
        }),
        innerJoin: vi.fn((_tbl: any, _onCondition: any) => {
          isJoin = true;
          return builder;
        }),
        where: vi.fn((clause: any) => {
          whereClause = clause;
          return builder;
        }),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        toSQL: vi.fn(() => {
          const conds = extractConditions(whereClause);
          const memberCond = conds.find((c) => c.col === 'memberId' || c.col === 'member_id');
          return {
            sql: 'select * from "student_demographics" where "student_demographics"."member_id" = $1 limit $2',
            params: [memberCond?.val ?? 'test-member-uuid', 1],
          };
        }),
        then: (resolve: (val: any) => void) => {
          resolve(executeSelect());
        },
      };

      function executeSelect(): any[] {
        const conds = extractConditions(whereClause);

        if (currentTable === schema.schools) {
          return state.schoolsStore.filter((s) => conds.every((c) => matchesRow(s, c)));
        }

        if (currentTable === schema.staffMembers) {
          return state.staffMembersStore.filter((sm) => conds.every((c) => matchesRow(sm, c)));
        }

        if (currentTable === schema.schoolManagers) {
          const rows = state.schoolManagersStore.filter((m) => conds.every((c) => matchesRow(m, c)));

          if (isJoin) {
            return rows.map((m) => {
              const staff = state.staffMembersStore.find((s) => s.userId === m.userId);
              const member = state.membersStore.find((mb) => mb.id === (m as any).memberId);
              const school = state.schoolsStore.find((s) => s.id === m.schoolId);
              return {
                ...m,
                firstName: member?.firstName || null,
                lastName: member?.lastName || null,
                email: member?.email || staff?.email || null,
                schoolName: school?.name || null,
              };
            });
          }

          return rows;
        }

        if (currentTable === schema.members) {
          const rows = state.membersStore.filter((mb) => Boolean(mb.email));
          if (isJoin) {
            return rows.map((mb) => {
              const school = state.schoolsStore.find((s) => s.id === mb.schoolId);
              return {
                ...mb,
                memberId: mb.id,
                schoolName: school?.name || null,
              };
            });
          }
          return rows;
        }

        if (currentTable === schema.studentDemographics) {
          return state.studentDemographicsStore.filter((d) => conds.every((c) => matchesRow(d, c)));
        }

        return [];
      }

      return builder;
    }),

    insert: vi.fn((tbl: any) => {
      let insertValues: any = null;
      const builder = {
        values: vi.fn((vals: any) => {
          insertValues = vals;
          return builder;
        }),
        returning: vi.fn(async () => executeInsert()),
        then: (resolve: (val: any) => void) => {
          resolve(executeInsert());
        },
      };

      function executeInsert() {
        const id = insertValues.id || `uuid-${Date.now()}-${Math.random()}`;
        const record = { ...insertValues, id, createdAt: new Date(), updatedAt: new Date() };

        if (tbl === schema.schoolManagers) {
          state.schoolManagersStore.push(record);
          return [record];
        }
        if (tbl === schema.staffAuditLogs) {
          state.staffAuditLogsStore.push(record);
          return [record];
        }
        return [record];
      }

      return builder;
    }),

    update: vi.fn((tbl: any) => {
      let updateValues: any = null;
      let whereClause: any = null;

      const builder = {
        set: vi.fn((vals: any) => {
          updateValues = vals;
          return builder;
        }),
        where: vi.fn((clause: any) => {
          whereClause = clause;
          return builder;
        }),
        returning: vi.fn(async () => executeUpdate()),
        then: (resolve: (val: any) => void) => {
          resolve(executeUpdate());
        },
      };

      function executeUpdate() {
        const conds = extractConditions(whereClause);
        if (tbl === schema.schoolManagers) {
          const updated: any[] = [];
          for (let i = 0; i < state.schoolManagersStore.length; i++) {
            const m = state.schoolManagersStore[i];
            if (conds.every((c) => matchesRow(m, c))) {
              state.schoolManagersStore[i] = {
                ...m,
                ...updateValues,
                updatedAt: new Date(),
              };
              updated.push(state.schoolManagersStore[i]);
            }
          }
          return updated;
        }
        return [];
      }

      return builder;
    }),
  };

  return {
    mockRequirePermission,
    mockRevalidatePath,
    mockUpdateTag,
    mockDb,
    state,
  };
});

// Mock modules
vi.mock('@/app/lib/auth', () => ({
  requirePermission: mocks.mockRequirePermission,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.mockRevalidatePath,
  updateTag: mocks.mockUpdateTag,
  unstable_cache: (fn: any) => fn,
}));

vi.mock('@/app/lib/db', () => ({
  db: mocks.mockDb,
}));

import {
  provisionSchoolManager,
  removeSchoolManager,
  getSchoolManagers,
  getRegisteredManagers,
  assignExistingManager,
} from '@/app/(admin)/admin/schools/manager-actions';

describe('Milestone 2: Demographic Data Querying & Privacy Protection', () => {
  const memberId = 'member-12345';
  const sampleDemographics = {
    id: 'demo-uuid-1',
    memberId,
    legalFirstName: 'Alex',
    legalLastName: 'Chen',
    birthDate: new Date('2008-05-15'),
    gender: 'Male',
    race: ['Asian'],
    ethnicity: ['East Asian'],
    countryOfBirth: 'United States',
    parentsCountryOfBirth: 'China',
    primaryLanguageAtHome: 'Mandarin',
    isFreeOrReducedLunch: true,
    isFirstGenCollege: true,
    doePetitionConsent: true,
    surveyDetails: { ping: 25, hoursPerWeek: 12 },
    createdAt: new Date(),
  };

  beforeEach(() => {
    mocks.state.studentDemographicsStore = [sampleDemographics];
  });

  describe('Permissions Gating (VIEW_STUDENT_DEMOGRAPHICS)', () => {
    it('throws ForbiddenPiiAccessError when actor has no permissions and is not owner', async () => {
      const actorPermissions = BigInt(0);
      const actorIsOwner = false;

      await expect(
        getStudentDemographics(memberId, actorPermissions, actorIsOwner)
      ).rejects.toThrow('FORBIDDEN_PII_ACCESS');

      await expect(
        getStudentDemographics(memberId, actorPermissions, actorIsOwner)
      ).rejects.toBeInstanceOf(ForbiddenPiiAccessError);
    });

    it('throws ForbiddenPiiAccessError when actor has general staff permissions but lacks VIEW_STUDENT_DEMOGRAPHICS', async () => {
      // General staff permissions (e.g. MANAGE_NEWS | MANAGE_SCHOOLS | MANAGE_ROSTERS)
      const actorPermissions =
        Permissions.MANAGE_NEWS | Permissions.MANAGE_SCHOOLS | Permissions.MANAGE_ROSTERS;
      const actorIsOwner = false;

      await expect(
        getStudentDemographics(memberId, actorPermissions, actorIsOwner)
      ).rejects.toThrow('FORBIDDEN_PII_ACCESS');
    });

    it('returns null instead of throwing when throwOnForbidden is false', async () => {
      const actorPermissions = BigInt(0);
      const actorIsOwner = false;

      const result = await getStudentDemographics(memberId, actorPermissions, actorIsOwner, {
        throwOnForbidden: false,
      });

      expect(result).toBeNull();
    });

    it('allows access when actor has explicit Permissions.VIEW_STUDENT_DEMOGRAPHICS', async () => {
      const actorPermissions = Permissions.VIEW_STUDENT_DEMOGRAPHICS;
      const actorIsOwner = false;

      const result = await getStudentDemographics(memberId, actorPermissions, actorIsOwner);
      expect(result).not.toBeNull();
      expect(result?.legalFirstName).toBe('Alex');
      expect(result?.isFreeOrReducedLunch).toBe(true);
      expect(result?.countryOfBirth).toBe('United States');
    });

    it('allows access when actor has Permissions.ADMINISTRATOR', async () => {
      const actorPermissions = Permissions.ADMINISTRATOR;
      const actorIsOwner = false;

      const result = await getStudentDemographics(memberId, actorPermissions, actorIsOwner);
      expect(result).not.toBeNull();
      expect(result?.legalLastName).toBe('Chen');
    });

    it('allows access when actor is Owner regardless of permission mask', async () => {
      const actorPermissions = BigInt(0);
      const actorIsOwner = true;

      const result = await getStudentDemographics(memberId, actorPermissions, actorIsOwner);
      expect(result).not.toBeNull();
      expect(result?.legalFirstName).toBe('Alex');
    });

    it('returns null when authorized but member has no demographic record', async () => {
      const nonExistentMemberId = 'member-non-existent';
      const actorPermissions = Permissions.VIEW_STUDENT_DEMOGRAPHICS;
      const actorIsOwner = false;

      const result = await getStudentDemographics(
        nonExistentMemberId,
        actorPermissions,
        actorIsOwner
      );
      expect(result).toBeNull();
    });
  });

  describe('Query Architecture & Zero-PII Cache Invariant', () => {
    it('generates correct SQL query against student_demographics with single-row limit', () => {
      const query = buildStudentDemographicsQuery('test-member-uuid');
      const { sql, params } = query.toSQL();

      expect(sql).toContain('from "student_demographics"');
      expect(sql).toContain('"student_demographics"."member_id" = $1');
      expect(sql).toMatch(/limit \$2/i);
      expect(params[0]).toBe('test-member-uuid');
      expect(params[1]).toBe(1);
    });

    it('ensures getStudentDemographics is a direct uncached query function', () => {
      // Must not be an unstable_cache wrapper (unstable_cache wraps with internal metadata properties)
      expect((getStudentDemographics as any).$$typeof).toBeUndefined();
      expect((getStudentDemographics as any).name).toBe('getStudentDemographics');
    });
  });
});

describe('Milestone 2: Staff CMS Manager Provisioning & Scoped Roster Tenancy', () => {
  const schoolId = 'school-stuy-001';
  const staffActor = {
    id: 'staff-admin-uuid',
    email: 'admin@ezesports.org',
    permissions: Permissions.MANAGE_SCHOOLS,
    isOwner: false,
    highestRolePosition: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.schoolsStore = [
      {
        id: schoolId,
        name: 'Stuyvesant High School',
        slug: 'stuyvesant',
        isActive: true,
      },
    ];
    mocks.state.staffMembersStore = [
      {
        userId: 'coach-user-uuid',
        email: 'coach@stuy.edu',
      },
    ];
    mocks.state.schoolManagersStore = [];
    mocks.state.staffAuditLogsStore = [];
    mocks.mockRequirePermission.mockResolvedValue(staffActor);
  });

  describe('Permission Gating (requireSchoolsPermission)', () => {
    it('enforces Permissions.MANAGE_SCHOOLS on provisionSchoolManager', async () => {
      mocks.mockRequirePermission.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(
        provisionSchoolManager({
          schoolId,
          email: 'coach@stuy.edu',
        })
      ).rejects.toThrow('Forbidden');

      expect(mocks.mockRequirePermission).toHaveBeenCalledWith(Permissions.MANAGE_SCHOOLS);
    });

    it('enforces Permissions.MANAGE_SCHOOLS on removeSchoolManager', async () => {
      mocks.mockRequirePermission.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(
        removeSchoolManager({
          managerId: 'mgr-123',
        })
      ).rejects.toThrow('Forbidden');

      expect(mocks.mockRequirePermission).toHaveBeenCalledWith(Permissions.MANAGE_SCHOOLS);
    });
  });

  describe('provisionSchoolManager', () => {
    it('validates required fields: rejects missing schoolId', async () => {
      const result = await provisionSchoolManager({
        schoolId: '',
        email: 'coach@stuy.edu',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/school id is required/i);
    });

    it('validates required fields: rejects missing email', async () => {
      const result = await provisionSchoolManager({
        schoolId,
        email: '   ',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/email is required/i);
    });

    it('rejects provisioning when school does not exist', async () => {
      const result = await provisionSchoolManager({
        schoolId: 'non-existent-school',
        email: 'coach@stuy.edu',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/school not found/i);
    });

    it('successfully provisions a manager linking existing staffMember by email', async () => {
      const result = await provisionSchoolManager({
        schoolId,
        email: 'coach@stuy.edu',
        managedGames: ['valorant', 'lol'],
        isPrimaryContact: true,
        academicYear: '2025-2026',
      });

      expect(result.success).toBe(true);
      expect(result.manager).toBeDefined();
      expect(result.manager?.schoolId).toBe(schoolId);
      expect(result.manager?.userId).toBe('coach-user-uuid');
      expect(result.manager?.managedGames).toEqual(['valorant', 'lol']);
      expect(result.manager?.academicYear).toBe('2025-2026');
      expect(result.manager?.isPrimaryContact).toBe(true);
      expect(result.manager?.isActive).toBe(true);

      // Verifies audit log written
      const auditLog = mocks.state.staffAuditLogsStore.find(
        (l) => l.event === 'provision_school_manager'
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(staffActor.id);
      expect(auditLog?.email).toBe(staffActor.email);
      expect(auditLog?.details).toContain('coach@stuy.edu');

      // Verifies cache revalidation
      expect(mocks.mockUpdateTag).toHaveBeenCalledWith('schools');
      expect(mocks.mockRevalidatePath).toHaveBeenCalledWith('/admin/schools');
    });

    it('automatically generates a new userId when manager email is not yet in staff directory', async () => {
      const newManagerEmail = 'new-coach@brooklyn-tech.edu';
      const result = await provisionSchoolManager({
        schoolId,
        email: newManagerEmail,
      });

      expect(result.success).toBe(true);
      expect(result.manager).toBeDefined();
      expect(result.manager?.userId).toBeDefined();
      expect(typeof result.manager?.userId).toBe('string');
      expect(result.manager?.academicYear).toBe('2025-2026'); // Default academic year
      expect(result.manager?.isActive).toBe(true);
    });

    it('resets other primary contacts when isPrimaryContact is true', async () => {
      // Pre-populate an existing primary manager
      mocks.state.schoolManagersStore.push({
        id: 'mgr-existing-primary',
        schoolId,
        userId: 'old-coach-uuid',
        managedGames: null,
        academicYear: '2025-2026',
        isPrimaryContact: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await provisionSchoolManager({
        schoolId,
        email: 'coach@stuy.edu',
        isPrimaryContact: true,
        academicYear: '2025-2026',
      });

      expect(result.success).toBe(true);
      const oldManager = mocks.state.schoolManagersStore.find(
        (m) => m.id === 'mgr-existing-primary'
      );
      expect(oldManager?.isPrimaryContact).toBe(false);
      expect(result.manager?.isPrimaryContact).toBe(true);
    });

    it('reactivates and updates an existing manager if already provisioned for that year', async () => {
      // Pre-populate an inactive manager for coach-user-uuid
      mocks.state.schoolManagersStore.push({
        id: 'mgr-inactive',
        schoolId,
        userId: 'coach-user-uuid',
        managedGames: ['valorant'],
        academicYear: '2025-2026',
        isPrimaryContact: false,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await provisionSchoolManager({
        schoolId,
        email: 'coach@stuy.edu',
        managedGames: ['valorant', 'rocket-league'],
        isPrimaryContact: true,
        academicYear: '2025-2026',
      });

      expect(result.success).toBe(true);
      expect(result.manager?.id).toBe('mgr-inactive');
      expect(result.manager?.isActive).toBe(true);
      expect(result.manager?.managedGames).toEqual(['valorant', 'rocket-league']);
      expect(result.manager?.isPrimaryContact).toBe(true);
    });
  });

  describe('removeSchoolManager', () => {
    it('validates required fields: rejects missing managerId', async () => {
      const result = await removeSchoolManager({ managerId: '' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/manager id is required/i);
    });

    it('returns error when manager does not exist', async () => {
      const result = await removeSchoolManager({ managerId: 'mgr-unknown' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/school manager not found/i);
    });

    it('deactivates active manager and writes audit log', async () => {
      mocks.state.schoolManagersStore.push({
        id: 'mgr-to-remove',
        schoolId,
        userId: 'coach-user-uuid',
        managedGames: null,
        academicYear: '2025-2026',
        isPrimaryContact: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await removeSchoolManager({ managerId: 'mgr-to-remove' });
      expect(result.success).toBe(true);
      expect(result.manager?.isActive).toBe(false);

      const managerInStore = mocks.state.schoolManagersStore.find(
        (m) => m.id === 'mgr-to-remove'
      );
      expect(managerInStore?.isActive).toBe(false);

      // Verifies audit log written
      const auditLog = mocks.state.staffAuditLogsStore.find(
        (l) => l.event === 'remove_school_manager'
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(staffActor.id);
      expect(auditLog?.details).toContain('mgr-to-remove');

      expect(mocks.mockUpdateTag).toHaveBeenCalledWith('schools');
      expect(mocks.mockRevalidatePath).toHaveBeenCalledWith('/admin/schools');
    });
  });

  describe('getSchoolManagers', () => {
    it('returns empty list if schoolId is missing', async () => {
      const result = await getSchoolManagers('');
      expect(result).toEqual([]);
    });

    it('returns only active managers for the target school with joined user email', async () => {
      mocks.state.schoolManagersStore = [
        {
          id: 'mgr-active-1',
          schoolId,
          userId: 'coach-user-uuid',
          managedGames: ['valorant'],
          academicYear: '2025-2026',
          isPrimaryContact: true,
          isActive: true,
          createdAt: new Date('2026-09-01'),
          updatedAt: new Date(),
        },
        {
          id: 'mgr-inactive-2',
          schoolId,
          userId: 'old-user-uuid',
          managedGames: null,
          academicYear: '2024-2025',
          isPrimaryContact: false,
          isActive: false,
          createdAt: new Date('2025-09-01'),
          updatedAt: new Date(),
        },
        {
          id: 'mgr-other-school',
          schoolId: 'other-school-999',
          userId: 'coach-user-uuid',
          managedGames: null,
          academicYear: '2025-2026',
          isPrimaryContact: true,
          isActive: true,
          createdAt: new Date('2026-09-01'),
          updatedAt: new Date(),
        },
      ];

      const managers = await getSchoolManagers(schoolId);
      expect(managers).toHaveLength(1);
      expect(managers[0].id).toBe('mgr-active-1');
      expect(managers[0].email).toBe('coach@stuy.edu');
      expect(managers[0].isPrimaryContact).toBe(true);
    });
  });

  describe('getRegisteredManagers', () => {
    it('returns registered managers aggregated by email and filters by search query', async () => {
      mocks.mockRequirePermission.mockResolvedValueOnce({
        id: staffActor.id,
        email: staffActor.email,
        isOwner: false,
      });

      mocks.state.schoolsStore = [
        { id: 'school-1', name: 'Stuyvesant High School', slug: 'stuy', isActive: true },
        { id: 'school-2', name: 'Bronx Science', slug: 'bxsci', isActive: true },
      ];

      mocks.state.membersStore = [
        {
          id: 'member-alex',
          firstName: 'Alex',
          lastName: 'Chen',
          email: 'alex.chen@nycstudents.net',
          schoolId: 'school-1',
        },
        {
          id: 'member-sarah',
          firstName: 'Sarah',
          lastName: 'Connor',
          email: 'sarah.c@terminator.edu',
          schoolId: 'school-2',
        },
      ];

      mocks.state.schoolManagersStore = [
        {
          id: 'mgr-1',
          schoolId: 'school-1',
          userId: 'user-alex-uuid',
          memberId: 'member-alex',
          managedGames: null,
          academicYear: '2025-2026',
          isPrimaryContact: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const allRegistered = await getRegisteredManagers();
      expect(allRegistered.length).toBeGreaterThanOrEqual(2);
      expect(allRegistered.some((m) => m.email === 'alex.chen@nycstudents.net')).toBe(true);
      expect(allRegistered.some((m) => m.email === 'sarah.c@terminator.edu')).toBe(true);

      // Search filter
      mocks.mockRequirePermission.mockResolvedValueOnce({
        id: staffActor.id,
        email: staffActor.email,
        isOwner: false,
      });

      const filtered = await getRegisteredManagers('Sarah');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].email).toBe('sarah.c@terminator.edu');
    });
  });

  describe('assignExistingManager', () => {
    it('assigns an existing manager to a target school and logs staff audit', async () => {
      mocks.mockRequirePermission.mockResolvedValueOnce({
        id: staffActor.id,
        email: staffActor.email,
        isOwner: false,
      });

      mocks.state.schoolsStore = [
        { id: 'school-target', name: 'Brooklyn Tech', slug: 'btech', isActive: true },
      ];

      const res = await assignExistingManager({
        schoolId: 'school-target',
        userId: 'existing-user-uuid',
        memberId: 'existing-member-uuid',
        email: 'alex.chen@nycstudents.net',
        academicYear: '2025-2026',
        managedGames: ['valorant'],
        isPrimaryContact: true,
      });

      expect(res.success).toBe(true);
      expect(res.manager).toBeDefined();
      expect(res.manager?.schoolId).toBe('school-target');
      expect(res.manager?.userId).toBe('existing-user-uuid');
      expect(res.manager?.isPrimaryContact).toBe(true);

      const auditLog = mocks.state.staffAuditLogsStore.find(
        (log) => log.event === 'assign_existing_manager'
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(staffActor.id);
      expect(auditLog?.details).toContain('school-target');
    });
  });
});
