import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '@/app/lib/db/schema';
import { Permissions } from '@/app/lib/roles';
import type {
  CandidateOnboardingPort,
  StaffManagerProvisioningPort,
  SchoolManagerContextPort,
} from '../ports';

// --- HOISTED IN-MEMORY STORE & DB MOCKS ---
const mocks = vi.hoisted(() => {
  const mockRequirePermission = vi.fn();
  const mockRevalidatePath = vi.fn();
  const mockUpdateTag = vi.fn();
  const mockUpdateCacheTags = vi.fn();
  const mockCreateUser = vi.fn();

  let currentClaims: { sub?: string; email?: string } | null = null;

  const state = {
    schoolsStore: [] as any[],
    gamesStore: [] as any[],
    teamsStore: [] as any[],
    rostersStore: [] as any[],
    playersStore: [] as any[],
    membersStore: [] as any[],
    schoolManagersStore: [] as any[],
    playerInvitesStore: [] as any[],
    playerIdentitiesStore: [] as any[],
    studentDemographicsStore: [] as any[],
    staffMembersStore: [] as any[],
    staffAuditLogsStore: [] as any[],
    rolesStore: [] as any[],
    userRolesStore: [] as any[],
  };

  function extractConditions(clause: any): Array<{ col: string; op: 'eq' | 'in' | 'isNull'; val?: any }> {
    if (!clause) return [];
    if (clause.queryChunks) {
      const conditions: Array<{ col: string; op: 'eq' | 'in' | 'isNull'; val?: any }> = [];
      const chunks = clause.queryChunks;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk && chunk.queryChunks) {
          conditions.push(...extractConditions(chunk));
        } else if (chunk && typeof chunk === 'object' && 'name' in chunk) {
          const colName = chunk.name;
          for (let j = i + 1; j < chunks.length; j++) {
            const next = chunks[j];
            if (!next) continue;
            const nextStr = typeof next === 'object' && next.value ? String(next.value) : String(next);
            if (nextStr.includes('=') && !nextStr.includes('!=')) {
              const valChunk = chunks[j + 1];
              const val = valChunk?.value !== undefined ? valChunk.value : valChunk;
              conditions.push({ col: colName, op: 'eq', val });
              break;
            } else if (nextStr.includes(' in')) {
              const valChunk = chunks[j + 1];
              let vals: any[] = [];
              if (Array.isArray(valChunk)) {
                vals = valChunk.map((p: any) => (p?.value !== undefined ? p.value : p));
              } else if (valChunk?.queryChunks) {
                vals = valChunk.queryChunks.map((p: any) => (p?.value !== undefined ? p.value : p));
              } else if (valChunk?.value && Array.isArray(valChunk.value)) {
                vals = valChunk.value.map((p: any) => (p?.value !== undefined ? p.value : p));
              }
              conditions.push({ col: colName, op: 'in', val: vals });
              break;
            } else if (nextStr.includes('is null')) {
              conditions.push({ col: colName, op: 'isNull' });
              break;
            }
          }
        }
      }
      return conditions;
    }
    return [];
  }

  function matchesRow(row: any, cond: { col: string; op: string; val?: any }): boolean {
    const camelCol = cond.col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const val = row[cond.col] !== undefined ? row[cond.col] : row[camelCol];

    if (cond.op === 'eq') {
      if (val === undefined || val === null) return cond.val === val;
      return String(val) === String(cond.val);
    }
    if (cond.op === 'in') {
      return Array.isArray(cond.val) && cond.val.map(String).includes(String(val));
    }
    if (cond.op === 'isNull') {
      return val === null || val === undefined;
    }
    return true;
  }

  const mockDb = {
    select: vi.fn((_fields?: any) => {
      let currentTable: any = null;
      const joins: Array<{ table: any; on: any }> = [];
      let whereClause: any = null;

      const builder = {
        from: vi.fn((tbl: any) => {
          currentTable = tbl;
          return builder;
        }),
        leftJoin: vi.fn((tbl: any, on: any) => {
          joins.push({ table: tbl, on });
          return builder;
        }),
        innerJoin: vi.fn((tbl: any, on: any) => {
          joins.push({ table: tbl, on });
          return builder;
        }),
        where: vi.fn((clause: any) => {
          whereClause = clause;
          return builder;
        }),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (resolve: (val: any) => void) => {
          resolve(executeSelect());
        },
      };

      function executeSelect(): any[] {
        const conds = extractConditions(whereClause);

        if (currentTable === schema.schools) {
          return state.schoolsStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.games) {
          return state.gamesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.teams) {
          return state.teamsStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.rosters) {
          return state.rostersStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.players) {
          return state.playersStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.staffMembers) {
          return state.staffMembersStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.roles) {
          return state.rolesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.userRoles) {
          return state.userRolesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.members) {
          return state.membersStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.playerIdentities) {
          return state.playerIdentitiesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }
        if (currentTable === schema.studentDemographics) {
          return state.studentDemographicsStore.filter((r) => conds.every((c) => matchesRow(r, c)));
        }

        if (currentTable === schema.schoolManagers) {
          const rows = state.schoolManagersStore.filter((r) => conds.every((c) => matchesRow(r, c)));
          if (joins.length > 0) {
            return rows.map((m) => {
              const staff = state.staffMembersStore.find((s) => s.userId === m.userId);
              const member = state.membersStore.find((mb) => mb.id === m.memberId);
              const school = state.schoolsStore.find((s) => s.id === m.schoolId);
              return {
                ...m,
                schoolName: school?.name || 'Test School',
                schoolSlug: school?.slug || 'test-school',
                firstName: member?.firstName || null,
                lastName: member?.lastName || null,
                email: member?.email || staff?.email || null,
              };
            });
          }
          return rows;
        }

        if (currentTable === schema.playerInvites) {
          const rows = state.playerInvitesStore.filter((r) => conds.every((c) => matchesRow(r, c)));
          if (joins.length > 0) {
            return rows.map((inv) => {
              const school = state.schoolsStore.find((s) => s.id === inv.schoolId);
              const game = state.gamesStore.find((g) => g.id === inv.gameId);
              return {
                ...inv,
                invite: inv,
                schoolId: school?.id || inv.schoolId,
                schoolName: school?.name || 'School Name',
                schoolSlug: school?.slug || 'school-slug',
                gameId: game?.id || inv.gameId,
                gameName: game?.displayName || (inv.role === 'manager' ? 'School Manager' : 'Game Name'),
                gameSlug: game?.slug || (inv.role === 'manager' ? 'manager' : 'game-slug'),
              };
            });
          }
          return rows;
        }

        return [];
      }

      return builder;
    }),

    insert: vi.fn((tbl: any) => {
      let insertVals: any = null;
      const builder = {
        values: vi.fn((vals: any) => {
          insertVals = vals;
          return builder;
        }),
        returning: vi.fn(async () => executeInsert()),
        then: (resolve: (val: any) => void) => {
          resolve(executeInsert());
        },
      };

      function executeInsert() {
        const id = insertVals.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = { ...insertVals, id, createdAt: new Date(), updatedAt: new Date() };

        if (tbl === schema.playerInvites) {
          state.playerInvitesStore.push(record);
          return [record];
        }
        if (tbl === schema.members) {
          state.membersStore.push(record);
          return [record];
        }
        if (tbl === schema.schoolManagers) {
          state.schoolManagersStore.push(record);
          return [record];
        }
        if (tbl === schema.playerIdentities) {
          state.playerIdentitiesStore.push(record);
          return [record];
        }
        if (tbl === schema.studentDemographics) {
          state.studentDemographicsStore.push(record);
          return [record];
        }
        if (tbl === schema.players) {
          state.playersStore.push(record);
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
      let updateVals: any = null;
      let whereClause: any = null;
      const builder = {
        set: vi.fn((vals: any) => {
          updateVals = vals;
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

        function updateStore(store: any[]) {
          const updated: any[] = [];
          for (let i = 0; i < store.length; i++) {
            if (conds.every((c) => matchesRow(store[i], c))) {
              store[i] = { ...store[i], ...updateVals, updatedAt: new Date() };
              updated.push(store[i]);
            }
          }
          return updated;
        }

        if (tbl === schema.playerInvites) return updateStore(state.playerInvitesStore);
        if (tbl === schema.schoolManagers) return updateStore(state.schoolManagersStore);
        if (tbl === schema.members) return updateStore(state.membersStore);
        return [];
      }

      return builder;
    }),

    transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => {
      return callback(mockDb);
    }),
  };

  return {
    mockRequirePermission,
    mockRevalidatePath,
    mockUpdateTag,
    mockUpdateCacheTags,
    mockCreateUser,
    setCurrentUser: (claims: { sub?: string; email?: string } | null) => {
      currentClaims = claims;
    },
    getClaims: () => ({ data: { claims: currentClaims } }),
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

vi.mock('@/app/lib/cache/tags', () => ({
  CACHE_TAGS: {
    PLAYERS: 'players',
    MEMBERS: 'members',
    SCHOOLS: 'schools',
  },
  updateCacheTags: mocks.mockUpdateCacheTags,
}));

vi.mock('@/app/lib/cache', () => ({
  CACHE_TAGS: {
    ROSTERS: 'rosters',
    PLAYERS: 'players',
    TEAMS: 'teams',
  },
  updateCacheTags: mocks.mockUpdateCacheTags,
}));

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getClaims: vi.fn().mockImplementation(async () => mocks.getClaims()),
    },
  })),
}));

vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mocks.mockCreateUser,
      },
    },
  })),
}));

// Imports of driving application services
import {
  validateInviteToken,
  submitPlayerOnboarding,
} from '@/app/lib/onboarding/wizard-actions';
import {
  generateManagerInvite,
  getRegisteredManagers,
  assignExistingManager,
  getSchoolManagers,
} from '@/app/(admin)/admin/schools/actions';
import {
  createPlayerInvite,
  getPendingSubmissions,
  reviewPlayerInvite,
} from '@/app/lib/onboarding/portal-actions';
import {
  getSchoolManagerContext,
  assertManagerForSchool,
} from '@/app/lib/onboarding/manager-auth';

describe('Hexagonal Architecture & E2E Onboarding Integration Flow', () => {
  const staffSuperAdmin = {
    id: 'super-admin-uuid',
    email: 'shangminch@gmail.com',
    isOwner: true,
  };

  const stuySchool = {
    id: 'school-stuy-uuid',
    name: 'Stuyvesant High School',
    slug: 'stuyvesant-high-school',
    isActive: true,
  };

  const bxsciSchool = {
    id: 'school-bxsci-uuid',
    name: 'Bronx High School of Science',
    slug: 'bronx-science',
    isActive: true,
  };

  const valorantGame = {
    id: 'game-val-uuid',
    slug: 'valorant',
    displayName: 'Valorant',
    shortName: 'VAL',
  };

  const stuyTeam = {
    id: 'team-stuy-val-uuid',
    schoolId: stuySchool.id,
    gameId: valorantGame.id,
    name: 'Stuyvesant Valorant',
  };

  const stuyRoster = {
    id: 'roster-stuy-varsity-uuid',
    teamId: stuyTeam.id,
    name: 'Varsity',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequirePermission.mockResolvedValue(staffSuperAdmin);
    mocks.mockCreateUser.mockResolvedValue({
      data: { user: { id: 'created-manager-auth-uuid' } },
      error: null,
    });
    mocks.setCurrentUser({
      sub: staffSuperAdmin.id,
      email: staffSuperAdmin.email,
    });

    // Reset In-Memory Database Stores
    mocks.state.schoolsStore = [stuySchool, bxsciSchool];
    mocks.state.gamesStore = [valorantGame];
    mocks.state.teamsStore = [stuyTeam];
    mocks.state.rostersStore = [stuyRoster];
    mocks.state.playersStore = [];
    mocks.state.membersStore = [];
    mocks.state.schoolManagersStore = [];
    mocks.state.playerInvitesStore = [];
    mocks.state.playerIdentitiesStore = [];
    mocks.state.studentDemographicsStore = [];
    mocks.state.staffMembersStore = [
      {
        userId: staffSuperAdmin.id,
        email: staffSuperAdmin.email,
        memberId: null,
      },
    ];
    mocks.state.rolesStore = [
      {
        id: 'role-owner',
        name: 'Owner',
        isOwner: true,
        permissions: Permissions.ADMINISTRATOR,
      },
    ];
    mocks.state.userRolesStore = [
      {
        userId: staffSuperAdmin.id,
        roleId: 'role-owner',
      },
    ];
    mocks.state.staffAuditLogsStore = [];
  });

  describe('Hexagonal Architecture: Port Specifications', () => {
    it('adheres to CandidateOnboardingPort contract for candidate wizard operations', () => {
      const candidatePort: CandidateOnboardingPort = {
        validateInviteToken,
        submitPlayerOnboarding,
      };
      expect(typeof candidatePort.validateInviteToken).toBe('function');
      expect(typeof candidatePort.submitPlayerOnboarding).toBe('function');
    });

    it('adheres to SchoolManagerContextPort contract for manager tenancy resolution', () => {
      const contextPort: SchoolManagerContextPort = {
        getSchoolManagerContext,
        assertManagerForSchool,
      };
      expect(typeof contextPort.getSchoolManagerContext).toBe('function');
      expect(typeof contextPort.assertManagerForSchool).toBe('function');
    });

    it('adheres to StaffManagerProvisioningPort contract for staff operations', () => {
      const staffPort: Partial<StaffManagerProvisioningPort> = {
        generateManagerInvite,
        getRegisteredManagers,
        assignExistingManager,
      };
      expect(typeof staffPort.generateManagerInvite).toBe('function');
      expect(typeof staffPort.getRegisteredManagers).toBe('function');
      expect(typeof staffPort.assignExistingManager).toBe('function');
    });
  });

  describe('E2E Flow 1: Super Admin Onboards New School Manager', () => {
    it('provisions invite, validates token, submits verification, creates portal access, and ensures no "already signed up" bug', async () => {
      // Step 1: Super Admin generates manager onboarding link for Stuyvesant
      const genRes = await generateManagerInvite({
        schoolId: stuySchool.id,
        firstName: 'Alex',
        lastName: 'Chen',
        email: 'alex.chen@stuy.edu',
        academicYear: '2025-2026',
        managedGames: null,
        isPrimaryContact: true,
      });

      expect(genRes.success).toBe(true);
      expect(genRes.token).toBeDefined();
      expect(genRes.inviteUrl).toContain('/join/stuyvesant-high-school/manager?token=');

      const token = genRes.token!;

      // Step 2: Manager clicks the link -> validateInviteToken executes
      const valRes = await validateInviteToken({
        schoolSlug: stuySchool.slug,
        gameSlug: 'manager',
        token,
      });

      expect(valRes.valid).toBe(true);
      if (valRes.valid) {
        expect(valRes.intendedFirstName).toBe('Alex');
        expect(valRes.intendedLastName).toBe('Chen');
        expect(valRes.isManager).toBe(true);
        expect(valRes.schoolName).toBe(stuySchool.name);
      }

      // Step 3: Manager completes onboarding wizard with portal password
      const subRes = await submitPlayerOnboarding({
        token,
        submission: {
          legalFirstName: 'Alex',
          legalLastName: 'Chen',
          email: 'alex.chen@stuy.edu',
          password: 'SecretManagerPassword123!',
          graduationYear: 2026,
          riotId: 'DemonAlex#NA1',
          discordUsername: 'DemonAlex#1234',
          inGuild: true,
          birthDate: new Date('1990-05-15'),
          codeOfConductAccepted: true,
        },
      });

      expect(subRes.success).toBe(true);
      expect(subRes.role).toBe('manager');
      expect(subRes.status).toBe('accepted');

      // Step 4: Verify Database State
      // 4a: Manager profile created in central members table
      const createdMember = mocks.state.membersStore.find((m) => m.email === 'alex.chen@stuy.edu');
      expect(createdMember).toBeDefined();
      expect(createdMember?.firstName).toBe('Alex');
      expect(createdMember?.lastName).toBe('Chen');
      expect(createdMember?.schoolId).toBe(stuySchool.id);

      // 4b: Manager assigned in school_managers with member_id FK
      const managerRow = mocks.state.schoolManagersStore.find(
        (sm) => sm.schoolId === stuySchool.id && sm.academicYear === '2025-2026'
      );
      expect(managerRow).toBeDefined();
      expect(managerRow?.memberId).toBe(createdMember?.id);
      expect(managerRow?.isActive).toBe(true);
      expect(managerRow?.isPrimaryContact).toBe(true);

      // 4c: Verify Discord & Riot identities saved
      const discordId = mocks.state.playerIdentitiesStore.find(
        (i) => i.memberId === createdMember?.id && i.provider === 'discord'
      );
      expect(discordId).toBeDefined();
      expect(discordId?.providerUsername).toBe('DemonAlex#1234');

      const riotId = mocks.state.playerIdentitiesStore.find(
        (i) => i.memberId === createdMember?.id && i.provider === 'riot'
      );
      expect(riotId).toBeDefined();
      expect(riotId?.providerUserId).toBe('DemonAlex#NA1');

      // Step 5: Test Refreshing/Revisiting Token URL
      // Must return accepted status and friendly manager messaging!
      const postSubmitVal = await validateInviteToken({
        schoolSlug: stuySchool.slug,
        gameSlug: 'manager',
        token,
      });

      expect(postSubmitVal.valid).toBe(false);
      expect(postSubmitVal.status).toBe('accepted');
      if (postSubmitVal.status === 'accepted') {
        expect(postSubmitVal.role).toBe('manager');
        expect(postSubmitVal.message).toContain('You have successfully signed up!');
      }
    });
  });

  describe('E2E Flow 2: Manager Generates Player Invite & Approves to Official Roster', () => {
    it('manages student onboarding from portal link to active roster placement', async () => {
      // Step 1: Pre-populate active manager for Stuyvesant
      const managerMemberId = 'member-alex-uuid';
      const managerUserId = 'user-alex-auth-uuid';
      mocks.state.membersStore.push({
        id: managerMemberId,
        firstName: 'Alex',
        lastName: 'Chen',
        email: 'alex.chen@stuy.edu',
        schoolId: stuySchool.id,
      });
      mocks.state.schoolManagersStore.push({
        id: 'mgr-row-1',
        schoolId: stuySchool.id,
        userId: managerUserId,
        memberId: managerMemberId,
        managedGames: null,
        academicYear: '2025-2026',
        isPrimaryContact: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Set logged in session to this manager
      mocks.setCurrentUser({
        sub: managerUserId,
        email: 'alex.chen@stuy.edu',
      });

      // Step 2: Manager creates a player invite link for Valorant
      const playerInviteRes = await createPlayerInvite({
        schoolId: stuySchool.id,
        gameId: valorantGame.id,
        intendedFirstName: 'David',
        intendedLastName: 'Kim',
      });

      expect(playerInviteRes.token).toBeDefined();
      expect(playerInviteRes.inviteUrl).toContain('/join/stuyvesant-high-school/valorant?token=');

      const playerToken = playerInviteRes.token!;

      // Step 3: Player validates token
      const valPlayer = await validateInviteToken({
        schoolSlug: stuySchool.slug,
        gameSlug: 'valorant',
        token: playerToken,
      });
      expect(valPlayer.valid).toBe(true);
      if (valPlayer.valid) {
        expect(valPlayer.isManager).toBe(false);
        expect(valPlayer.gameSlug).toBe('valorant');
        expect(valPlayer.intendedFirstName).toBe('David');
      }

      // Step 4: Player submits onboarding
      const submitPlayerRes = await submitPlayerOnboarding({
        token: playerToken,
        submission: {
          legalFirstName: 'David',
          legalLastName: 'Kim',
          email: 'david.kim@nycstudents.net',
          graduationYear: 2026,
          riotId: 'DavidK#NA1',
          discordUsername: 'DavidK#9999',
          inGuild: true,
          birthDate: new Date('2008-03-21'),
          codeOfConductAccepted: true,
        },
      });

      expect(submitPlayerRes.success).toBe(true);
      expect(submitPlayerRes.role).toBe('player');
      expect(submitPlayerRes.status).toBe('submitted');

      // Step 5: Manager checks pending submissions in portal
      const pendingSubmissions = await getPendingSubmissions(stuySchool.id, valorantGame.id);
      expect(pendingSubmissions.length).toBeGreaterThanOrEqual(1);

      const targetSubmission = pendingSubmissions.find((s) => s.id === playerInviteRes.inviteId);
      expect(targetSubmission).toBeDefined();
      expect(targetSubmission?.intendedFirstName).toBe('David');
      expect(targetSubmission?.status).toBe('submitted');

      // Step 6: Manager approves submission and assigns to Varsity Roster
      const approveRes = await reviewPlayerInvite({
        inviteId: playerInviteRes.inviteId!,
        action: 'approve',
        rosterId: stuyRoster.id,
      });

      expect(approveRes.success).toBe(true);

      // Step 7: Verify student is on the official roster in players table
      const studentMember = mocks.state.membersStore.find((m) => m.email === 'david.kim@nycstudents.net');
      expect(studentMember).toBeDefined();

      const rosterPlayer = mocks.state.playersStore.find(
        (p) => p.rosterId === stuyRoster.id && p.memberId === studentMember?.id
      );
      expect(rosterPlayer).toBeDefined();
      expect(rosterPlayer?.role).toBe('player');
    });
  });

  describe('E2E Flow 3: Super Admin Assigns Existing Manager to Another School', () => {
    it('finds existing registered manager in search and assigns them to Bronx Science without re-onboarding', async () => {
      // Step 1: Pre-populate manager registered from earlier onboarding
      const managerMemberId = 'member-alex-uuid';
      const managerUserId = 'user-alex-auth-uuid';
      mocks.state.membersStore.push({
        id: managerMemberId,
        firstName: 'Alex',
        lastName: 'Chen',
        email: 'alex.chen@stuy.edu',
        schoolId: stuySchool.id,
      });
      mocks.state.schoolManagersStore.push({
        id: 'mgr-row-stuy',
        schoolId: stuySchool.id,
        userId: managerUserId,
        memberId: managerMemberId,
        managedGames: null,
        academicYear: '2025-2026',
        isPrimaryContact: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Step 2: Super Admin searches registered managers
      const registered = await getRegisteredManagers('Alex');
      expect(registered).toHaveLength(1);
      expect(registered[0].email).toBe('alex.chen@stuy.edu');
      expect(registered[0].fullName).toBe('Alex Chen');
      expect(registered[0].schools).toContain(stuySchool.name);

      // Step 3: Super Admin assigns Alex Chen to Bronx Science
      const assignRes = await assignExistingManager({
        schoolId: bxsciSchool.id,
        userId: managerUserId,
        memberId: managerMemberId,
        email: 'alex.chen@stuy.edu',
        academicYear: '2025-2026',
        managedGames: ['valorant'],
        isPrimaryContact: true,
      });

      expect(assignRes.success).toBe(true);
      expect(assignRes.manager?.schoolId).toBe(bxsciSchool.id);
      expect(assignRes.manager?.memberId).toBe(managerMemberId);
      expect(assignRes.manager?.managedGames).toEqual(['valorant']);

      // Step 4: Verify active managers for both schools
      const stuyManagers = await getSchoolManagers(stuySchool.id);
      expect(stuyManagers.some((m) => m.memberId === managerMemberId)).toBe(true);

      const bxsciManagers = await getSchoolManagers(bxsciSchool.id);
      expect(bxsciManagers.some((m) => m.memberId === managerMemberId)).toBe(true);

      // Step 5: Verify staff audit log was written
      const auditLog = mocks.state.staffAuditLogsStore.find(
        (log) => log.event === 'assign_existing_manager'
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(staffSuperAdmin.id);
      expect(auditLog?.details).toContain(bxsciSchool.id);
    });
  });
});
