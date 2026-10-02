import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import * as schema from '@/app/lib/db/schema';
import { Permissions } from '@/app/lib/roles';

// --- HOISTED MOCKS ---
const mocks = vi.hoisted(() => {
  const mockUpdateCacheTags = vi.fn();

  interface ClaimsUser {
    sub?: string;
    email?: string;
  }

  let currentClaims: ClaimsUser | null = {
    sub: 'manager-user-1',
    email: 'coach@stuy.edu',
  };

  const state = {
    schoolsStore: [] as any[],
    gamesStore: [] as any[],
    rolesStore: [] as any[],
    userRolesStore: [] as any[],
    schoolManagersStore: [] as any[],
    playerInvitesStore: [] as any[],
    teamsStore: [] as any[],
    rostersStore: [] as any[],
    playersStore: [] as any[],
    membersStore: [] as any[],
    playerIdentitiesStore: [] as any[],
    studentDemographicsStore: [] as any[],
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

  function getStore(tbl: any): any[] | null {
    if (tbl === schema.schools) return state.schoolsStore;
    if (tbl === schema.games) return state.gamesStore;
    if (tbl === schema.roles) return state.rolesStore;
    if (tbl === schema.userRoles) return state.userRolesStore;
    if (tbl === schema.schoolManagers) return state.schoolManagersStore;
    if (tbl === schema.playerInvites) return state.playerInvitesStore;
    if (tbl === schema.teams) return state.teamsStore;
    if (tbl === schema.rosters) return state.rostersStore;
    if (tbl === schema.players) return state.playersStore;
    if (tbl === schema.members) return state.membersStore;
    if (tbl === schema.playerIdentities) return state.playerIdentitiesStore;
    if (tbl === schema.studentDemographics) return state.studentDemographicsStore;
    return null;
  }

  const mockDb: any = {
    select: vi.fn((_fields?: any) => {
      let currentTable: any = null;
      const joins: Array<{ table: any; on: any }> = [];
      let whereClause: any = null;

      const builder = {
        from: vi.fn((tbl: any) => {
          currentTable = tbl;
          return builder;
        }),
        innerJoin: vi.fn((tbl: any, on: any) => {
          joins.push({ table: tbl, on });
          return builder;
        }),
        leftJoin: vi.fn((tbl: any, on: any) => {
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
        const store = getStore(currentTable);
        if (!store) return [];

        const conds = extractConditions(whereClause);

        // 1. Roles query (@everyone or userRoles join)
        if (currentTable === schema.roles) {
          return store.filter((r) => conds.every((c) => matchesRow(r, c)));
        }

        if (currentTable === schema.userRoles) {
          const userRolesRows = store.filter((ur) => conds.every((c) => matchesRow(ur, c)));
          return userRolesRows.map((ur) => {
            const role = state.rolesStore.find((r) => r.id === ur.roleId) || {
              permissions: BigInt(0),
              position: 0,
              isOwner: false,
            };
            return {
              permissions: role.permissions,
              position: role.position,
              isOwner: role.isOwner,
            };
          });
        }

        // 2. School Managers join Schools
        if (currentTable === schema.schoolManagers) {
          const rows = store.filter((m) => conds.every((c) => matchesRow(m, c)));
          return rows.map((m) => {
            const school = state.schoolsStore.find((s) => s.id === m.schoolId);
            return {
              schoolId: m.schoolId,
              schoolName: school?.name ?? 'Unknown School',
              schoolSlug: school?.slug ?? 'unknown',
              managedGames: m.managedGames,
              isPrimaryContact: m.isPrimaryContact,
            };
          });
        }

        // 3. Rosters join Teams
        if (currentTable === schema.rosters) {
          if (joins.length > 0 && joins[0].table === schema.teams) {
            const matchingRosters = store.filter((r) => conds.every((c) => matchesRow(r, c)));
            return matchingRosters.map((r) => {
              const team = state.teamsStore.find((t) => t.id === r.teamId);
              return {
                roster: r,
                team,
              };
            });
          }
          return store.filter((r) => conds.every((c) => matchesRow(r, c)));
        }

        // 4. Players join Members, Rosters, Teams, Games
        if (currentTable === schema.players) {
          const matchingPlayers = store.filter((p) => conds.every((c) => matchesRow(p, c)));
          if (joins.length > 0) {
            return matchingPlayers.map((p) => {
              const member = state.membersStore.find((m) => m.id === p.memberId);
              const roster = state.rostersStore.find((r) => r.id === p.rosterId);
              const team = state.teamsStore.find((t) => t.id === roster?.teamId);
              const game = state.gamesStore.find((g) => g.id === team?.gameId);
              return {
                id: p.id,
                rosterId: p.rosterId,
                memberId: p.memberId,
                role: p.role,
                isCaptain: p.isCaptain,
                ign: p.ign,
                firstName: member?.firstName ?? '',
                lastName: member?.lastName ?? '',
                discord: member?.discord ?? '',
                rosterName: roster?.name ?? '',
                gameName: game?.displayName ?? '',
              };
            });
          }
          return matchingPlayers;
        }

        // 5. Player Invites join Schools & Games
        if (currentTable === schema.playerInvites) {
          const matchingInvites = store.filter((inv) => conds.every((c) => matchesRow(inv, c)));
          return matchingInvites.map((inv) => {
            const school = state.schoolsStore.find((s) => s.id === inv.schoolId);
            const game = state.gamesStore.find((g) => g.id === inv.gameId);
            return {
              ...inv,
              schoolSlug: school?.slug ?? '',
              gameSlug: game?.slug ?? '',
              gameName: game?.displayName ?? '',
            };
          });
        }

        // Standard filter for schools, games, members, playerIdentities, teams
        return store.filter((item) => conds.every((c) => matchesRow(item, c)));
      }

      return builder;
    }),

    insert: vi.fn((tbl: any) => {
      const store = getStore(tbl);
      return {
        values: vi.fn((data: any) => {
          const record = {
            id: data.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: new Date(),
            ...data,
          };
          if (store) store.push(record);

          return {
            returning: vi.fn(() => Promise.resolve([record])),
            then: (resolve: (v: any) => void) => resolve([record]),
          };
        }),
      };
    }),

    update: vi.fn((tbl: any) => {
      const store = getStore(tbl);
      let setValues: any = {};

      return {
        set: vi.fn((vals: any) => {
          setValues = vals;
          return {
            where: vi.fn((clause: any) => {
              const conds = extractConditions(clause);
              const updatedRecords: any[] = [];
              if (store) {
                for (let i = 0; i < store.length; i++) {
                  if (conds.every((c) => matchesRow(store[i], c))) {
                    store[i] = { ...store[i], ...setValues };
                    updatedRecords.push(store[i]);
                  }
                }
              }
              return {
                returning: vi.fn(() => Promise.resolve(updatedRecords)),
                then: (resolve: (v: any) => void) => resolve(updatedRecords),
              };
            }),
          };
        }),
      };
    }),

    delete: vi.fn((tbl: any) => {
      const store = getStore(tbl);
      return {
        where: vi.fn((clause: any) => {
          const conds = extractConditions(clause);
          if (store) {
            for (let i = store.length - 1; i >= 0; i--) {
              if (conds.every((c) => matchesRow(store[i], c))) {
                store.splice(i, 1);
              }
            }
          }
          return {
            then: (resolve: (v: any) => void) => resolve([]),
          };
        }),
      };
    }),

    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(mockDb);
    }),
  };

  return {
    mockUpdateCacheTags,
    mockDb,
    state,
    setClaims: (c: ClaimsUser | null) => {
      currentClaims = c;
    },
    getClaims: () => ({ data: { claims: currentClaims } }),
  };
});

// --- MODULE MOCKS ---
vi.mock('@/app/lib/db', () => ({
  db: mocks.mockDb,
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

// Import implementations under test
import {
  getSchoolManagerContext,
  assertManagerForSchool,
  assertManagerForRoster,
} from '@/app/lib/onboarding/manager-auth';
import {
  generateInviteToken,
  createPlayerInvite,
  getSchoolInvites,
  getPendingSubmissions,
  reviewPlayerInvite,
  getRosterEligibility,
  emergencySwapSub,
  enrollPlayerToRoster,
  removePlayerFromRoster,
  updateRosterPlayerRole,
  getSchoolPlayerPool,
} from '@/app/lib/onboarding/portal-actions';

describe('Milestone 3: School Manager Portal & Live Eligibility Gates', () => {
  const schoolId = 'school-stuy-uuid';
  const otherSchoolId = 'school-bxsci-uuid';
  const valGameId = 'game-val-uuid';
  const lolGameId = 'game-lol-uuid';

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.setClaims({
      sub: 'manager-user-1',
      email: 'coach@stuy.edu',
    });

    mocks.state.schoolsStore = [
      { id: schoolId, name: 'Stuyvesant High School', slug: 'stuyvesant', deletedAt: null },
      { id: otherSchoolId, name: 'Bronx Science', slug: 'bronx-science', deletedAt: null },
    ];

    mocks.state.gamesStore = [
      { id: valGameId, slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' },
      { id: lolGameId, slug: 'league-of-legends', displayName: 'League of Legends', shortName: 'LOL' },
    ];

    mocks.state.rolesStore = [
      { id: 'role-everyone', name: '@everyone', permissions: BigInt(0), position: 0, isOwner: false },
    ];

    mocks.state.userRolesStore = [];

    mocks.state.schoolManagersStore = [
      {
        id: 'mgr-1',
        schoolId,
        userId: 'manager-user-1',
        managedGames: ['valorant'], // Scoped to Valorant only
        academicYear: '2025-2026',
        isPrimaryContact: true,
        isActive: true,
      },
    ];

    mocks.state.playerInvitesStore = [];
    mocks.state.teamsStore = [
      { id: 'team-val-stuy', schoolId, gameId: valGameId, seasonId: 'season-fall-26' },
      { id: 'team-val-bxsci', schoolId: otherSchoolId, gameId: valGameId, seasonId: 'season-fall-26' },
    ];
    mocks.state.rostersStore = [
      { id: 'roster-varsity-val', teamId: 'team-val-stuy', name: 'Varsity', division: 'A' },
      { id: 'roster-bxsci-val', teamId: 'team-val-bxsci', name: 'Varsity', division: 'A' },
    ];
    mocks.state.playersStore = [];
    mocks.state.membersStore = [];
    mocks.state.playerIdentitiesStore = [];
    mocks.state.studentDemographicsStore = [];
  });

  describe('1. Secure Token Generation & Expiration', () => {
    it('generates a 64-character (32-byte) hex token with an exact SHA-256 match', async () => {
      const { token, tokenHash } = await generateInviteToken();

      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);

      const computedHash = crypto.createHash('sha256').update(token).digest('hex');
      expect(tokenHash).toBe(computedHash);
    });

    it('generates cryptographically unique tokens across successive calls', async () => {
      const tokens = new Set();
      for (let i = 0; i < 50; i++) {
        const { token } = await generateInviteToken();
        tokens.add(token);
      }
      expect(tokens.size).toBe(50);
    });

    it('creates an invite record with tokenHash and correct expiration date (default 7 days)', async () => {
      const before = Date.now();
      const result = await createPlayerInvite({
        schoolId,
        gameId: valGameId,
        intendedFirstName: 'Alex',
        intendedLastName: 'Chen',
      });

      expect(result.inviteId).toBeDefined();
      expect(result.token).toHaveLength(64);
      expect(result.intendedFirstName).toBe('Alex');
      expect(result.intendedLastName).toBe('Chen');
      expect(result.inviteUrl).toBe(`/join/stuyvesant/valorant?token=${result.token}`);

      // Verify DB record stores tokenHash, never plaintext token
      const dbInvite = mocks.state.playerInvitesStore.find((inv) => inv.id === result.inviteId);
      expect(dbInvite).toBeDefined();
      expect(dbInvite.tokenHash).toBe(
        crypto.createHash('sha256').update(result.token).digest('hex')
      );
      expect(dbInvite.token).toBeUndefined();

      // Expiration is ~7 days
      const diffDays = (new Date(result.expiresAt).getTime() - before) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(7);
    });

    it('respects custom expiration period (e.g. 3 or 14 days)', async () => {
      const before = Date.now();
      const result = await createPlayerInvite({
        schoolId,
        gameId: valGameId,
        intendedFirstName: 'Sam',
        intendedLastName: 'Kim',
        expiresInDays: 14,
      });

      const diffDays = (new Date(result.expiresAt).getTime() - before) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(14);
    });

    it('retrieves invites for the school matching the requested game', async () => {
      await createPlayerInvite({
        schoolId,
        gameId: valGameId,
        intendedFirstName: 'Jordan',
        intendedLastName: 'Lee',
      });

      const schoolInvites = await getSchoolInvites(schoolId, valGameId);
      expect(schoolInvites.length).toBeGreaterThanOrEqual(1);
      expect(schoolInvites[0].intendedFirstName).toBe('Jordan');
      expect(schoolInvites[0].schoolSlug).toBe('stuyvesant');
      expect(schoolInvites[0].gameName).toBe('Valorant');
    });
  });

  describe('2. Anti-IDOR Authorization Gates', () => {
    it('throws Unauthorized when no authenticated user is found', async () => {
      mocks.setClaims(null);
      await expect(assertManagerForSchool(schoolId, valGameId)).rejects.toThrow('Unauthorized');
    });

    it('throws Forbidden when user does not manage the target school', async () => {
      await expect(assertManagerForSchool(otherSchoolId, valGameId)).rejects.toThrow(
        /Forbidden: Not authorized for school/
      );
    });

    it('throws Forbidden when school manager is scoped to Valorant but attempts to access League of Legends', async () => {
      await expect(assertManagerForSchool(schoolId, lolGameId)).rejects.toThrow(
        /Forbidden: Not authorized for game/
      );
    });

    it('throws Forbidden when manager attempts to access a roster belonging to another school', async () => {
      await expect(assertManagerForRoster('roster-bxsci-val')).rejects.toThrow(
        /Forbidden: Not authorized for school/
      );
    });

    it('allows Staff Admin with ADMINISTRATOR permission to manage any school, game, and roster', async () => {
      // Elevate user to staff admin
      mocks.setClaims({ sub: 'admin-user', email: 'admin@ezesports.org' });
      mocks.state.rolesStore.push({
        id: 'role-admin',
        name: 'Administrator',
        permissions: Permissions.ADMINISTRATOR,
        position: 10,
        isOwner: false,
      });
      mocks.state.userRolesStore.push({
        userId: 'admin-user',
        roleId: 'role-admin',
      });

      const context = await assertManagerForSchool(otherSchoolId, lolGameId);
      expect(context.isStaffAdmin).toBe(true);

      const rosterAccess = await assertManagerForRoster('roster-bxsci-val');
      expect(rosterAccess.roster.id).toBe('roster-bxsci-val');
    });

    it('allows League Owner (isOwner: true) to access any school without explicit school manager rows', async () => {
      mocks.setClaims({ sub: 'owner-user', email: 'owner@ezesports.org' });
      mocks.state.rolesStore.push({
        id: 'role-owner',
        name: 'Owner',
        permissions: BigInt(0),
        position: 100,
        isOwner: true,
      });
      mocks.state.userRolesStore.push({
        userId: 'owner-user',
        roleId: 'role-owner',
      });

      const context = await getSchoolManagerContext(schoolId);
      expect(context).not.toBeNull();
      expect(context?.isStaffAdmin).toBe(true);
      expect(context?.managedSchools.length).toBe(2);
    });
  });

  describe('3. Pending Submissions & Zero-PII Invariant', () => {
    it('returns pending submissions with IGN, Discord, and Grade WITHOUT leaking demographic PII', async () => {
      // 1. Setup student member and identities
      const memberId = 'member-alex-chen';
      mocks.state.membersStore.push({
        id: memberId,
        firstName: 'Alex',
        lastName: 'Chen',
        graduationYear: 2027,
        discord: 'AlexC#0001',
        schoolId,
      });

      mocks.state.playerIdentitiesStore.push(
        {
          id: 'ident-riot-1',
          memberId,
          provider: 'riot',
          providerUserId: 'Demon1#LFT1',
          providerUsername: 'Demon1',
          inGuild: false,
        },
        {
          id: 'ident-discord-1',
          memberId,
          provider: 'discord',
          providerUserId: '123456789',
          providerUsername: 'comaticx',
          inGuild: true,
        }
      );

      // 2. Sensitive demographic vault contains minor demographic PII
      mocks.state.studentDemographicsStore.push({
        id: 'vault-alex',
        memberId,
        legalFirstName: 'Alexander',
        legalLastName: 'Chen',
        birthDate: new Date('2009-04-12'),
        isFreeOrReducedLunch: true, // Title I
        race: ['Asian'],
        countryOfBirth: 'China',
      });

      // 3. Submitted invite
      mocks.state.playerInvitesStore.push({
        id: 'inv-alex-submitted',
        schoolId,
        gameId: valGameId,
        intendedFirstName: 'Alex',
        intendedLastName: 'Chen',
        memberId,
        tokenHash: 'somehash',
        status: 'submitted',
        submittedAt: new Date('2026-09-30T12:00:00Z'),
        expiresAt: new Date('2026-10-07'),
        submissionDraft: { grade: '11th Grade' },
      });

      const submissions = await getPendingSubmissions(schoolId, valGameId);

      expect(submissions).toHaveLength(1);
      const sub = submissions[0];

      // Comp Ops fields are present
      expect(sub.playerName).toBe('Alex Chen');
      expect(sub.ign).toBe('Demon1#LFT1');
      expect(sub.discord).toBe('comaticx');
      expect(sub.grade).toBe('11th Grade');

      // CRITICAL ZERO-PII INVARIANT: Sensitive demographic keys MUST NOT exist
      expect((sub as any).isFreeOrReducedLunch).toBeUndefined();
      expect((sub as any).birthDate).toBeUndefined();
      expect((sub as any).race).toBeUndefined();
      expect((sub as any).countryOfBirth).toBeUndefined();
      expect((sub as any).legalFirstName).toBeUndefined();
    });
  });

  describe('4. Review Actions (Approve & Reject)', () => {
    const inviteId = 'inv-review-test';
    const memberId = 'member-review-test';

    beforeEach(() => {
      mocks.state.membersStore.push({
        id: memberId,
        firstName: 'Tyler',
        lastName: 'Vance',
        schoolId,
      });

      mocks.state.playerIdentitiesStore.push({
        id: 'ident-riot-tyler',
        memberId,
        provider: 'riot',
        providerUserId: 'Tyler#NA1',
        providerUsername: 'Tyler',
        inGuild: true,
      });

      mocks.state.playerInvitesStore.push({
        id: inviteId,
        schoolId,
        gameId: valGameId,
        memberId,
        intendedFirstName: 'Tyler',
        intendedLastName: 'Vance',
        status: 'submitted',
        tokenHash: 'hash-tyler',
        expiresAt: new Date('2026-10-07'),
      });
    });

    it('approving an application sets status to accepted and inserts player into roster', async () => {
      const result = await reviewPlayerInvite({
        inviteId,
        action: 'approve',
        rosterId: 'roster-varsity-val',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('accepted');

      const invite = mocks.state.playerInvitesStore.find((i) => i.id === inviteId);
      expect(invite.status).toBe('accepted');
      expect(invite.reviewedAt).toBeInstanceOf(Date);

      // Verify player row created in DB
      const playerRecord = mocks.state.playersStore.find(
        (p) => p.rosterId === 'roster-varsity-val' && p.memberId === memberId
      );
      expect(playerRecord).toBeDefined();
      expect(playerRecord.role).toBe('player');
      expect(playerRecord.ign).toBe('Tyler#NA1');
      expect(playerRecord.isCaptain).toBe(false);

      // Verify cache invalidation
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'teams');
    });

    it('rejecting an application sets status to rejected with reason and does not create player', async () => {
      const result = await reviewPlayerInvite({
        inviteId,
        action: 'reject',
        rejectionReason: 'Invalid school attendance record',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Invalid school attendance record');

      const invite = mocks.state.playerInvitesStore.find((i) => i.id === inviteId);
      expect(invite.status).toBe('rejected');
      expect(invite.rejectionReason).toBe('Invalid school attendance record');

      // Player row is NOT created
      const playerRecord = mocks.state.playersStore.find((p) => p.memberId === memberId);
      expect(playerRecord).toBeUndefined();
    });
  });

  describe('5. The 5-Point Live Validation Gate (getRosterEligibility)', () => {
    const rosterId = 'roster-varsity-val';

    function setupRosterWithPlayers({
      totalCount = 6,
      captainCount = 1,
      subCount = 1,
      missingRiotCount = 0,
      missingDiscordCount = 0,
      missingGuildCount = 0,
    } = {}) {
      mocks.state.playersStore = [];
      mocks.state.membersStore = [];
      mocks.state.playerIdentitiesStore = [];

      for (let i = 0; i < totalCount; i++) {
        const pMemberId = `m-${i}`;
        const pId = `p-${i}`;
        const isCap = i < captainCount;
        const isSub = i >= totalCount - subCount;
        const role = isCap ? 'captain' : isSub ? 'sub' : 'player';

        mocks.state.membersStore.push({
          id: pMemberId,
          firstName: `Player`,
          lastName: `${i}`,
          schoolId,
        });

        mocks.state.playersStore.push({
          id: pId,
          rosterId,
          memberId: pMemberId,
          role,
          isCaptain: isCap,
          ign: `IGN#${i}`,
        });

        // Riot identity
        if (i >= missingRiotCount) {
          mocks.state.playerIdentitiesStore.push({
            id: `riot-${i}`,
            memberId: pMemberId,
            provider: 'riot',
            providerUserId: `IGN#${i}`,
            providerUsername: `IGN`,
            inGuild: false,
          });
        }

        // Discord identity
        if (i >= missingDiscordCount) {
          mocks.state.playerIdentitiesStore.push({
            id: `discord-${i}`,
            memberId: pMemberId,
            provider: 'discord',
            providerUserId: `disc-${i}`,
            providerUsername: `user${i}`,
            inGuild: i >= missingGuildCount,
          });
        }
      }
    }

    it('passes all 5 gates when roster satisfies standard competitive requirements (5 starters, 1 sub, 1 captain, 100% verified)', async () => {
      setupRosterWithPlayers({
        totalCount: 6,
        captainCount: 1,
        subCount: 1,
        missingRiotCount: 0,
        missingDiscordCount: 0,
        missingGuildCount: 0,
      });

      const gate = await getRosterEligibility({ rosterId });

      expect(gate.eligible).toBe(true);
      expect(gate.reasons).toHaveLength(0);
      expect(gate.gateChecks.minSize).toBe(true);
      expect(gate.gateChecks.singleCaptain).toBe(true);
      expect(gate.gateChecks.riotLinked).toBe(true);
      expect(gate.gateChecks.discordLinked).toBe(true);
      expect(gate.gateChecks.inGuild).toBe(true);
      expect(gate.stats.totalPlayers).toBe(6);
      expect(gate.stats.subsCount).toBe(1);
    });

    it('fails Gate 1 if roster has fewer than 6 players or no substitute', async () => {
      // 5 starters, 0 subs
      setupRosterWithPlayers({ totalCount: 5, captainCount: 1, subCount: 0 });

      const gate = await getRosterEligibility({ rosterId });
      expect(gate.eligible).toBe(false);
      expect(gate.gateChecks.minSize).toBe(false);
      expect(gate.reasons.some((r) => r.includes('Roster size must be at least 6'))).toBe(true);
    });

    it('fails Gate 2 if roster has 0 captains or multiple captains', async () => {
      // 0 captains
      setupRosterWithPlayers({ totalCount: 6, captainCount: 0, subCount: 1 });
      const gateNoCap = await getRosterEligibility({ rosterId });
      expect(gateNoCap.eligible).toBe(false);
      expect(gateNoCap.gateChecks.singleCaptain).toBe(false);
      expect(gateNoCap.reasons.some((r) => r.includes('exactly 1 designated captain (currently 0)'))).toBe(true);

      // 2 captains
      setupRosterWithPlayers({ totalCount: 6, captainCount: 2, subCount: 1 });
      const gateTwoCap = await getRosterEligibility({ rosterId });
      expect(gateTwoCap.eligible).toBe(false);
      expect(gateTwoCap.gateChecks.singleCaptain).toBe(false);
      expect(gateTwoCap.reasons.some((r) => r.includes('exactly 1 designated captain (currently 2)'))).toBe(true);
    });

    it('fails Gate 3 if any player is missing a linked Riot ID', async () => {
      setupRosterWithPlayers({ totalCount: 6, missingRiotCount: 1 });
      const gate = await getRosterEligibility({ rosterId });
      expect(gate.eligible).toBe(false);
      expect(gate.gateChecks.riotLinked).toBe(false);
      expect(gate.reasons.some((r) => r.includes('linked Riot ID'))).toBe(true);
    });

    it('fails Gate 4 if any player is missing a linked Discord account', async () => {
      setupRosterWithPlayers({ totalCount: 6, missingDiscordCount: 1 });
      const gate = await getRosterEligibility({ rosterId });
      expect(gate.eligible).toBe(false);
      expect(gate.gateChecks.discordLinked).toBe(false);
      expect(gate.reasons.some((r) => r.includes('linked Discord account'))).toBe(true);
    });

    it('fails Gate 5 if any player is missing from the official Discord server (inGuild: false)', async () => {
      setupRosterWithPlayers({ totalCount: 6, missingGuildCount: 1 });
      const gate = await getRosterEligibility({ rosterId });
      expect(gate.eligible).toBe(false);
      expect(gate.gateChecks.inGuild).toBe(false);
      expect(gate.reasons.some((r) => r.includes('official Discord server'))).toBe(true);
    });
  });

  describe('6. Emergency Substitution Swap Logic', () => {
    const rosterId = 'roster-varsity-val';
    const starterId = 'player-starter-1';
    const subId = 'player-sub-1';
    const captainId = 'player-captain-1';

    beforeEach(() => {
      mocks.state.playersStore = [
        {
          id: captainId,
          rosterId,
          memberId: 'm-cap',
          role: 'captain',
          isCaptain: true,
          ign: 'Cap#1',
        },
        {
          id: starterId,
          rosterId,
          memberId: 'm-starter',
          role: 'player',
          isCaptain: false,
          ign: 'Starter#1',
        },
        {
          id: subId,
          rosterId,
          memberId: 'm-sub',
          role: 'sub',
          isCaptain: false,
          ign: 'Sub#1',
        },
      ];
    });

    it('atomically swaps an active starter with a bench sub', async () => {
      const result = await emergencySwapSub({
        rosterId,
        outPlayerId: starterId,
        inPlayerId: subId,
      });

      expect(result.success).toBe(true);
      expect(result.swapped).toEqual({ outPlayerId: starterId, inPlayerId: subId });

      const updatedStarter = mocks.state.playersStore.find((p) => p.id === starterId);
      const updatedSub = mocks.state.playersStore.find((p) => p.id === subId);

      // Starter became sub
      expect(updatedStarter.role).toBe('sub');
      expect(updatedStarter.isCaptain).toBe(false);

      // Sub became active starter
      expect(updatedSub.role).toBe('player');
      expect(updatedSub.isCaptain).toBe(false);

      // Cache invalidation triggered
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'teams');
    });

    it('transfers captain role when emergency swapping out a team captain', async () => {
      const result = await emergencySwapSub({
        rosterId,
        outPlayerId: captainId,
        inPlayerId: subId,
      });

      expect(result.success).toBe(true);

      const updatedCap = mocks.state.playersStore.find((p) => p.id === captainId);
      const updatedSub = mocks.state.playersStore.find((p) => p.id === subId);

      // Previous captain becomes bench sub
      expect(updatedCap.role).toBe('sub');
      expect(updatedCap.isCaptain).toBe(false);

      // Substitute assumes captaincy
      expect(updatedSub.role).toBe('captain');
      expect(updatedSub.isCaptain).toBe(true);
    });

    it('throws error if attempting to swap out a player who is already a sub', async () => {
      await expect(
        emergencySwapSub({
          rosterId,
          outPlayerId: subId, // sub cannot be swapped out as starter
          inPlayerId: starterId,
        })
      ).rejects.toThrow(/Player to swap out must be an active starter or captain/);
    });

    it('throws error if attempting to swap in a player who is not a substitute', async () => {
      await expect(
        emergencySwapSub({
          rosterId,
          outPlayerId: captainId,
          inPlayerId: starterId, // starter is not a sub
        })
      ).rejects.toThrow(/Player to swap in must be an active substitute/);
    });

    it('throws error when attempting to swap a player with themselves', async () => {
      await expect(
        emergencySwapSub({
          rosterId,
          outPlayerId: starterId,
          inPlayerId: starterId,
        })
      ).rejects.toThrow(/Cannot swap a player with themselves/);
    });
  });

  describe('7. Direct Roster Enrollment & Player Pool Management', () => {
    const teamId = 'team-val-stuy';
    const rosterId = 'roster-val-varsity';
    const memberId = 'member-new-stuy';
    const otherSchoolMemberId = 'member-bxsci-1';

    beforeEach(() => {
      mocks.state.schoolManagersStore = [
        {
          id: 'sm-1',
          schoolId,
          userId: 'manager-user-1',
          managedGames: null,
          isPrimaryContact: true,
          isActive: true,
        },
      ];

      mocks.state.teamsStore = [
        {
          id: teamId,
          schoolId,
          gameId: valGameId,
          seasonId: 'season-1',
        },
      ];

      mocks.state.rostersStore = [
        {
          id: rosterId,
          teamId,
          name: 'Varsity',
          division: 'A',
        },
      ];

      mocks.state.membersStore = [
        {
          id: memberId,
          schoolId,
          firstName: 'Justin',
          lastName: 'Wong',
          discord: 'jwong#0001',
          graduationYear: 2026,
        },
        {
          id: 'member-cap',
          schoolId,
          firstName: 'Original',
          lastName: 'Captain',
          discord: 'cap#0001',
          graduationYear: 2025,
        },
        {
          id: otherSchoolMemberId,
          schoolId: otherSchoolId,
          firstName: 'Bronx',
          lastName: 'Student',
          discord: 'bx#0001',
          graduationYear: 2026,
        },
      ];

      mocks.state.playersStore = [
        {
          id: 'player-cap',
          rosterId,
          memberId: 'member-cap',
          role: 'captain',
          ign: 'OldCap',
          isCaptain: true,
        },
      ];

      mocks.state.playerIdentitiesStore = [
        {
          id: 'ident-riot-1',
          memberId,
          provider: 'riot',
          providerUserId: 'JWong#NA1',
          providerUsername: 'JWong#NA1',
          inGuild: true,
        },
        {
          id: 'ident-discord-1',
          memberId,
          provider: 'discord',
          providerUserId: 'disc-jwong',
          providerUsername: 'jwong',
          inGuild: true,
        },
      ];
    });

    it('enrolls an eligible school member onto a roster as a starter', async () => {
      const result = await enrollPlayerToRoster({
        rosterId,
        memberId,
        role: 'player',
      });

      expect(result.success).toBe(true);
      expect(result.player.memberId).toBe(memberId);
      expect(result.player.playerName).toBe('Justin Wong');
      expect(result.player.ign).toBe('JWong#NA1');
      expect(result.player.role).toBe('player');
      expect(result.player.isCaptain).toBe(false);
      expect(result.player.riotVerified).toBe(true);
      expect(result.player.inGuild).toBe(true);

      const inDb = mocks.state.playersStore.find((p) => p.memberId === memberId && p.rosterId === rosterId);
      expect(inDb).toBeDefined();
      expect(inDb.role).toBe('player');
      expect(inDb.isCaptain).toBe(false);
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'teams');
    });

    it('enrolls a player as team captain, transferring captaincy from existing captain atomically', async () => {
      const result = await enrollPlayerToRoster({
        rosterId,
        memberId,
        role: 'captain',
      });

      expect(result.success).toBe(true);
      expect(result.player.role).toBe('captain');
      expect(result.player.isCaptain).toBe(true);

      // Old captain demoted to player
      const oldCap = mocks.state.playersStore.find((p) => p.id === 'player-cap');
      expect(oldCap.role).toBe('player');
      expect(oldCap.isCaptain).toBe(false);

      // New captain active
      const newCap = mocks.state.playersStore.find((p) => p.memberId === memberId);
      expect(newCap.role).toBe('captain');
      expect(newCap.isCaptain).toBe(true);
    });

    it('rejects enrollment if member belongs to a different school (Anti-IDOR / Tenancy check)', async () => {
      await expect(
        enrollPlayerToRoster({
          rosterId,
          memberId: otherSchoolMemberId,
          role: 'player',
        })
      ).rejects.toThrow(/Member does not belong to the school managing this roster/);
    });

    it('updates player role between starter, sub, and captain via updateRosterPlayerRole', async () => {
      // Demote current captain to sub
      const result = await updateRosterPlayerRole({
        rosterId,
        playerId: 'player-cap',
        role: 'sub',
      });

      expect(result.success).toBe(true);
      expect(result.role).toBe('sub');
      expect(result.isCaptain).toBe(false);

      const updated = mocks.state.playersStore.find((p) => p.id === 'player-cap');
      expect(updated.role).toBe('sub');
      expect(updated.isCaptain).toBe(false);
    });

    it('removes a player from a roster via removePlayerFromRoster', async () => {
      const result = await removePlayerFromRoster({
        rosterId,
        playerId: 'player-cap',
      });

      expect(result.success).toBe(true);
      expect(result.playerId).toBe('player-cap');

      const found = mocks.state.playersStore.find((p) => p.id === 'player-cap');
      expect(found).toBeUndefined();
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'teams');
    });

    it('retrieves school player pool with Zero-PII Invariant maintained', async () => {
      const pool = await getSchoolPlayerPool(schoolId);

      expect(pool.length).toBeGreaterThanOrEqual(2);
      const justin = pool.find((p) => p.memberId === memberId);
      expect(justin).toBeDefined();
      expect(justin?.playerName).toBe('Justin Wong');
      expect(justin?.ign).toBe('JWong#NA1');
      expect(justin?.discordUsername).toBe('jwong');
      expect(justin?.riotVerified).toBe(true);

      // Verify Zero-PII Invariant: No demographic data fields present
      for (const p of pool) {
        expect((p as any).birthDate).toBeUndefined();
        expect((p as any).race).toBeUndefined();
        expect((p as any).ethnicity).toBeUndefined();
        expect((p as any).freeReducedLunch).toBeUndefined();
      }
    });
  });
});
