import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as schema from '@/app/lib/db/schema';
import { Permissions } from '@/app/lib/roles';

// --- HOISTED MOCKS ---
const mocks = vi.hoisted(() => {
  const mockUpdateCacheTags = vi.fn();
  const mockNotify = vi.fn(async (_ids: string[]) => {});

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
    seasonsStore: [] as any[],
    rostersStore: [] as any[],
    playersStore: [] as any[],
    membersStore: [] as any[],
    playerIdentitiesStore: [] as any[],
    studentDemographicsStore: [] as any[],
    staffMembersStore: [] as any[],
    /** Whether the stand-in removal helper reports the member record as deleted (else kept). */
    removalDeletesMember: false,
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
    if (tbl === schema.seasons) return state.seasonsStore;
    if (tbl === schema.rosters) return state.rostersStore;
    if (tbl === schema.players) return state.playersStore;
    if (tbl === schema.members) return state.membersStore;
    if (tbl === schema.playerIdentities) return state.playerIdentitiesStore;
    if (tbl === schema.studentDemographics) return state.studentDemographicsStore;
    if (tbl === schema.staffMembers) return state.staffMembersStore;
    return null;
  }

  const mockDb: any = {
    select: vi.fn((_fields?: any) => {
      let currentTable: any = null;
      const joins: Array<{ table: any; on: any }> = [];
      let whereClause: any = null;
      let ordered = false;

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
        orderBy: vi.fn(() => {
          ordered = true;
          return builder;
        }),
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
          const rows = store
            .filter((m) => conds.every((c) => matchesRow(m, c)))
            // The query inner-joins schools and requires schools.deleted_at IS NULL.
            .filter((m) => {
              const sch = state.schoolsStore.find((x) => x.id === m.schoolId);
              return !!sch && (sch.deletedAt === null || sch.deletedAt === undefined);
            });
          return rows.map((m) => {
            const school = state.schoolsStore.find((s) => s.id === m.schoolId);
            return {
              schoolId: m.schoolId,
              schoolName: school?.name ?? 'Unknown School',
              schoolSlug: school?.slug ?? 'unknown',
              managedGames: m.managedGames,
              academicYear: m.academicYear,
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
          const rows = store.filter((r) => conds.every((c) => matchesRow(r, c)));
          // orderBy(createdAt, id): oldest first, id as the tie-break.
          return ordered
            ? [...rows].sort((x, y) => (x.createdAt?.getTime?.() ?? 0) - (y.createdAt?.getTime?.() ?? 0) || String(x.id).localeCompare(String(y.id)))
            : rows;
        }

        // 4. Players join Members, Rosters, Teams, Games
        if (currentTable === schema.players) {
          // Joined columns (teams.season_id) are matched against the player's roster -> team.
          const withTeamColumns = (p: any) => {
            const roster = state.rostersStore.find((r) => r.id === p.rosterId);
            const team = state.teamsStore.find((t) => t.id === roster?.teamId);
            return { ...p, seasonId: team?.seasonId };
          };
          const matchingPlayers = store.filter((p) => conds.every((c) => matchesRow(withTeamColumns(p), c)));
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
                gameId: team?.gameId,
                seasonId: team?.seasonId,
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
          const removed: any[] = [];
          if (store) {
            for (let i = store.length - 1; i >= 0; i--) {
              if (conds.every((c) => matchesRow(store[i], c))) {
                removed.push(store[i]);
                store.splice(i, 1);
              }
            }
          }
          return {
            returning: vi.fn(() => Promise.resolve(removed)),
            then: (resolve: (v: any) => void) => resolve([]),
          };
        }),
      };
    }),

    // The advisory lock (pg_advisory_xact_lock) is the only raw SQL the actions run.
    execute: vi.fn(async (_query: unknown) => []),
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(mockDb);
    }),
  };

  return {
    mockUpdateCacheTags,
    mockNotify,
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

// The shared removal helper has its own suite (app/lib/db/__tests__/roster-removal.test.ts). Here it
// is a stand-in that removes the player from the fake store, so these tests prove the manager
// action's authorization, transaction, cache tags and notification around it.
vi.mock('@/app/lib/db/roster-removal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/db/roster-removal')>()),
  removePlayerFromRosterTx: vi.fn(async (_tx: unknown, input: { playerId: string; rosterId: string }) => {
    const store = mocks.state.playersStore;
    const i = store.findIndex((p: any) => p.id === input.playerId && p.rosterId === input.rosterId);
    if (i < 0) return { removed: false };
    const [row] = store.splice(i, 1);
    if (mocks.state.removalDeletesMember) {
      // Like the real cleanup, a deleted student record takes the member and their invites with it.
      mocks.state.membersStore = mocks.state.membersStore.filter((m: any) => m.id !== row.memberId);
      mocks.state.playerInvitesStore = mocks.state.playerInvitesStore.filter((inv: any) => inv.memberId !== row.memberId);
    }
    return mocks.state.removalDeletesMember
      ? { removed: true, memberId: row.memberId, studentRecord: 'deleted', deleted: { consents: 1, demographics: 1, identities: 1, invites: 1 } }
      : { removed: true, memberId: row.memberId, studentRecord: 'kept', keptReason: 'other_roster' };
  }),
}));

vi.mock('@/app/lib/onboarding/roster-membership-events', () => ({
  notifyRosterMembershipChanged: mocks.mockNotify,
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
  resolveManagerSeason,
  getAuthorizedGameScopes,
  resolveRequestedGameId,
  assertManagerForSchool,
  assertManagerForRoster,
} from '@/app/lib/onboarding/manager-auth';
import {
  generateInviteToken,
  createPlayerInvite,
  getSchoolInvites,
  regeneratePlayerInviteLink,
  deletePlayerInvite,
  getPendingSubmissions,
  reviewPlayerInvite,
  getRosterEligibility,
  emergencySwapSub,
  enrollPlayerToRoster,
  removePlayerFromRoster,
  movePlayerToRoster,
  updateRosterPlayerRole,
  getSchoolPlayerPool,
  createSchoolRoster,
  deleteSchoolRoster,
  getSchoolRosters,
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
        academicYear: '2026-27',
        isPrimaryContact: true,
        isActive: true,
      },
    ];

    mocks.state.playerInvitesStore = [];
    mocks.state.seasonsStore = [
      { id: 'season-fall-26', gameId: valGameId, name: '2026-27', isActive: true },
      { id: 'season-lol-26', gameId: lolGameId, name: '2026-27', isActive: true },
    ];
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

    it.each([3, 5, 7])('respects the %i-day expiration option', async (days) => {
      const before = Date.now();
      const result = await createPlayerInvite({
        schoolId,
        gameId: valGameId,
        intendedFirstName: 'Sam',
        intendedLastName: 'Kim',
        expiresInDays: days,
      });

      const diffDays = (new Date(result.expiresAt).getTime() - before) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(days);
    });

    it.each([0, 1, 4, 6, 8, 14, -3, 3.5, Number.NaN])('rejects the unsupported %s-day expiration instead of clamping', async (days) => {
      await expect(
        createPlayerInvite({
          schoolId,
          gameId: valGameId,
          intendedFirstName: 'Sam',
          intendedLastName: 'Kim',
          expiresInDays: days,
        })
      ).rejects.toThrow(/must be one of 3, 5, 7/);
      expect(mocks.state.playerInvitesStore).toHaveLength(0);
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

  describe('1b. Invite regenerate-link and delete', () => {
    const makeInvite = async (gameId = valGameId) =>
      createPlayerInvite({ schoolId, gameId, intendedFirstName: 'Jordan', intendedLastName: 'Lee' });
    const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
    const byId = (id: string) => mocks.state.playerInvitesStore.find((i) => i.id === id);

    it('regenerate kills the old token and the new one resolves through the real lookup', async () => {
      const created = await makeInvite();
      const result = await regeneratePlayerInviteLink(created.inviteId);
      if (!result.success) throw new Error('expected success');

      expect(result.inviteUrl).toMatch(/^\/join\/stuyvesant\/valorant\?token=[0-9a-f]{64}$/);
      const newToken = result.inviteUrl.split('token=')[1];
      expect(byId(created.inviteId).tokenHash).toBe(sha(newToken));
      expect(byId(created.inviteId).status).toBe('pending');

      const { findInviteByTokenHash } = await import('@/app/lib/db/onboarding');
      expect(await findInviteByTokenHash(sha(created.token))).toBeUndefined();
      const found = await findInviteByTokenHash(sha(newToken));
      expect(found?.kind).toBe('player');
      expect(found?.invite.id).toBe(created.inviteId);
    });

    it('regenerate renews an expired-but-pending invite to 7 days', async () => {
      const created = await makeInvite();
      byId(created.inviteId).expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const before = Date.now();
      const result = await regeneratePlayerInviteLink(created.inviteId);
      if (!result.success) throw new Error('expected success');
      const days = (new Date(byId(created.inviteId).expiresAt).getTime() - before) / (24 * 60 * 60 * 1000);
      expect(Math.round(days)).toBe(7);
      expect(new Date(result.expiresAt).getTime()).toBe(new Date(byId(created.inviteId).expiresAt).getTime());
    });

    it('delete removes a pending invite and its token no longer resolves', async () => {
      const created = await makeInvite();
      expect(await deletePlayerInvite(created.inviteId)).toEqual({ success: true, inviteId: created.inviteId });
      expect(byId(created.inviteId)).toBeUndefined();
      const { findInviteByTokenHash } = await import('@/app/lib/db/onboarding');
      expect(await findInviteByTokenHash(sha(created.token))).toBeUndefined();
    });

    it.each(['submitted', 'accepted', 'rejected'])('returns a rejection for a %s invite and changes nothing', async (status) => {
      const created = await makeInvite();
      byId(created.inviteId).status = status;
      const hashBefore = byId(created.inviteId).tokenHash;

      for (const result of [await deletePlayerInvite(created.inviteId), await regeneratePlayerInviteLink(created.inviteId)]) {
        expect(result).toEqual({ success: false, error: expect.stringMatching(/Only pending invites/), status });
      }
      expect(byId(created.inviteId).tokenHash).toBe(hashBefore);
    });

    it('a status flip between the read and the write leaves the invite untouched and reports the new status', async () => {
      for (const act of [deletePlayerInvite, regeneratePlayerInviteLink]) {
        mocks.state.playerInvitesStore = [];
        const created = await makeInvite();
        const hashBefore = byId(created.inviteId).tokenHash;
        const realUpdate = mocks.mockDb.update.getMockImplementation()!;
        const realDelete = mocks.mockDb.delete.getMockImplementation()!;
        // A manager's submission lands after the action's status read but before its write.
        const flip = () => {
          byId(created.inviteId).status = 'submitted';
        };
        // Only the write the action under test performs is intercepted; an unused one-shot would leak.
        if (act === deletePlayerInvite) {
          mocks.mockDb.delete.mockImplementationOnce((tbl: any) => (flip(), realDelete(tbl)));
        } else {
          mocks.mockDb.update.mockImplementationOnce((tbl: any) => (flip(), realUpdate(tbl)));
        }

        const result = await act(created.inviteId);
        expect(result).toEqual({ success: false, error: expect.stringMatching(/Only pending invites/), status: 'submitted' });
        expect(byId(created.inviteId)).toBeDefined();
        expect(byId(created.inviteId).tokenHash).toBe(hashBefore);
      }
    });

    it('refuses an invite belonging to another school and leaves it untouched', async () => {
      mocks.state.playerInvitesStore.push({
        id: 'foreign-invite',
        schoolId: otherSchoolId,
        gameId: valGameId,
        tokenHash: 'h',
        status: 'pending',
        intendedFirstName: 'A',
        intendedLastName: 'B',
        expiresAt: new Date(Date.now() + 1000),
      });
      for (const result of [await deletePlayerInvite('foreign-invite'), await regeneratePlayerInviteLink('foreign-invite')]) {
        expect(result).toMatchObject({ success: false, status: 'forbidden', error: expect.stringMatching(/Forbidden/) });
      }
      expect(byId('foreign-invite').tokenHash).toBe('h');
    });

    it('refuses an invite for a game outside the manager scope', async () => {
      mocks.state.playerInvitesStore.push({
        id: 'lol-invite',
        schoolId,
        gameId: lolGameId,
        tokenHash: 'h2',
        status: 'pending',
        intendedFirstName: 'A',
        intendedLastName: 'B',
        expiresAt: new Date(Date.now() + 1000),
      });
      expect(await deletePlayerInvite('lol-invite')).toMatchObject({ success: false, status: 'forbidden' });
      expect(byId('lol-invite')).toBeDefined();
    });

    it('refuses an unknown invite and an unauthenticated caller', async () => {
      const created = await makeInvite();
      expect(await deletePlayerInvite('missing')).toMatchObject({ success: false, status: null, error: expect.stringMatching(/not found/i) });
      mocks.setClaims(null);
      expect(await regeneratePlayerInviteLink(created.inviteId)).toMatchObject({
        success: false,
        status: 'forbidden',
        error: expect.stringMatching(/Unauthorized/),
      });
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
        seasonId: 'season-fall-26',
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
        seasonId: 'season-fall-26',
        memberId,
        intendedFirstName: 'Tyler',
        intendedLastName: 'Vance',
        status: 'submitted',
        tokenHash: 'hash-tyler',
        expiresAt: new Date('2026-10-07'),
      });
    });

    it('approving an application only accepts the student: no roster is chosen or written', async () => {
      const result = await reviewPlayerInvite({ inviteId, action: 'approve' });

      if (!result.success) throw new Error(result.error);
      expect(result.status).toBe('accepted');

      const invite = mocks.state.playerInvitesStore.find((i) => i.id === inviteId);
      expect(invite.status).toBe('accepted');
      expect(invite.reviewedAt).toBeInstanceOf(Date);
      expect(mocks.state.playersStore.find((p) => p.memberId === memberId)).toBeUndefined();
    });

    it('an accepted student can then be enrolled onto the roster the manager picks', async () => {
      await reviewPlayerInvite({ inviteId, action: 'approve' });
      const enrolled = await enrollPlayerToRoster({ rosterId: 'roster-varsity-val', memberId });
      expect(enrolled).toMatchObject({ success: true });

      const playerRecord = mocks.state.playersStore.find(
        (p) => p.rosterId === 'roster-varsity-val' && p.memberId === memberId
      );
      expect(playerRecord).toBeDefined();
      expect(playerRecord.role).toBe('player');
      expect(playerRecord.ign).toBe('Tyler#NA1');
      expect(playerRecord.isCaptain).toBe(false);
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'teams');
    });

    it('rejecting an application sets status to rejected with reason and does not create player', async () => {
      const result = await reviewPlayerInvite({
        inviteId,
        action: 'reject',
        rejectionReason: 'Invalid school attendance record',
      });

      if (!result.success) throw new Error(result.error);
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

    it('a full roster (10 players, 5 subs) is still eligible: eligibility has no maximum', async () => {
      setupRosterWithPlayers({ totalCount: 10, captainCount: 1, subCount: 5 });

      const gate = await getRosterEligibility({ rosterId });

      expect(gate.eligible).toBe(true);
      expect(gate.reasons).toEqual([]);
      expect(gate.stats.totalPlayers).toBe(10);
      expect(gate.stats.subsCount).toBe(5);
      expect(gate.gateChecks).toEqual({ minSize: true, singleCaptain: true, riotLinked: true, discordLinked: true, inGuild: true });
    });

    it('an over-the-cap roster (12 players, 7 subs) gets no max-based reason either', async () => {
      setupRosterWithPlayers({ totalCount: 12, captainCount: 1, subCount: 7 });

      const gate = await getRosterEligibility({ rosterId });

      expect(gate.eligible).toBe(true);
      expect(gate.reasons.join(' ')).not.toMatch(/maximum|at most|more than|too many|exceed|full|cap\b/i);
    });

    it('getRosterEligibility does not reference the roster size limits (so nobody adds a maximum by accident)', () => {
      const source = readFileSync(new URL('../portal-actions.ts', import.meta.url), 'utf8');
      const start = source.indexOf('export async function getRosterEligibility');
      const end = source.indexOf('export interface EmergencySwapSubParams');
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      const body = source.slice(start, end);
      expect(body).not.toMatch(/MAX_ROSTER|roster-limits|rosterCapacityError|moveBlockedReason/);
      expect(body).toContain('totalPlayers >= 5');
    });

    it('passes Gate 1 with the bare minimum: 5 starters and no substitutes', async () => {
      // 5 starters (one captain), 0 subs
      setupRosterWithPlayers({ totalCount: 5, captainCount: 1, subCount: 0 });

      const gate = await getRosterEligibility({ rosterId });
      expect(gate.gateChecks.minSize).toBe(true);
      expect(gate.reasons.some((r) => /substitute|at least 5 players|starters/.test(r))).toBe(false);
      expect(gate.eligible).toBe(true);
    });

    it('fails Gate 1 if the roster has fewer than 5 starters, even with a substitute', async () => {
      // 4 starters + 1 sub: five players in total, but only four of them start
      setupRosterWithPlayers({ totalCount: 5, captainCount: 1, subCount: 1 });

      const gate = await getRosterEligibility({ rosterId });
      expect(gate.eligible).toBe(false);
      expect(gate.gateChecks.minSize).toBe(false);
      expect(gate.stats.startersCount).toBe(4);
      expect(gate.reasons).toContain('Roster must have at least 5 starters (currently 4)');
    });

    it('fails Gate 1 with fewer than 5 players in total', async () => {
      setupRosterWithPlayers({ totalCount: 4, captainCount: 1, subCount: 0 });

      const gate = await getRosterEligibility({ rosterId });
      expect(gate.eligible).toBe(false);
      expect(gate.reasons).toContain('Roster size must be at least 5 players (currently 4)');
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

  /**
   * Gives every member in the store an accepted application for the Valorant game and its active
   * 2026-27 season, which is what a manager needs before enrolling them (spec-047). Tests of the
   * rule itself seed applications explicitly instead.
   */
  const acceptAllMembers = (seasonId = 'season-val-now') => {
    for (const m of mocks.state.membersStore) {
      if (mocks.state.playerInvitesStore.some((i) => i.id === `acc-${m.id}`)) continue;
      mocks.state.playerInvitesStore.push({
        id: `acc-${m.id}`, schoolId: m.schoolId, gameId: valGameId, seasonId, memberId: m.id,
        intendedFirstName: 'A', intendedLastName: 'B', status: 'accepted', tokenHash: `acc-${m.id}`, expiresAt: new Date('2027-01-01'),
      });
    }
  };

  describe('7. Direct Roster Enrollment & Player Pool Management', () => {
    const teamId = 'team-val-stuy';
    const rosterId = 'roster-val-varsity';
    const memberId = 'member-new-stuy';
    const otherSchoolMemberId = 'member-bxsci-1';

    beforeEach(() => {
      mocks.state.schoolManagersStore = [
        {
          id: 'sm-1',
          academicYear: '2026-27',
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
          seasonId: 'season-fall-26',
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
          graduationYear: 2027,
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
          graduationYear: 2027,
        },
      ];
      acceptAllMembers('season-fall-26');

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

      if (!result.success) throw new Error(result.error);
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

      if (!result.success) throw new Error(result.error);
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
      if (!result.success) throw new Error(result.error);
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
      expect(result.studentRecord).toBe('kept');
      expect(result.message).toContain('Their student record was kept because they are still on another roster');
    });

    it('removePlayerFromRoster runs the shared cleanup in a transaction and reports a deleted student record', async () => {
      const { removePlayerFromRosterTx } = await import('@/app/lib/db/roster-removal');
      mocks.state.removalDeletesMember = true;
      mocks.mockDb.transaction.mockClear();
      const result = await removePlayerFromRoster({ rosterId, playerId: 'player-cap' });
      expect(mocks.mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(removePlayerFromRosterTx).toHaveBeenLastCalledWith(expect.anything(), { playerId: 'player-cap', rosterId });
      expect(result).toMatchObject({ success: true, studentRecord: 'deleted' });
      expect(result.message).toContain('onboarding record was deleted');
      // members joins the tags only because a member record was deleted
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'members', 'teams');
      mocks.state.removalDeletesMember = false;
    });

    it('removePlayerFromRoster for a missing row reports unchanged and refreshes nothing about members', async () => {
      const result = await removePlayerFromRoster({ rosterId, playerId: 'no-such-player' });
      expect(result).toMatchObject({ success: true, studentRecord: 'unchanged' });
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

    it('creates a new competition roster when team and active season already exist', async () => {
      const res = await createSchoolRoster({
        schoolId,
        gameId: valGameId,
        name: 'Junior Varsity',
        division: 'B',
      });

      expect(res.success).toBe(true);
      expect(res.roster.name).toBe('Junior Varsity');
      expect(res.roster.division).toBe('B');
      expect(res.roster.gameId).toBe(valGameId);
      expect(res.roster.players).toEqual([]);

      const created = mocks.state.rostersStore.find((r) => r.id === res.roster.id);
      expect(created).toBeDefined();
      expect(created.name).toBe('Junior Varsity');
      expect(created.division).toBe('B');
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'teams');
    });

    it('creates team and roster atomically when team does not exist for the school', async () => {
      // Clear teams for lol
      mocks.state.teamsStore = mocks.state.teamsStore.filter((t) => t.gameId !== lolGameId);

      const res = await createSchoolRoster({
        schoolId,
        gameId: lolGameId,
        name: 'LoL Varsity',
        division: 'A',
      });

      expect(res.success).toBe(true);
      expect(res.roster.name).toBe('LoL Varsity');

      const teamCreated = mocks.state.teamsStore.find((t) => t.schoolId === schoolId && t.gameId === lolGameId);
      expect(teamCreated).toBeDefined();
    });

    it('refuses to create a roster when the game has no season named like the affiliation (no auto-provisioning)', async () => {
      mocks.state.seasonsStore = [];
      mocks.state.teamsStore = mocks.state.teamsStore.filter(
        (t) => !(t.schoolId === schoolId && t.gameId === valGameId)
      );

      await expect(
        createSchoolRoster({ schoolId, gameId: valGameId, name: 'Alpha Team', division: 'A' })
      ).rejects.toThrow(/season for this game does not exist/);

      expect(mocks.state.seasonsStore).toHaveLength(0);
      expect(mocks.state.teamsStore.some((t) => t.schoolId === schoolId && t.gameId === valGameId)).toBe(false);
    });

    it('does not fall back to another season when the affiliation season does not exist', async () => {
      // The manager is 2026-27; only an older (inactive) and a newer (active) season exist.
      mocks.state.seasonsStore = [
        { id: 'season-old', gameId: valGameId, name: '2025-26', isActive: false },
        { id: 'season-new', gameId: valGameId, name: '2027-28', isActive: true },
      ];
      await expect(
        createSchoolRoster({ schoolId, gameId: valGameId, name: 'Alpha Team' })
      ).rejects.toThrow(/season for this game does not exist/);
    });

    it('refuses to create in an inactive season even when it is newer than the active one (view-only, spec-028)', async () => {
      mocks.state.seasonsStore = [
        { id: 'season-25', gameId: valGameId, name: '2025-26', isActive: true },
        { id: 'season-26', gameId: valGameId, name: '2026-27', isActive: false },
      ];
      mocks.state.teamsStore = [];
      await expect(
        createSchoolRoster({ schoolId, gameId: valGameId, name: 'Alpha Team' })
      ).rejects.toThrow(/2026-27 is an inactive season and is view-only/);
      expect(mocks.state.teamsStore).toHaveLength(0);
    });

    it('rejects roster creation if user does not manage the target school (Anti-IDOR / Tenancy check)', async () => {
      await expect(
        createSchoolRoster({
          schoolId: otherSchoolId,
          gameId: valGameId,
          name: 'Bronx Science Varsity',
        })
      ).rejects.toThrow(/Forbidden/);
    });

    it('rejects roster creation with empty or whitespace-only name', async () => {
      await expect(
        createSchoolRoster({
          schoolId,
          gameId: valGameId,
          name: '   ',
        })
      ).rejects.toThrow(/Roster name is required/);
    });

    it('deletes an empty roster via deleteSchoolRoster', async () => {
      // Ensure team exists
      if (!mocks.state.teamsStore.some((t) => t.id === 'team-stuy-val-uuid')) {
        mocks.state.teamsStore.push({
          id: 'team-stuy-val-uuid',
          schoolId,
          gameId: valGameId,
          seasonId: 'season-fall-26',
        });
      }

      // Create empty roster
      const emptyRosterId = 'empty-roster-to-delete';
      mocks.state.rostersStore.push({
        id: emptyRosterId,
        teamId: 'team-stuy-val-uuid',
        name: 'Temp Roster',
        division: 'Open',
      });

      const res = await deleteSchoolRoster(emptyRosterId);
      expect(res.success).toBe(true);
      expect(res.rosterId).toBe(emptyRosterId);

      const found = mocks.state.rostersStore.find((r) => r.id === emptyRosterId);
      expect(found).toBeUndefined();
    });

    it('refuses to delete a roster that has enrolled players', async () => {
      if (!mocks.state.teamsStore.some((t) => t.id === 'team-stuy-val-uuid')) {
        mocks.state.teamsStore.push({
          id: 'team-stuy-val-uuid',
          schoolId,
          gameId: valGameId,
          seasonId: 'season-fall-26',
        });
      }

      await expect(deleteSchoolRoster(rosterId)).rejects.toThrow(
        /Cannot delete a roster with enrolled players/
      );
    });
  });
  describe('8. Season scoping (a manager works in the season named by their affiliation, active or not)', () => {
    const rosterPast = 'roster-val-past';
    const rosterActive = 'roster-val-active';

    beforeEach(() => {
      mocks.state.seasonsStore = [
        { id: 'season-val-past', gameId: valGameId, name: '2025-26', isActive: false },
        { id: 'season-val-now', gameId: valGameId, name: '2026-27', isActive: true },
        { id: 'season-lol-now', gameId: lolGameId, name: '2026-27', isActive: true },
      ];
      mocks.state.schoolManagersStore = [
        {
          id: 'mgr-1',
          schoolId,
          userId: 'manager-user-1',
          managedGames: null,
          academicYear: '2026-27',
          isPrimaryContact: true,
          isActive: true,
        },
      ];
      mocks.state.teamsStore = [
        { id: 'team-past', schoolId, gameId: valGameId, seasonId: 'season-val-past' },
        { id: 'team-now', schoolId, gameId: valGameId, seasonId: 'season-val-now' },
      ];
      mocks.state.rostersStore = [
        { id: rosterPast, teamId: 'team-past', name: 'Old Varsity', division: 'A' },
        { id: rosterActive, teamId: 'team-now', name: 'Varsity', division: 'A' },
      ];
      mocks.state.membersStore = [
        { id: 'member-1', schoolId, firstName: 'Ana', lastName: 'Lee', discord: 'ana', graduationYear: 2027, createdAt: new Date() },
      ];
      mocks.state.playersStore = [
        { id: 'pl-past', rosterId: rosterPast, memberId: 'member-1', role: 'player', isCaptain: false, ign: 'a' },
        { id: 'pl-now', rosterId: rosterActive, memberId: 'member-1', role: 'player', isCaptain: false, ign: 'a' },
      ];
    });

    const pointManagerAt = (year: string) => {
      mocks.state.schoolManagersStore[0].academicYear = year;
    };

    it('resolveManagerSeason: matches by name only, covers the game, ignores is_active, newest name wins', () => {
      const game = { id: valGameId, slug: 'valorant' };
      const seasons = [{ name: '2024-25' }, { name: '2025-26' }, { name: '2026-27' }];
      const all = (y: string) => [{ academicYear: y, managedGames: null }];
      expect(resolveManagerSeason(all('2026-27'), game, seasons)).toEqual({ name: '2026-27' });
      expect(resolveManagerSeason([{ academicYear: '2026-27', managedGames: ['valorant'] }], game, seasons)).toEqual({ name: '2026-27' });
      expect(resolveManagerSeason([{ academicYear: '2026-27', managedGames: [valGameId] }], game, seasons)).toEqual({ name: '2026-27' });
      // An older name resolves even though a newer season exists.
      expect(resolveManagerSeason(all('2025-26'), game, seasons)).toEqual({ name: '2025-26' });
      // No season with that name, a row for another game, or no seasons at all -> null.
      expect(resolveManagerSeason(all('2030-31'), game, seasons)).toBeNull();
      expect(resolveManagerSeason([{ academicYear: '2026-27', managedGames: ['league-of-legends'] }], game, seasons)).toBeNull();
      expect(resolveManagerSeason(all('2026-27'), game, [])).toBeNull();
      // Several matching rows/seasons: the newest by name, whatever the input order.
      expect(
        resolveManagerSeason(
          [
            { academicYear: '2025-26', managedGames: null },
            { academicYear: '2026-27', managedGames: ['valorant'] },
            { academicYear: '2024-25', managedGames: ['league-of-legends'] },
          ],
          game,
          [{ name: '2026-27' }, { name: '2024-25' }, { name: '2025-26' }]
        )
      ).toEqual({ name: '2026-27' });
    });

    it('getSchoolRosters returns only the resolved season rosters for a manager', async () => {
      const rosters = await getSchoolRosters(schoolId);
      expect(rosters.map((r) => r.id)).toEqual([rosterActive]);
      expect(rosters[0].seasonName).toBe('2026-27');
    });

    it('a staff admin who also holds a manager row sees every season (unchanged)', async () => {
      mocks.state.rolesStore.push({
        id: 'role-admin',
        name: 'Admin',
        permissions: Permissions.ADMINISTRATOR,
        position: 5,
        isOwner: false,
      });
      mocks.state.userRolesStore = [{ userId: 'manager-user-1', roleId: 'role-admin' }];
      pointManagerAt('2030-31'); // a row that matches no season must not matter to an admin

      const context = await getSchoolManagerContext();
      expect(context?.isStaffAdmin).toBe(true);
      expect(await getAuthorizedGameScopes(context!, schoolId)).toBeNull();

      const rosters = await getSchoolRosters(schoolId);
      expect(rosters.map((r) => r.id).sort()).toEqual([rosterActive, rosterPast].sort());
      await expect(removePlayerFromRoster({ rosterId: rosterPast, playerId: 'pl-past' })).resolves.toMatchObject({
        success: true,
      });
    });

    it('an inactive season NEWER than the active one is visible but view-only when its name matches the affiliation', async () => {
      // The newer season is inactive and the older one is active: the manager's 2026-27 is newer than the active one.
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-past').isActive = true;
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-now').isActive = false;
      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes!.find((s) => s.gameId === valGameId)).toMatchObject({
        seasonId: 'season-val-now', seasonIsActive: false, readOnly: true,
        readOnlyReason: '2026-27 is an inactive season and is view-only.',
      });
      expect((await getSchoolRosters(schoolId)).map((r) => r.id)).toEqual([rosterActive]);
      const viewOnly = /2026-27 is an inactive season and is view-only/;
      await expect(updateRosterPlayerRole({ rosterId: rosterActive, playerId: 'pl-now', role: 'sub' })).rejects.toThrow(viewOnly);
      await expect(createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' })).rejects.toThrow(viewOnly);
    });

    it('a PAST INACTIVE season is visible when its name matches the affiliation but view-only (spec-028)', async () => {
      pointManagerAt('2025-26'); // the older season, which is not active, and a newer one exists

      const context = (await getSchoolManagerContext())!;
      const scopes = await getAuthorizedGameScopes(context, schoolId);
      expect(scopes).toEqual([
        expect.objectContaining({ gameId: valGameId, seasonId: 'season-val-past', seasonName: '2025-26', seasonIsActive: false }),
      ]);

      expect((await getSchoolRosters(schoolId)).map((r) => r.id)).toEqual([rosterPast]);
      expect((await getSchoolRosters(schoolId, valGameId)).map((r) => r.id)).toEqual([rosterPast]);
      const pool = await getSchoolPlayerPool(schoolId);
      expect(pool[0].enrolledRosters.map((r) => r.rosterId)).toEqual([rosterPast]);

      await expect(getRosterEligibility({ rosterId: rosterPast })).resolves.toBeDefined();
      const viewOnly = /2025-26 is an inactive season and is view-only/;
      await expect(updateRosterPlayerRole({ rosterId: rosterPast, playerId: 'pl-past', role: 'sub' })).rejects.toThrow(viewOnly);
      await expect(removePlayerFromRoster({ rosterId: rosterPast, playerId: 'pl-past' })).rejects.toThrow(viewOnly);
      await expect(createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' })).rejects.toThrow(viewOnly);

      // ...but the (active) newest season is now another season's data and is refused.
      const msg = /different season/;
      await expect(deleteSchoolRoster(rosterActive)).rejects.toThrow(msg);
      await expect(updateRosterPlayerRole({ rosterId: rosterActive, playerId: 'pl-now', role: 'sub' })).rejects.toThrow(msg);
      await expect(enrollPlayerToRoster({ rosterId: rosterActive, memberId: 'member-1' })).rejects.toThrow(msg);
      await expect(getRosterEligibility({ rosterId: rosterActive })).rejects.toThrow(msg);
      await expect(emergencySwapSub({ rosterId: rosterActive, outPlayerId: 'a', inPlayerId: 'b' })).rejects.toThrow(msg);
      expect(mocks.state.playersStore.some((p) => p.id === 'pl-now' && p.role === 'player')).toBe(true);
      expect(mocks.state.playersStore.some((p) => p.id === 'pl-past')).toBe(true);
    });

    it('createSchoolRoster creates in the resolved (active) season of the manager, never another one', async () => {
      mocks.state.teamsStore = [];
      const res = await createSchoolRoster({ schoolId, gameId: valGameId, name: 'Alumni' });
      expect(res.success).toBe(true);
      const team = mocks.state.teamsStore.find((t) => t.schoolId === schoolId && t.gameId === valGameId);
      expect(team?.seasonId).toBe('season-val-now');
    });

    it('invite approval accepts the student without rostering them; they are then enrolled in the resolved (active) season', async () => {
      mocks.state.playersStore = [];
      mocks.state.membersStore.push({ id: 'm-inv', schoolId, firstName: 'In', lastName: 'Vite', discord: 'in#1', graduationYear: 2027 });
      mocks.state.playerInvitesStore = [
        { id: 'inv-1', schoolId, gameId: valGameId, seasonId: 'season-val-now', memberId: 'm-inv', intendedFirstName: 'In', intendedLastName: 'Vite', status: 'submitted', tokenHash: 'h', expiresAt: new Date('2027-01-01') },
      ];
      await expect(reviewPlayerInvite({ inviteId: 'inv-1', action: 'approve' })).resolves.toMatchObject({ success: true, status: 'accepted' });
      expect(mocks.state.playersStore.find((p) => p.memberId === 'm-inv')).toBeUndefined();
      await expect(enrollPlayerToRoster({ rosterId: rosterActive, memberId: 'm-inv' })).resolves.toMatchObject({ success: true });
      expect(mocks.state.playersStore.find((p) => p.memberId === 'm-inv')?.rosterId).toBe(rosterActive);
    });

    it('a manager whose affiliation year matches no season of the game sees nothing and is refused', async () => {
      pointManagerAt('2030-31');

      expect(await getSchoolRosters(schoolId)).toEqual([]);
      expect(await getSchoolPlayerPool(schoolId)).toEqual([]);
      expect(await getSchoolInvites(schoolId)).toEqual([]);
      expect(await getPendingSubmissions(schoolId)).toEqual([]);
      const none = /season for this game does not exist/;
      await expect(getSchoolRosters(schoolId, valGameId)).rejects.toThrow(none);
      await expect(createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' })).rejects.toThrow(none);
      await expect(createSchoolRoster({ schoolId, gameId: valGameId, name: 'Nope' })).rejects.toThrow(none);
      await expect(removePlayerFromRoster({ rosterId: rosterActive, playerId: 'pl-now' })).rejects.toThrow(none);
      await expect(deleteSchoolRoster(rosterPast)).rejects.toThrow(none);
      expect(mocks.state.teamsStore).toHaveLength(2);
    });

    it('a game with no seasons at all is empty and refuses mutations', async () => {
      mocks.state.seasonsStore = mocks.state.seasonsStore.filter((s) => s.gameId !== valGameId);

      expect(await getSchoolRosters(schoolId)).toEqual([]);
      await expect(getSchoolRosters(schoolId, valGameId)).rejects.toThrow(/season for this game does not exist/);
      await expect(deleteSchoolRoster(rosterActive)).rejects.toThrow(/season for this game does not exist/);
    });

    it('with no season anywhere the manager scopes are empty', async () => {
      mocks.state.seasonsStore = [];
      expect(await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId)).toEqual([]);
    });

    it('scopes per game: a matching Valorant season does not unlock League of Legends', async () => {
      // LoL has no season named like the manager's affiliation.
      mocks.state.seasonsStore.find((s) => s.id === 'season-lol-now').name = '2027-28';
      mocks.state.teamsStore.push({ id: 'team-lol', schoolId, gameId: lolGameId, seasonId: 'season-lol-now' });
      mocks.state.rostersStore.push({ id: 'roster-lol', teamId: 'team-lol', name: 'LoL', division: 'A' });

      const rosters = await getSchoolRosters(schoolId);
      expect(rosters.map((r) => r.id)).toEqual([rosterActive]);
      await expect(getSchoolRosters(schoolId, lolGameId)).rejects.toThrow(/season for this game does not exist/);
      await expect(deleteSchoolRoster('roster-lol')).rejects.toThrow(/season for this game does not exist/);
    });

    it('a row that does not cover the game is Forbidden for it even if a season with that name exists', async () => {
      mocks.state.schoolManagersStore[0].managedGames = ['valorant'];
      await expect(getSchoolRosters(schoolId, lolGameId)).rejects.toThrow(/Forbidden/);
      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes!.map((s) => s.gameSlug)).toEqual(['valorant']);
    });

    it('a manager row for another school grants nothing at this school', async () => {
      mocks.state.schoolManagersStore[0].schoolId = otherSchoolId;
      await expect(getSchoolRosters(schoolId)).rejects.toThrow(/Forbidden/);
      await expect(deleteSchoolRoster(rosterActive)).rejects.toThrow(/Forbidden/);
      await expect(createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' })).rejects.toThrow(/Forbidden/);
    });

    it('a roster of another school is refused even in the manager\'s season (anti-IDOR tracing)', async () => {
      mocks.state.teamsStore.push({ id: 'team-other', schoolId: otherSchoolId, gameId: valGameId, seasonId: 'season-val-now' });
      mocks.state.rostersStore.push({ id: 'roster-other', teamId: 'team-other', name: 'Other', division: 'A' });
      await expect(deleteSchoolRoster('roster-other')).rejects.toThrow(/Forbidden/);
    });

    it('two rows matching two seasons of the same game resolve to the newest by name', async () => {
      mocks.state.schoolManagersStore.push({
        id: 'mgr-2',
        schoolId,
        userId: 'manager-user-1',
        managedGames: null,
        academicYear: '2025-26',
        isPrimaryContact: false,
        isActive: true,
      });
      const rosters = await getSchoolRosters(schoolId);
      expect(rosters.map((r) => r.id)).toEqual([rosterActive]);
      // The older season's roster is not reachable while the newer one resolves.
      await expect(deleteSchoolRoster(rosterPast)).rejects.toThrow(/different season/);
    });

    it('newest wins even when the newest matching season is the inactive one', async () => {
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-now').isActive = false;
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-past').isActive = true;
      const rosters = await getSchoolRosters(schoolId);
      expect(rosters.map((r) => r.id)).toEqual([rosterActive]);
      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes![0]).toMatchObject({ seasonId: 'season-val-now', seasonIsActive: false });
    });

    it('allows the same mutations on the resolved-season roster', async () => {
      const res = await updateRosterPlayerRole({ rosterId: rosterActive, playerId: 'pl-now', role: 'sub' });
      expect(res.success).toBe(true);
    });

    it('the player pool only lists enrollments from the resolved season', async () => {
      const pool = await getSchoolPlayerPool(schoolId);
      expect(pool).toHaveLength(1);
      expect(pool[0].enrolledRosters.map((r) => r.rosterId)).toEqual([rosterActive]);
    });

    it('a role-less staff_members row does not grant the staff-admin bypass or an all-season view', async () => {
      mocks.state.staffMembersStore = [{ userId: 'manager-user-1', email: 'coach@stuy.edu' }];
      pointManagerAt('2030-31');

      const context = await getSchoolManagerContext();
      expect(context?.isStaffAdmin).toBe(false);
      expect(await getSchoolRosters(schoolId)).toEqual([]);
      await expect(deleteSchoolRoster(rosterActive)).rejects.toThrow(/season for this game does not exist/);

      // With a matching year it still sees only its own season, not every season.
      pointManagerAt('2026-27');
      expect((await getSchoolRosters(schoolId)).map((r) => r.id)).toEqual([rosterActive]);
      await expect(deleteSchoolRoster(rosterPast)).rejects.toThrow(/different season/);
    });

    it('ignores inactive manager rows and soft-deleted schools', async () => {
      mocks.state.schoolManagersStore[0].isActive = false;
      expect(await getSchoolManagerContext()).toBeNull();

      mocks.state.schoolManagersStore[0].isActive = true;
      mocks.state.schoolsStore[0].deletedAt = new Date();
      expect(await getSchoolManagerContext()).toBeNull();
      await expect(getSchoolRosters(schoolId)).rejects.toThrow('Unauthorized');
    });

    it('refuses emergencySwapSub and getRosterEligibility individually on another season\'s roster', async () => {
      await expect(
        emergencySwapSub({ rosterId: rosterPast, outPlayerId: 'a', inPlayerId: 'b' })
      ).rejects.toThrow(/different season/);
      await expect(getRosterEligibility({ rosterId: rosterPast })).rejects.toThrow(/different season/);
    });

    it('limits invites and pending submissions to games the manager currently manages', async () => {
      // LoL has no season named like the manager's affiliation.
      mocks.state.seasonsStore.find((s) => s.id === 'season-lol-now').name = '2027-28';
      const base = { schoolId, status: 'submitted', submissionDraft: {}, memberId: null, expiresAt: new Date(), createdAt: new Date(), submittedAt: new Date() };
      mocks.state.playerInvitesStore = [
        { ...base, id: 'inv-val', gameId: valGameId, seasonId: 'season-val-now', intendedFirstName: 'V', intendedLastName: 'Al' },
        { ...base, id: 'inv-lol', gameId: lolGameId, seasonId: 'season-lol-now', intendedFirstName: 'L', intendedLastName: 'Ol' },
        { ...base, id: 'inv-null', gameId: null, intendedFirstName: 'N', intendedLastName: 'Ull' },
      ];

      expect((await getSchoolInvites(schoolId)).map((i) => i.id)).toEqual(['inv-val']);
      expect((await getPendingSubmissions(schoolId)).map((i) => i.id)).toEqual(['inv-val']);
    });

    it('refuses a manager reviewing an invite with no game, but lets a staff admin', async () => {
      mocks.state.playerInvitesStore = [
        { id: 'inv-null', schoolId, gameId: null, status: 'submitted', memberId: null, intendedFirstName: 'N', intendedLastName: 'Ull', submissionDraft: {} },
      ];
      await expect(reviewPlayerInvite({ inviteId: 'inv-null', action: 'reject' })).rejects.toThrow(/Forbidden/);
      expect(mocks.state.playerInvitesStore[0].status).toBe('submitted');

      mocks.state.rolesStore.push({ id: 'role-admin', name: 'Admin', permissions: Permissions.ADMINISTRATOR, position: 5, isOwner: false });
      mocks.state.userRolesStore = [{ userId: 'manager-user-1', roleId: 'role-admin' }];
      await expect(reviewPlayerInvite({ inviteId: 'inv-null', action: 'reject' })).resolves.toMatchObject({ success: true });
    });

    it('resolveRequestedGameId ignores a game outside the manager scopes but keeps it for staff admins', async () => {
      const scopes = await getAuthorizedGameScopes(
        (await getSchoolManagerContext())!,
        schoolId
      );
      expect(resolveRequestedGameId(scopes, valGameId)).toBe(valGameId);
      expect(resolveRequestedGameId(scopes, 'game-stale')).toBeUndefined();
      expect(resolveRequestedGameId(scopes, undefined)).toBeUndefined();
      expect(resolveRequestedGameId(null, 'anything')).toBe('anything');
    });
  });

  describe('9. Season roster lock (staff lock, managers refused, staff admins exempt)', () => {
    const LOCKED = /locked by EZ Esports staff/;
    const rosterId = 'roster-lock-val';
    const emptyRosterId = 'roster-lock-empty';
    const lolRosterId = 'roster-lock-lol';

    const lockSeason = (id: string) => {
      mocks.state.seasonsStore.find((s) => s.id === id).rostersLockedAt = new Date();
    };
    const unlockSeason = (id: string) => {
      mocks.state.seasonsStore.find((s) => s.id === id).rostersLockedAt = null;
    };
    const makeAdmin = () => {
      mocks.state.rolesStore.push({ id: 'role-admin', name: 'Admin', permissions: Permissions.ADMINISTRATOR, position: 5, isOwner: false });
      mocks.state.userRolesStore = [{ userId: 'manager-user-1', roleId: 'role-admin' }];
    };

    beforeEach(() => {
      mocks.state.seasonsStore = [
        { id: 'season-val-now', gameId: valGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
        { id: 'season-lol-now', gameId: lolGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
      ];
      mocks.state.schoolManagersStore = [
        { id: 'mgr-1', schoolId, userId: 'manager-user-1', managedGames: null, academicYear: '2026-27', isPrimaryContact: true, isActive: true },
      ];
      mocks.state.teamsStore = [
        { id: 'team-val', schoolId, gameId: valGameId, seasonId: 'season-val-now' },
        { id: 'team-lol', schoolId, gameId: lolGameId, seasonId: 'season-lol-now' },
      ];
      mocks.state.rostersStore = [
        { id: rosterId, teamId: 'team-val', name: 'Varsity', division: 'A' },
        { id: emptyRosterId, teamId: 'team-val', name: 'Empty', division: 'B' },
        { id: lolRosterId, teamId: 'team-lol', name: 'LoL Varsity', division: 'A' },
      ];
      mocks.state.membersStore = [
        { id: 'm-new', schoolId, firstName: 'New', lastName: 'Kid', discord: 'new#1', graduationYear: 2027 },
        { id: 'm-starter', schoolId, firstName: 'St', lastName: 'Arter', discord: 'st#1', graduationYear: 2027 },
        { id: 'm-sub', schoolId, firstName: 'Su', lastName: 'B', discord: 'su#1', graduationYear: 2027 },
      ];
      mocks.state.playersStore = [
        { id: 'pl-starter', rosterId, memberId: 'm-starter', role: 'player', isCaptain: false, ign: 'St#1' },
        { id: 'pl-sub', rosterId, memberId: 'm-sub', role: 'sub', isCaptain: false, ign: 'Su#1' },
        { id: 'pl-lol', rosterId: lolRosterId, memberId: 'm-starter', role: 'player', isCaptain: false, ign: 'St#1' },
      ];
      mocks.state.playerInvitesStore = [];
      acceptAllMembers();
    });

    const attempts: Array<[string, () => Promise<unknown>]> = [
      ['createSchoolRoster', () => createSchoolRoster({ schoolId, gameId: valGameId, name: 'JV' })],
      ['deleteSchoolRoster', () => deleteSchoolRoster(emptyRosterId)],
      ['enrollPlayerToRoster', () => enrollPlayerToRoster({ rosterId, memberId: 'm-new' })],
      ['removePlayerFromRoster', () => removePlayerFromRoster({ rosterId, playerId: 'pl-sub' })],
      ['updateRosterPlayerRole', () => updateRosterPlayerRole({ rosterId, playerId: 'pl-starter', role: 'sub' })],
      ['emergencySwapSub', () => emergencySwapSub({ rosterId, outPlayerId: 'pl-starter', inPlayerId: 'pl-sub' })],
    ];

    it.each(attempts)('%s is refused for a manager while the season is locked, with no write', async (_name, run) => {
      lockSeason('season-val-now');
      const before = JSON.stringify([mocks.state.playersStore, mocks.state.rostersStore]);
      await expect(run()).rejects.toThrow(LOCKED);
      expect(JSON.stringify([mocks.state.playersStore, mocks.state.rostersStore])).toBe(before);
    });

    it.each(attempts)('%s works for a manager while the season is unlocked', async (_name, run) => {
      await expect(run()).resolves.toMatchObject({ success: true });
    });

    it('unlocking restores manager access', async () => {
      lockSeason('season-val-now');
      await expect(deleteSchoolRoster(emptyRosterId)).rejects.toThrow(LOCKED);
      unlockSeason('season-val-now');
      await expect(deleteSchoolRoster(emptyRosterId)).resolves.toMatchObject({ success: true });
    });

    it('a staff admin (even holding a manager row) can still edit locked rosters', async () => {
      makeAdmin();
      lockSeason('season-val-now');
      const seed = JSON.parse(JSON.stringify(mocks.state.playersStore));
      for (const [, run] of attempts) {
        // Each attempt is independent: earlier ones remove or re-role the players later ones use.
        mocks.state.playersStore = JSON.parse(JSON.stringify(seed));
        await expect(run()).resolves.toMatchObject({ success: true });
      }
    });

    it('locking one game does not affect another game', async () => {
      lockSeason('season-val-now');
      await expect(
        updateRosterPlayerRole({ rosterId: lolRosterId, playerId: 'pl-lol', role: 'sub' })
      ).resolves.toMatchObject({ success: true });
      await expect(createSchoolRoster({ schoolId, gameId: lolGameId, name: 'JV' })).resolves.toMatchObject({ success: true });
      await expect(createSchoolRoster({ schoolId, gameId: valGameId, name: 'JV' })).rejects.toThrow(LOCKED);
    });

    it('the lock applies to the resolved (active) season, and only to it', async () => {
      // The manager's 2026-27 is active; 2025-26 and 2027-28 are other (inactive) seasons of the game.
      mocks.state.seasonsStore.push({ id: 'season-val-old', gameId: valGameId, name: '2025-26', isActive: false, rostersLockedAt: null });
      mocks.state.seasonsStore.push({ id: 'season-val-next', gameId: valGameId, name: '2027-28', isActive: false, rostersLockedAt: null });
      lockSeason('season-val-now'); // the manager's season (2026-27) is locked
      await expect(deleteSchoolRoster(emptyRosterId)).rejects.toThrow(LOCKED);
      await expect(createSchoolRoster({ schoolId, gameId: valGameId, name: 'JV' })).rejects.toThrow(LOCKED);
      await expect(getSchoolRosters(schoolId, valGameId)).resolves.toBeDefined();
      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes!.find((s) => s.gameId === valGameId)).toMatchObject({ seasonIsActive: true, rostersLocked: true });

      // A lock on another season of the game the manager does NOT work in is irrelevant to them.
      unlockSeason('season-val-now');
      lockSeason('season-val-next');
      await expect(deleteSchoolRoster(emptyRosterId)).resolves.toMatchObject({ success: true });
    });

    it('reads keep working while locked and report the lock per game scope', async () => {
      lockSeason('season-val-now');
      const rosters = await getSchoolRosters(schoolId);
      expect(rosters.map((r) => r.id).sort()).toEqual([emptyRosterId, lolRosterId, rosterId].sort());
      await expect(getRosterEligibility({ rosterId })).resolves.toBeDefined();
      await expect(getSchoolPlayerPool(schoolId)).resolves.toBeDefined();
      await expect(getSchoolInvites(schoolId)).resolves.toEqual([]);

      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes!.find((s) => s.gameId === valGameId)!.rostersLocked).toBe(true);
      expect(scopes!.find((s) => s.gameId === lolGameId)!.rostersLocked).toBe(false);
    });

    it('assertManagerForRoster refuses by default and allows reads with allowLocked', async () => {
      lockSeason('season-val-now');
      await expect(assertManagerForRoster(rosterId)).rejects.toThrow(LOCKED);
      await expect(assertManagerForRoster(rosterId, { allowLocked: true })).resolves.toMatchObject({ roster: { id: rosterId } });
    });

    describe('invite approval', () => {
      beforeEach(() => {
        mocks.state.playerInvitesStore = [
          { id: 'inv-lock', schoolId, gameId: valGameId, seasonId: 'season-val-now', memberId: 'm-new', intendedFirstName: 'New', intendedLastName: 'Kid', status: 'submitted', tokenHash: 'h', expiresAt: new Date('2027-01-01') },
        ];
      });

      it('accepting a student is allowed while locked (it touches no roster), but enrolling them is still refused', async () => {
        lockSeason('season-val-now');
        await expect(reviewPlayerInvite({ inviteId: 'inv-lock', action: 'approve' })).resolves.toMatchObject({ success: true });
        expect(mocks.state.playerInvitesStore[0].status).toBe('accepted');
        expect(mocks.state.playersStore.some((p) => p.memberId === 'm-new')).toBe(false);
        await expect(enrollPlayerToRoster({ rosterId, memberId: 'm-new' })).rejects.toThrow(LOCKED);
      });

      it('still allows rejecting while locked', async () => {
        lockSeason('season-val-now');
        await expect(reviewPlayerInvite({ inviteId: 'inv-lock', action: 'reject' })).resolves.toMatchObject({ success: true });
      });

      it('a staff admin can enroll an accepted student while locked', async () => {
        lockSeason('season-val-now');
        makeAdmin();
        await expect(reviewPlayerInvite({ inviteId: 'inv-lock', action: 'approve' })).resolves.toMatchObject({ success: true });
        await expect(enrollPlayerToRoster({ rosterId, memberId: 'm-new' })).resolves.toMatchObject({ success: true });
        expect(mocks.state.playersStore.some((p) => p.memberId === 'm-new' && p.rosterId === rosterId)).toBe(true);
      });
    });
  });

  describe('10. Inactive seasons are view-only for managers (spec-028)', () => {
    const VIEW_ONLY = /2025-26 is an inactive season and is view-only\./;
    const LOCKED = /locked by EZ Esports staff/;
    // Valorant seasons: 2025-26 (inactive, older than the active one), 2026-27 (active),
    // 2027-28 (inactive, newer than the active one). Both inactive seasons are view-only.
    const tags: Record<string, { season: string; name: string }> = {
      past: { season: 'season-val-past', name: '2025-26' },
      now: { season: 'season-val-now', name: '2026-27' },
      up: { season: 'season-val-up', name: '2027-28' },
    };

    const makeAdmin = () => {
      mocks.state.rolesStore.push({ id: 'role-admin', name: 'Admin', permissions: Permissions.ADMINISTRATOR, position: 5, isOwner: false });
      mocks.state.userRolesStore = [{ userId: 'manager-user-1', roleId: 'role-admin' }];
    };
    const pointManagerAt = (year: string) => {
      mocks.state.schoolManagersStore[0].academicYear = year;
    };
    const snapshot = () =>
      JSON.stringify([
        mocks.state.playersStore,
        mocks.state.rostersStore,
        mocks.state.teamsStore,
        mocks.state.playerInvitesStore,
      ]);
    const seedPlayers = () =>
      Object.keys(tags).flatMap((t) => [
        { id: `pl-${t}-st`, rosterId: `r-${t}`, memberId: 'm-st', role: 'player', isCaptain: false, ign: 'St#1' },
        { id: `pl-${t}-sub`, rosterId: `r-${t}`, memberId: 'm-sub', role: 'sub', isCaptain: false, ign: 'Su#1' },
      ]);
    const seedInvites = () =>
      Object.keys(tags).map((t) => ({
        id: `inv-${t}`, schoolId, gameId: valGameId, seasonId: tags[t as keyof typeof tags].season, memberId: 'm-new', intendedFirstName: 'New', intendedLastName: 'Kid',
        status: 'submitted', tokenHash: `h-${t}`, expiresAt: new Date('2027-01-01'),
      }));

    /** Every manager write, aimed at the roster/season of `tag`. */
    const writes = (tag: string): Array<[string, () => Promise<unknown>]> => [
      ['createSchoolRoster', () => createSchoolRoster({ schoolId, gameId: valGameId, name: 'JV' })],
      ['deleteSchoolRoster', () => deleteSchoolRoster(`r-${tag}-empty`)],
      ['enrollPlayerToRoster', () => enrollPlayerToRoster({ rosterId: `r-${tag}`, memberId: 'm-new' })],
      ['removePlayerFromRoster', () => removePlayerFromRoster({ rosterId: `r-${tag}`, playerId: `pl-${tag}-sub` })],
      ['updateRosterPlayerRole', () => updateRosterPlayerRole({ rosterId: `r-${tag}`, playerId: `pl-${tag}-st`, role: 'sub' })],
      ['emergencySwapSub', () => emergencySwapSub({ rosterId: `r-${tag}`, outPlayerId: `pl-${tag}-st`, inPlayerId: `pl-${tag}-sub` })],
      ['createPlayerInvite', () => createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' })],
      ['reviewPlayerInvite approve', () => reviewPlayerInvite({ inviteId: `inv-${tag}`, action: 'approve' })],
      ['reviewPlayerInvite reject', () => reviewPlayerInvite({ inviteId: `inv-${tag}`, action: 'reject' })],
    ];

    beforeEach(() => {
      mocks.state.seasonsStore = [
        { id: 'season-val-past', gameId: valGameId, name: '2025-26', isActive: false, rostersLockedAt: null },
        { id: 'season-val-now', gameId: valGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
        { id: 'season-val-up', gameId: valGameId, name: '2027-28', isActive: false, rostersLockedAt: null },
        { id: 'season-lol-now', gameId: lolGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
      ];
      mocks.state.schoolManagersStore = [
        { id: 'mgr-1', schoolId, userId: 'manager-user-1', managedGames: null, academicYear: '2025-26', isPrimaryContact: true, isActive: true },
      ];
      mocks.state.teamsStore = [
        ...Object.entries(tags).map(([t, v]) => ({ id: `team-${t}`, schoolId, gameId: valGameId, seasonId: v.season })),
        { id: 'team-other', schoolId: otherSchoolId, gameId: valGameId, seasonId: 'season-val-past' },
      ];
      mocks.state.rostersStore = [
        ...Object.keys(tags).flatMap((t) => [
          { id: `r-${t}`, teamId: `team-${t}`, name: 'Varsity', division: 'A' },
          { id: `r-${t}-empty`, teamId: `team-${t}`, name: 'Empty', division: 'B' },
        ]),
        { id: 'r-other-past', teamId: 'team-other', name: 'Other', division: 'A' },
      ];
      mocks.state.membersStore = [
        { id: 'm-new', schoolId, firstName: 'New', lastName: 'Kid', discord: 'new#1', graduationYear: 2027 },
        { id: 'm-st', schoolId, firstName: 'St', lastName: 'Arter', discord: 'st#1', graduationYear: 2027 },
        { id: 'm-sub', schoolId, firstName: 'Su', lastName: 'B', discord: 'su#1', graduationYear: 2027 },
      ];
      mocks.state.playersStore = seedPlayers();
      mocks.state.playerInvitesStore = seedInvites();
    });

    it.each(writes('past'))('%s is refused for a manager on an OLDER inactive season, with no write', async (_name, run) => {
      const before = snapshot();
      await expect(run()).rejects.toThrow(VIEW_ONLY);
      expect(snapshot()).toBe(before);
    });

    it('the view-only error takes precedence over the roster lock on an inactive season', async () => {
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-past').rostersLockedAt = new Date();
      await expect(deleteSchoolRoster('r-past-empty')).rejects.toThrow(VIEW_ONLY);
    });

    it('reads stay allowed on an inactive season and the scope reports it', async () => {
      expect((await getSchoolRosters(schoolId)).map((r) => r.id).sort()).toEqual(['r-past', 'r-past-empty']);
      expect((await getSchoolRosters(schoolId, valGameId)).length).toBe(2);
      await expect(getRosterEligibility({ rosterId: 'r-past' })).resolves.toBeDefined();
      await expect(getSchoolPlayerPool(schoolId)).resolves.toBeDefined();
      // Only the invite of the manager's own (inactive) season is listed (spec-047).
      expect((await getSchoolInvites(schoolId, valGameId)).map((i) => i.id)).toEqual(['inv-past']);
      expect((await getPendingSubmissions(schoolId, valGameId)).map((i) => i.id)).toEqual(['inv-past']);

      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes!.find((s) => s.gameId === valGameId)).toMatchObject({
        seasonName: '2025-26', seasonIsActive: false, readOnly: true,
        readOnlyReason: '2025-26 is an inactive season and is view-only.',
      });
    });

    it('assertManagerForRoster / assertManagerForSchool refuse by default and allow reads with allowInactive', async () => {
      await expect(assertManagerForRoster('r-past', { allowLocked: true })).rejects.toThrow(VIEW_ONLY);
      await expect(assertManagerForRoster('r-past')).rejects.toThrow(VIEW_ONLY);
      await expect(assertManagerForRoster('r-past', { allowInactive: true })).resolves.toMatchObject({ roster: { id: 'r-past' } });
      await expect(assertManagerForSchool(schoolId, valGameId)).rejects.toThrow(VIEW_ONLY);
      await expect(assertManagerForSchool(schoolId, valGameId, { allowInactive: true })).resolves.toMatchObject({ isStaffAdmin: false });
      await expect(assertManagerForSchool(schoolId)).resolves.toMatchObject({ isStaffAdmin: false });
    });

    it.each(writes('up'))('%s is refused for a manager on a NEWER inactive season, with no write', async (_name, run) => {
      pointManagerAt('2027-28');
      const before = snapshot();
      await expect(run()).rejects.toThrow(/2027-28 is an inactive season and is view-only/);
      expect(snapshot()).toBe(before);
    });

    it.each(writes('now'))('%s still works for a manager on the ACTIVE season', async (_name, run) => {
      pointManagerAt('2026-27');
      await expect(run()).resolves.toBeDefined();
    });

    it('a newer inactive season scope is read-only too, and only that season is exposed', async () => {
      pointManagerAt('2027-28');
      const scopes = await getAuthorizedGameScopes((await getSchoolManagerContext())!, schoolId);
      expect(scopes!.find((s) => s.gameId === valGameId)).toMatchObject({
        seasonName: '2027-28', seasonIsActive: false, readOnly: true,
        readOnlyReason: '2027-28 is an inactive season and is view-only.',
      });
      expect((await getSchoolRosters(schoolId, valGameId)).map((r) => r.id).sort()).toEqual(['r-up', 'r-up-empty']);
      await expect(getRosterEligibility({ rosterId: 'r-up' })).resolves.toBeDefined();
      // Another season's roster is a different season, not merely view-only.
      await expect(getRosterEligibility({ rosterId: 'r-now' })).rejects.toThrow(/different season/);
      await expect(getRosterEligibility({ rosterId: 'r-past' })).rejects.toThrow(/different season/);
    });

    it('view-only takes precedence over the lock on a newer inactive season', async () => {
      pointManagerAt('2027-28');
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-up').rostersLockedAt = new Date();
      await expect(deleteSchoolRoster('r-up-empty')).rejects.toThrow(/2027-28 is an inactive season and is view-only/);
    });

    it('the lock still works on the active season', async () => {
      pointManagerAt('2026-27');
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-now').rostersLockedAt = new Date();
      await expect(deleteSchoolRoster('r-now-empty')).rejects.toThrow(LOCKED);
      await expect(createSchoolRoster({ schoolId, gameId: valGameId, name: 'JV' })).rejects.toThrow(LOCKED);
    });

    it('with no active season every season of the game is view-only, newest included', async () => {
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-now').isActive = false;
      pointManagerAt('2027-28');
      await expect(deleteSchoolRoster('r-up-empty')).rejects.toThrow(/2027-28 is an inactive season and is view-only/);
      pointManagerAt('2026-27');
      await expect(deleteSchoolRoster('r-now-empty')).rejects.toThrow(/2026-27 is an inactive season and is view-only/);
    });

    it('two rows: the newest season by name wins, so a manager with a past and a current row can edit', async () => {
      mocks.state.schoolManagersStore.push({ id: 'mgr-2', schoolId, userId: 'manager-user-1', managedGames: null, academicYear: '2026-27', isPrimaryContact: false, isActive: true });
      await expect(deleteSchoolRoster('r-now-empty')).resolves.toMatchObject({ success: true });
      await expect(deleteSchoolRoster('r-past-empty')).rejects.toThrow(/different season/);
    });

    it('a staff admin (even with an inactive-season manager row) can still change inactive seasons', async () => {
      makeAdmin();
      const seedP = JSON.parse(JSON.stringify(mocks.state.playersStore));
      for (const tag of ['past', 'up']) {
        for (const [name, run] of writes(tag)) {
          mocks.state.playersStore = JSON.parse(JSON.stringify(seedP));
          mocks.state.playerInvitesStore = seedInvites();
          await expect(run(), name).resolves.toBeDefined();
        }
      }
    });

    it('another school, or a game the row does not cover, stays Forbidden (not a view-only message)', async () => {
      await expect(deleteSchoolRoster('r-other-past')).rejects.toThrow(/Forbidden/);
      mocks.state.schoolManagersStore[0].managedGames = ['league-of-legends'];
      await expect(deleteSchoolRoster('r-past-empty')).rejects.toThrow(/Forbidden/);
      await expect(createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' })).rejects.toThrow(/Forbidden/);
    });
  });

  describe('11. Moving players between sibling rosters (league rule: one tier per game)', () => {
    const val = 'team-val';
    const varsity = 'roster-varsity';
    const jv = 'roster-jv';
    const lolVarsity = 'roster-lol-varsity';
    const LOCKED = /locked by EZ Esports staff/;

    const memberIdsNotified = () => mocks.mockNotify.mock.calls.map((c) => c[0]);
    const snapshot = () => JSON.stringify([mocks.state.playersStore, mocks.state.rostersStore]);

    beforeEach(() => {
      mocks.mockNotify.mockReset();
      mocks.mockNotify.mockResolvedValue(undefined);
      mocks.state.seasonsStore = [
        { id: 'season-val-now', gameId: valGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
        { id: 'season-lol-now', gameId: lolGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
      ];
      mocks.state.schoolManagersStore = [
        { id: 'mgr-1', schoolId, userId: 'manager-user-1', managedGames: null, academicYear: '2026-27', isPrimaryContact: true, isActive: true },
      ];
      mocks.state.teamsStore = [
        { id: val, schoolId, gameId: valGameId, seasonId: 'season-val-now' },
        { id: 'team-lol', schoolId, gameId: lolGameId, seasonId: 'season-lol-now' },
        { id: 'team-other', schoolId: otherSchoolId, gameId: valGameId, seasonId: 'season-val-now' },
      ];
      mocks.state.rostersStore = [
        { id: varsity, teamId: val, name: 'Varsity', division: 'A' },
        { id: jv, teamId: val, name: 'JV', division: 'B' },
        { id: lolVarsity, teamId: 'team-lol', name: 'Varsity', division: 'A' },
        { id: 'roster-other', teamId: 'team-other', name: 'Varsity', division: 'A' },
      ];
      mocks.state.membersStore = [
        { id: 'm-cap', schoolId, firstName: 'Cap', lastName: 'Tain', discord: 'c#1', graduationYear: 2027 },
        { id: 'm-sub', schoolId, firstName: 'Su', lastName: 'B', discord: 's#1', graduationYear: 2027 },
        { id: 'm-new', schoolId, firstName: 'New', lastName: 'Kid', discord: 'n#1', graduationYear: 2027 },
      ];
      mocks.state.playersStore = [
        { id: 'pl-cap', rosterId: varsity, memberId: 'm-cap', role: 'captain', isCaptain: true, ign: 'Cap#1', bio: 'hi' },
        { id: 'pl-sub', rosterId: varsity, memberId: 'm-sub', role: 'sub', isCaptain: false, ign: 'Su#1' },
        { id: 'pl-jvcap', rosterId: jv, memberId: 'm-jvcap', role: 'captain', isCaptain: true, ign: 'Jv#1' },
      ];
      mocks.state.playerIdentitiesStore = [];
      mocks.state.playerInvitesStore = [];
      acceptAllMembers();
    });

    it('moves the existing row to the sibling roster, keeping its id, ign and bio', async () => {
      const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' });

      expect(res).toMatchObject({
        success: true,
        playerId: 'pl-sub',
        memberId: 'm-sub',
        fromRosterId: varsity,
        fromRosterName: 'Varsity',
        toRosterId: jv,
        toRosterName: 'JV',
        role: 'sub',
        wasCaptain: false,
      });
      const row = mocks.state.playersStore.find((p) => p.id === 'pl-sub');
      expect(row).toMatchObject({ rosterId: jv, ign: 'Su#1', role: 'sub' });
      expect(mocks.state.playersStore.filter((p) => p.memberId === 'm-sub')).toHaveLength(1);
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('rosters', 'players', 'teams');
    });

    it('can identify the player by member id instead of player id', async () => {
      await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, memberId: 'm-sub' });
      expect(mocks.state.playersStore.find((p) => p.id === 'pl-sub')?.rosterId).toBe(jv);
    });

    it('demotes a moved captain to a regular player on the new roster and leaves the old roster captain-less', async () => {
      // JV already has a captain: the moved captain must not collide with it.
      const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-cap' });

      expect(res).toMatchObject({ wasCaptain: true, role: 'player', isCaptain: false });
      const row = mocks.state.playersStore.find((p) => p.id === 'pl-cap');
      expect(row).toMatchObject({ rosterId: jv, role: 'player', isCaptain: false });
      expect(mocks.state.playersStore.filter((p) => p.rosterId === jv && p.isCaptain)).toHaveLength(1);
      expect(mocks.state.playersStore.filter((p) => p.rosterId === varsity && p.isCaptain)).toHaveLength(0);
    });

    it('refuses a move to a roster on a different team (another game) and changes nothing', async () => {
      const before = snapshot();
      const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: lolVarsity, playerId: 'pl-sub' });
      expect(res).toMatchObject({ success: false, error: expect.stringMatching(/same team/) });
      expect(snapshot()).toBe(before);
      expect(mocks.mockNotify).not.toHaveBeenCalled();
    });

    it('refuses a move when the member is already on the target roster', async () => {
      mocks.state.playersStore.push({ id: 'pl-sub-jv', rosterId: jv, memberId: 'm-sub', role: 'player', isCaptain: false, ign: 'x' });
      const before = snapshot();
      const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' });
      expect(res).toEqual({ success: false, error: 'Su B is already on JV.' });
      expect(snapshot()).toBe(before);
      expect(mocks.mockNotify).not.toHaveBeenCalled();
    });

    it('refuses a player who is not on the source roster', async () => {
      const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-jvcap' });
      expect(res).toEqual({ success: false, error: 'That player is not on Varsity.' });
    });

    it('refuses a manager of a different school (either roster) with no write', async () => {
      const before = snapshot();
      await expect(
        movePlayerToRoster({ fromRosterId: 'roster-other', toRosterId: jv, playerId: 'pl-sub' })
      ).rejects.toThrow(/Forbidden/);
      await expect(
        movePlayerToRoster({ fromRosterId: varsity, toRosterId: 'roster-other', playerId: 'pl-sub' })
      ).rejects.toThrow(/Forbidden/);
      expect(snapshot()).toBe(before);
    });

    it('refuses a manager while the season is locked, but a staff admin may still move', async () => {
      mocks.state.seasonsStore.find((s) => s.id === 'season-val-now').rostersLockedAt = new Date();
      const before = snapshot();
      await expect(
        movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' })
      ).rejects.toThrow(LOCKED);
      expect(snapshot()).toBe(before);

      mocks.state.rolesStore.push({ id: 'role-admin', name: 'Admin', permissions: Permissions.ADMINISTRATOR, position: 5, isOwner: false });
      mocks.state.userRolesStore = [{ userId: 'manager-user-1', roleId: 'role-admin' }];
      await expect(
        movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' })
      ).resolves.toMatchObject({ success: true });
    });

    it('refuses to move onto the same roster', async () => {
      const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: varsity, playerId: 'pl-sub' });
      expect(res).toMatchObject({ success: false, error: expect.stringMatching(/different roster/) });
    });

    it('enrollPlayerToRoster rejects a member who is already on a sibling roster', async () => {
      const before = snapshot();
      // Returned, not thrown: Next.js hides thrown server-action messages in production.
      await expect(enrollPlayerToRoster({ rosterId: jv, memberId: 'm-sub' })).resolves.toEqual({
        success: false,
        error: 'Su B is already on Varsity. Use Move to put them on JV.',
      });
      expect(snapshot()).toBe(before);
      expect(mocks.mockNotify).not.toHaveBeenCalled();
    });

    it('enrollPlayerToRoster still allows the same student on a different game (different team)', async () => {
      // Onboarded for Valorant already; the other game needs its own accepted application.
      mocks.state.playerInvitesStore.push({
        id: 'acc-lol', schoolId, gameId: lolGameId, seasonId: 'season-lol-now', memberId: 'm-sub',
        intendedFirstName: 'Su', intendedLastName: 'B', status: 'accepted', tokenHash: 'acc-lol', expiresAt: new Date('2027-01-01'),
      });
      const res = await enrollPlayerToRoster({ rosterId: lolVarsity, memberId: 'm-sub' });
      expect(res.success).toBe(true);
      expect(mocks.state.playersStore.filter((p) => p.memberId === 'm-sub')).toHaveLength(2);
    });

    it('enrollPlayerToRoster still lets a member already on THIS roster have their role edited', async () => {
      const res = await enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-sub', role: 'player' });
      expect(res.success).toBe(true);
      expect(mocks.state.playersStore.find((p) => p.id === 'pl-sub')?.role).toBe('player');
    });

    describe('concurrency: advisory lock and guarded update', () => {
      // Call order of the transaction, the advisory lock and the first query after it began.
      const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0];
      const firstSelectAfter = (n: number) => mocks.mockDb.select.mock.invocationCallOrder.find((o: number) => o > n);

      const expectLockedBeforeFirstQuery = (key: string) => {
        const lock = order(mocks.mockDb.execute);
        expect(lock, 'no advisory lock was taken').toBeDefined();
        expect(JSON.stringify(mocks.mockDb.execute.mock.calls[0][0])).toContain('pg_advisory_xact_lock');
        expect(JSON.stringify(mocks.mockDb.execute.mock.calls[0][0])).toContain(key);
        const txStart = order(mocks.mockDb.transaction);
        expect(lock).toBeGreaterThan(txStart);
        expect(firstSelectAfter(txStart)).toBeGreaterThan(lock);
      };

      beforeEach(() => {
        mocks.mockDb.execute.mockClear();
        mocks.mockDb.select.mockClear();
        mocks.mockDb.transaction.mockClear();
      });

      it('enroll takes the (team, member) lock before the sibling check reads anything', async () => {
        await enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new' });
        expectLockedBeforeFirstQuery(`roster-member:${val}:m-new`);
      });

      it('move takes the (team, member) lock before the in-transaction reads', async () => {
        await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' });
        expectLockedBeforeFirstQuery(`roster-member:${val}:m-sub`);
      });

      it('a row moved by someone else between the read and the update is not overwritten', async () => {
        // Simulate the concurrent move: the row changes rosters right before our UPDATE runs.
        mocks.mockDb.transaction.mockImplementationOnce(async (cb: (tx: any) => Promise<any>) =>
          cb({
            ...mocks.mockDb,
            update: (tbl: unknown) => {
              mocks.state.playersStore.find((p) => p.id === 'pl-sub').rosterId = 'roster-elsewhere';
              return mocks.mockDb.update(tbl);
            },
          })
        );

        const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' });

        expect(res).toMatchObject({ success: false, error: expect.stringMatching(/just moved or removed/) });
        expect(mocks.state.playersStore.find((p) => p.id === 'pl-sub')?.rosterId).toBe('roster-elsewhere');
        expect(mocks.mockNotify).not.toHaveBeenCalled();
        expect(mocks.mockUpdateCacheTags).not.toHaveBeenCalled();
      });
    });

    describe('approving an invite (reviewPlayerInvite)', () => {
      const inviteId = 'inv-approve';
      const seedInvite = (extra: Record<string, unknown> = {}) => {
        mocks.state.playerInvitesStore = [
          {
            id: inviteId,
            schoolId,
            gameId: valGameId,
            seasonId: 'season-val-now',
            memberId: 'm-sub',
            status: 'submitted',
            intendedFirstName: 'Su',
            intendedLastName: 'B',
            submissionDraft: { ign: 'Su#1' },
            ...extra,
          },
        ];
      };

      it('approving writes no roster row and notifies nobody (the roster seam only hears about enrollment)', async () => {
        seedInvite({ memberId: 'm-new' });
        const before = JSON.stringify(mocks.state.playersStore);
        const res = await reviewPlayerInvite({ inviteId, action: 'approve' });

        expect(res).toEqual({ success: true, status: 'accepted', inviteId });
        expect(mocks.state.playerInvitesStore[0].status).toBe('accepted');
        expect(JSON.stringify(mocks.state.playersStore)).toBe(before);
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });

      it('an accepted student already on Varsity is refused for JV (one tier per game), nothing written', async () => {
        seedInvite();
        await reviewPlayerInvite({ inviteId, action: 'approve' });
        const before = snapshot();
        const res = await enrollPlayerToRoster({ rosterId: jv, memberId: 'm-sub' });

        expect(res).toEqual({ success: false, error: 'Su B is already on Varsity. Use Move to put them on JV.' });
        expect(snapshot()).toBe(before);
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });

      it('an accepted, unrostered student can be enrolled onto either Varsity or JV, notifying once after commit', async () => {
        seedInvite({ memberId: 'm-new' });
        await reviewPlayerInvite({ inviteId, action: 'approve' });

        const res = await enrollPlayerToRoster({ rosterId: jv, memberId: 'm-new' });

        expect(res).toMatchObject({ success: true });
        expect(mocks.state.playersStore.find((p) => p.memberId === 'm-new')?.rosterId).toBe(jv);
        expect(memberIdsNotified()).toEqual([['m-new']]);

        // The same accepted student could equally have gone to Varsity.
        mocks.state.playersStore = mocks.state.playersStore.filter((p) => p.memberId !== 'm-new');
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new' })).resolves.toMatchObject({ success: true });
      });

      it('rejecting an invite never notifies', async () => {
        seedInvite();
        await reviewPlayerInvite({ inviteId, action: 'reject' });
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });
    });

    describe('role changes notify the seam', () => {
      it('updateRosterPlayerRole notifies the member whose role changed', async () => {
        await updateRosterPlayerRole({ rosterId: varsity, playerId: 'pl-sub', role: 'player' });
        expect(memberIdsNotified()).toEqual([['m-sub']]);
      });
    });

    describe('roster membership notifications (post-commit seam)', () => {
      it('move notifies exactly the moved member, after the transaction committed', async () => {
        const order: string[] = [];
        mocks.mockDb.transaction.mockImplementationOnce(async (cb: (tx: any) => Promise<any>) => {
          const out = await cb(mocks.mockDb);
          order.push('commit');
          return out;
        });
        mocks.mockNotify.mockImplementation(async () => {
          order.push('notify');
        });

        await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' });

        expect(memberIdsNotified()).toEqual([['m-sub']]);
        expect(order).toEqual(['commit', 'notify']);
      });

      it('a throwing notify does not fail a committed move', async () => {
        mocks.mockNotify.mockRejectedValue(new Error('discord down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(
          movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' })
        ).resolves.toMatchObject({ success: true });
        expect(mocks.state.playersStore.find((p) => p.id === 'pl-sub')?.rosterId).toBe(jv);
        spy.mockRestore();
      });

      it('enroll notifies the enrolled member', async () => {
        await enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new' });
        expect(memberIdsNotified()).toEqual([['m-new']]);
      });

      it('remove notifies the removed member only when a row was there', async () => {
        await removePlayerFromRoster({ rosterId: varsity, playerId: 'pl-sub' });
        expect(memberIdsNotified()).toEqual([['m-sub']]);

        mocks.mockNotify.mockClear();
        await removePlayerFromRoster({ rosterId: varsity, playerId: 'pl-sub' });
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });

      it('emergency swap notifies both members', async () => {
        await emergencySwapSub({ rosterId: varsity, outPlayerId: 'pl-cap', inPlayerId: 'pl-sub' });
        expect(memberIdsNotified()).toEqual([['m-cap', 'm-sub']]);
      });

      it('a failed enroll (sibling rule) does not notify', async () => {
        await expect(enrollPlayerToRoster({ rosterId: jv, memberId: 'm-sub' })).resolves.toMatchObject({ success: false });
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });
    });
  });

  describe('12. Roster size limits (10 players, 5 subs)', () => {
    const val = 'team-val';
    const varsity = 'roster-varsity';
    const jv = 'roster-jv';
    const inviteId = 'inv-cap';

    const snapshot = () => JSON.stringify([mocks.state.playersStore, mocks.state.rostersStore]);

    /** Puts `n` filler players on a roster, the last `subs` of them substitutes. */
    const fill = (rosterId: string, n: number, subs = 0) => {
      for (let i = 0; i < n; i++) {
        const isSub = i >= n - subs;
        mocks.state.playersStore.push({
          id: `f-${rosterId}-${i}`,
          rosterId,
          memberId: `fm-${rosterId}-${i}`,
          role: isSub ? 'sub' : 'player',
          isCaptain: false,
          ign: `F${i}`,
        });
      }
    };

    beforeEach(() => {
      mocks.mockNotify.mockReset();
      mocks.mockNotify.mockResolvedValue(undefined);
      mocks.mockDb.execute.mockClear();
      mocks.state.seasonsStore = [
        { id: 'season-val-now', gameId: valGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
      ];
      mocks.state.schoolManagersStore = [
        { id: 'mgr-1', schoolId, userId: 'manager-user-1', managedGames: null, academicYear: '2026-27', isPrimaryContact: true, isActive: true },
      ];
      mocks.state.teamsStore = [{ id: val, schoolId, gameId: valGameId, seasonId: 'season-val-now' }];
      mocks.state.rostersStore = [
        { id: varsity, teamId: val, name: 'Varsity', division: 'A' },
        { id: jv, teamId: val, name: 'JV', division: 'B' },
      ];
      mocks.state.membersStore = [
        { id: 'm-new', schoolId, firstName: 'New', lastName: 'Kid', discord: 'n#1', graduationYear: 2027 },
        { id: 'm-mover', schoolId, firstName: 'Mo', lastName: 'Ver', discord: 'm#1', graduationYear: 2027 },
      ];
      mocks.state.playersStore = [];
      mocks.state.playerIdentitiesStore = [];
      mocks.state.playerInvitesStore = [
        {
          id: inviteId,
          schoolId,
          gameId: valGameId,
          seasonId: 'season-val-now',
          memberId: 'm-new',
          status: 'accepted',
          intendedFirstName: 'New',
          intendedLastName: 'Kid',
          submissionDraft: { ign: 'New#1' },
        },
      ];
      acceptAllMembers();
    });

    describe('enrolling', () => {
      it('allows the 10th player and refuses the 11th, writing nothing', async () => {
        fill(varsity, 9);
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new' })).resolves.toMatchObject({ success: true });
        expect(mocks.state.playersStore.filter((p) => p.rosterId === varsity)).toHaveLength(10);

        mocks.mockNotify.mockClear();
        const before = snapshot();
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-mover' })).resolves.toEqual({
          success: false,
          error: 'Varsity is full (10 of 10 players).',
        });
        expect(snapshot()).toBe(before);
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });

      it('refuses a sixth substitute but accepts the fifth', async () => {
        fill(varsity, 5, 4);
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new', role: 'sub' })).resolves.toMatchObject({ success: true });
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-mover', role: 'sub' })).resolves.toEqual({
          success: false,
          error: 'Varsity already has 5 substitutes.',
        });
        // A starter still fits: the roster has 6 players, so this is the 7th.
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-mover', role: 'player' })).resolves.toMatchObject({ success: true });
      });

      it('lets someone already on a full roster have their role edited (nobody joins)', async () => {
        fill(varsity, 9);
        mocks.state.playersStore.push({ id: 'pl-new', rosterId: varsity, memberId: 'm-new', role: 'player', isCaptain: false, ign: 'x' });
        await expect(enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new', role: 'sub' })).resolves.toMatchObject({ success: true });
      });

      it('takes the member lock, then the roster lock, before counting', async () => {
        fill(varsity, 3);
        mocks.mockDb.select.mockClear();
        await enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new' });
        const locks = mocks.mockDb.execute.mock.calls.map((c: any[]) => JSON.stringify(c[0]));
        expect(locks).toHaveLength(2);
        expect(locks[0]).toContain(`roster-member:${val}:m-new`);
        expect(locks[1]).toContain(`roster:${varsity}`);
        const rosterLock = mocks.mockDb.execute.mock.invocationCallOrder[1];
        const countCall = mocks.mockDb.select.mock.calls.findIndex(
          (c: any[]) => c[0] && Object.keys(c[0]).sort().join() === 'id,role'
        );
        expect(countCall).toBeGreaterThanOrEqual(0);
        expect(mocks.mockDb.select.mock.invocationCallOrder[countCall]).toBeGreaterThan(rosterLock);
      });
    });

    describe('self-exclusion', () => {
      it('a student already on the roster as one of its 5 subs can be re-enrolled as a sub (they are not counted twice)', async () => {
        fill(varsity, 5, 4);
        mocks.state.playersStore.push({ id: 'pl-self', rosterId: varsity, memberId: 'm-new', role: 'sub', isCaptain: false, ign: 'x' });
        const res = await enrollPlayerToRoster({ rosterId: varsity, memberId: 'm-new', role: 'sub' });
        expect(res).toMatchObject({ success: true });
      });
    });

    describe('moving', () => {
      beforeEach(() => {
        mocks.state.playersStore.push({ id: 'pl-mover', rosterId: varsity, memberId: 'm-mover', role: 'player', isCaptain: false, ign: 'M' });
      });

      it('refuses a full target roster and leaves the player where they were', async () => {
        fill(jv, 10);
        const before = snapshot();
        const res = await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-mover' });
        expect(res).toEqual({ success: false, error: 'JV is full (10 of 10 players).' });
        expect(snapshot()).toBe(before);
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });

      it('accepts a target with 9 players (becomes 10)', async () => {
        fill(jv, 9);
        await expect(movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-mover' })).resolves.toMatchObject({ success: true });
      });

      it('moving OUT of a full roster is fine', async () => {
        fill(varsity, 9); // plus the mover: 10
        await expect(movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-mover' })).resolves.toMatchObject({ success: true });
      });

      it('refuses a sub when the target already has 5 subs, but a starter may go', async () => {
        fill(jv, 6, 5);
        mocks.state.playersStore.push({ id: 'pl-sub', rosterId: varsity, memberId: 'm-new', role: 'sub', isCaptain: false, ign: 'S' });
        await expect(movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-sub' })).resolves.toEqual({
          success: false,
          error: 'JV already has 5 substitutes.',
        });
        await expect(movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-mover' })).resolves.toMatchObject({ success: true });
      });

      it('takes the roster lock on the TARGET before counting it', async () => {
        fill(jv, 2);
        mocks.mockDb.select.mockClear();
        mocks.mockDb.execute.mockClear();
        await movePlayerToRoster({ fromRosterId: varsity, toRosterId: jv, playerId: 'pl-mover' });
        const locks = mocks.mockDb.execute.mock.calls.map((c: any[]) => JSON.stringify(c[0]));
        expect(locks[0]).toContain(`roster-member:${val}:m-mover`);
        expect(locks[1]).toContain(`roster:${jv}`);
        const rosterLock = mocks.mockDb.execute.mock.invocationCallOrder[1];
        const countCall = mocks.mockDb.select.mock.calls.findIndex(
          (c: any[]) => c[0] && Object.keys(c[0]).sort().join() === 'id,role'
        );
        expect(mocks.mockDb.select.mock.invocationCallOrder[countCall]).toBeGreaterThan(rosterLock);
      });
    });

    describe('role changes', () => {
      beforeEach(() => {
        fill(varsity, 6, 5); // five subs already
        mocks.state.playersStore.push({ id: 'pl-starter', rosterId: varsity, memberId: 'm-new', role: 'player', isCaptain: false, ign: 'S' });
      });

      it('refuses changing a starter to sub when five OTHER subs exist, and changes nothing', async () => {
        const before = snapshot();
        const res = await updateRosterPlayerRole({ rosterId: varsity, playerId: 'pl-starter', role: 'sub' });
        expect(res).toEqual({ success: false, error: 'Varsity already has 5 substitutes.' });
        expect(snapshot()).toBe(before);
        expect(mocks.mockNotify).not.toHaveBeenCalled();
      });

      it('lets an existing sub keep being a sub (only OTHER players are counted)', async () => {
        const subId = mocks.state.playersStore.find((p) => p.role === 'sub').id;
        await expect(updateRosterPlayerRole({ rosterId: varsity, playerId: subId, role: 'sub' })).resolves.toMatchObject({ success: true });
      });

      it('does not apply the player-count cap (10 players, role edit to captain works)', async () => {
        mocks.state.playersStore.push(
          { id: 'x1', rosterId: varsity, memberId: 'xm1', role: 'player', isCaptain: false, ign: 'x' },
          { id: 'x2', rosterId: varsity, memberId: 'xm2', role: 'player', isCaptain: false, ign: 'x' },
          { id: 'x3', rosterId: varsity, memberId: 'xm3', role: 'player', isCaptain: false, ign: 'x' }
        );
        expect(mocks.state.playersStore.filter((p) => p.rosterId === varsity)).toHaveLength(10);
        await expect(updateRosterPlayerRole({ rosterId: varsity, playerId: 'pl-starter', role: 'captain' })).resolves.toMatchObject({ success: true });
      });

      it('takes the roster lock before counting subs', async () => {
        mocks.mockDb.select.mockClear();
        mocks.mockDb.execute.mockClear();
        await updateRosterPlayerRole({ rosterId: varsity, playerId: 'pl-starter', role: 'captain' });
        expect(JSON.stringify(mocks.mockDb.execute.mock.calls[0][0])).toContain(`roster:${varsity}`);
        const lock = mocks.mockDb.execute.mock.invocationCallOrder[0];
        const countCall = mocks.mockDb.select.mock.calls.findIndex(
          (c: any[]) => c[0] && Object.keys(c[0]).sort().join() === 'id,role'
        );
        expect(mocks.mockDb.select.mock.invocationCallOrder[countCall]).toBeGreaterThan(lock);
      });
    });

    it('emergencySwapSub keeps the sub count unchanged, so a full 10/5 roster can still swap', async () => {
      fill(varsity, 8, 4);
      mocks.state.playersStore.push(
        { id: 'pl-out', rosterId: varsity, memberId: 'm-new', role: 'player', isCaptain: false, ign: 'O' },
        { id: 'pl-in', rosterId: varsity, memberId: 'm-mover', role: 'sub', isCaptain: false, ign: 'I' }
      );
      const subsBefore = mocks.state.playersStore.filter((p) => p.rosterId === varsity && p.role === 'sub').length;
      expect(mocks.state.playersStore.filter((p) => p.rosterId === varsity)).toHaveLength(10);
      expect(subsBefore).toBe(5);

      await expect(emergencySwapSub({ rosterId: varsity, outPlayerId: 'pl-out', inPlayerId: 'pl-in' })).resolves.toMatchObject({ success: true });
      expect(mocks.state.playersStore.filter((p) => p.rosterId === varsity && p.role === 'sub')).toHaveLength(5);
      expect(mocks.state.playersStore.filter((p) => p.rosterId === varsity)).toHaveLength(10);
    });
  });
  describe('13. Invite season scope and roster enrollment eligibility (spec-047)', () => {
    const mkInvite = (id: string, seasonId: string | null, extra: Record<string, unknown> = {}) => ({
      id, schoolId, gameId: valGameId, seasonId, memberId: 'm-kid', intendedFirstName: 'Kid', intendedLastName: 'One',
      status: 'submitted', tokenHash: `h-${id}`, expiresAt: new Date('2027-01-01'), submittedAt: new Date(), createdAt: new Date(),
      submissionDraft: {}, ...extra,
    });
    const makeAdmin = () => {
      mocks.state.rolesStore.push({ id: 'role-admin', name: 'Admin', permissions: Permissions.ADMINISTRATOR, position: 5, isOwner: false });
      mocks.state.userRolesStore = [{ userId: 'manager-user-1', roleId: 'role-admin' }];
    };

    beforeEach(() => {
      mocks.mockNotify.mockReset();
      mocks.mockNotify.mockResolvedValue(undefined);
      mocks.state.seasonsStore = [
        { id: 'season-val-past', gameId: valGameId, name: '2025-26', isActive: false, rostersLockedAt: null },
        { id: 'season-val-now', gameId: valGameId, name: '2026-27', isActive: true, rostersLockedAt: null },
      ];
      mocks.state.schoolManagersStore = [
        { id: 'mgr-1', schoolId, userId: 'manager-user-1', managedGames: null, academicYear: '2026-27', isPrimaryContact: true, isActive: true },
      ];
      mocks.state.teamsStore = [
        { id: 'team-now', schoolId, gameId: valGameId, seasonId: 'season-val-now' },
        { id: 'team-past', schoolId, gameId: valGameId, seasonId: 'season-val-past' },
      ];
      mocks.state.rostersStore = [
        { id: 'r-now', teamId: 'team-now', name: 'Varsity', division: 'A' },
        { id: 'r-past', teamId: 'team-past', name: 'Varsity', division: 'A' },
      ];
      mocks.state.membersStore = [
        { id: 'm-kid', schoolId, firstName: 'Kid', lastName: 'One', discord: 'k#1', graduationYear: 2027 },
        { id: 'm-grad', schoolId, firstName: 'Old', lastName: 'Timer', discord: 'o#1', graduationYear: 2026 },
        { id: 'm-nogy', schoolId, firstName: 'No', lastName: 'Year', discord: 'n#1', graduationYear: null },
      ];
      mocks.state.playersStore = [];
      mocks.state.playerIdentitiesStore = [];
      mocks.state.playerInvitesStore = [];
    });

    describe('invite creation', () => {
      it('stamps a manager invite with their (active) season', async () => {
        const result = await createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' });
        expect(mocks.state.playerInvitesStore.find((i) => i.id === result.inviteId)?.seasonId).toBe('season-val-now');
      });

      it("stamps a staff admin invite with the game's active season, and refuses when none is active", async () => {
        makeAdmin();
        const result = await createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'A', intendedLastName: 'B' });
        expect(mocks.state.playerInvitesStore.find((i) => i.id === result.inviteId)?.seasonId).toBe('season-val-now');

        mocks.state.seasonsStore.find((s) => s.id === 'season-val-now').isActive = false;
        await expect(
          createPlayerInvite({ schoolId, gameId: valGameId, intendedFirstName: 'C', intendedLastName: 'D' })
        ).rejects.toThrow(/No active season/);
      });
    });

    describe('lists', () => {
      beforeEach(() => {
        mocks.state.playerInvitesStore = [
          mkInvite('inv-now', 'season-val-now'),
          mkInvite('inv-past', 'season-val-past'),
          mkInvite('inv-null', null),
        ];
      });

      it('a manager sees only the invite whose season matches theirs (past-season and no-season hidden)', async () => {
        expect((await getSchoolInvites(schoolId)).map((i) => i.id)).toEqual(['inv-now']);
        expect((await getPendingSubmissions(schoolId)).map((i) => i.id)).toEqual(['inv-now']);
        expect((await getSchoolInvites(schoolId, valGameId)).map((i) => i.id)).toEqual(['inv-now']);
      });

      it('a staff admin still sees every invite, including past-season and no-season ones', async () => {
        makeAdmin();
        expect((await getSchoolInvites(schoolId)).map((i) => i.id).sort()).toEqual(['inv-now', 'inv-null', 'inv-past']);
        expect((await getPendingSubmissions(schoolId)).map((i) => i.id).sort()).toEqual(['inv-now', 'inv-null', 'inv-past']);
      });
    });

    describe('reviewPlayerInvite', () => {
      it('accepts a matching-season invite without touching any roster, then enrolls the student where the manager chooses', async () => {
        mocks.state.playerInvitesStore = [mkInvite('inv-now', 'season-val-now')];
        await expect(reviewPlayerInvite({ inviteId: 'inv-now', action: 'approve' })).resolves.toMatchObject({ success: true, status: 'accepted' });
        expect(mocks.state.playersStore).toHaveLength(0);
        await expect(enrollPlayerToRoster({ rosterId: 'r-now', memberId: 'm-kid' })).resolves.toMatchObject({ success: true });
        expect(mocks.state.playersStore.find((p) => p.memberId === 'm-kid')?.rosterId).toBe('r-now');
      });

      it('reviews a submitted invite exactly once: a second approve or a later reject is refused and changes nothing', async () => {
        mocks.state.playerInvitesStore = [mkInvite('inv-now', 'season-val-now')];
        await expect(reviewPlayerInvite({ inviteId: 'inv-now', action: 'approve' })).resolves.toMatchObject({ success: true });
        const accepted = { ...mocks.state.playerInvitesStore[0] };

        await expect(reviewPlayerInvite({ inviteId: 'inv-now', action: 'approve' })).resolves.toMatchObject({
          success: false,
          error: expect.stringMatching(/already reviewed or has not been submitted/),
        });
        await expect(reviewPlayerInvite({ inviteId: 'inv-now', action: 'reject' })).resolves.toMatchObject({ success: false });
        expect(mocks.state.playerInvitesStore[0]).toEqual(accepted);
      });

      it.each(['approve', 'reject'] as const)('refuses to %s an invite that has not been submitted (pending)', async (action) => {
        mocks.state.playerInvitesStore = [mkInvite('inv-pending', 'season-val-now', { status: 'pending', memberId: null })];
        await expect(reviewPlayerInvite({ inviteId: 'inv-pending', action })).resolves.toMatchObject({
          success: false,
          error: expect.stringMatching(/not been submitted/),
        });
        expect(mocks.state.playerInvitesStore[0].status).toBe('pending');
      });

      it('refuses to approve a submitted invite that has no student record', async () => {
        mocks.state.playerInvitesStore = [mkInvite('inv-nomember', 'season-val-now', { memberId: null })];
        await expect(reviewPlayerInvite({ inviteId: 'inv-nomember', action: 'approve' })).resolves.toMatchObject({ success: false });
        expect(mocks.state.playerInvitesStore[0].status).toBe('submitted');
      });

      it.each(['approve', 'reject'] as const)('refuses a past-season invite (%s) and leaves it untouched', async (action) => {
        mocks.state.playerInvitesStore = [mkInvite('inv-past', 'season-val-past')];
        await expect(reviewPlayerInvite({ inviteId: 'inv-past', action })).rejects.toThrow(/different season/);
        expect(mocks.state.playerInvitesStore[0].status).toBe('submitted');
        expect(mocks.state.playersStore).toHaveLength(0);
      });

      it.each(['approve', 'reject'] as const)('refuses a legacy no-season invite (%s) for a manager', async (action) => {
        mocks.state.playerInvitesStore = [mkInvite('inv-null', null)];
        await expect(reviewPlayerInvite({ inviteId: 'inv-null', action })).rejects.toThrow(/different season/);
        expect(mocks.state.playerInvitesStore[0].status).toBe('submitted');
      });

      it('lets a staff admin review a no-season or past-season invite', async () => {
        makeAdmin();
        mocks.state.playerInvitesStore = [mkInvite('inv-null', null), mkInvite('inv-past', 'season-val-past')];
        await expect(reviewPlayerInvite({ inviteId: 'inv-null', action: 'reject' })).resolves.toMatchObject({ success: true });
        await expect(reviewPlayerInvite({ inviteId: 'inv-past', action: 'reject' })).resolves.toMatchObject({ success: true });
      });

      it('staff accept a past-season or seasonless invite too; no roster is involved, so nothing is defaulted into the active season', async () => {
        makeAdmin();
        mocks.state.playerInvitesStore = [mkInvite('inv-past', 'season-val-past'), mkInvite('inv-null', null)];
        for (const id of ['inv-past', 'inv-null']) {
          await expect(reviewPlayerInvite({ inviteId: id, action: 'approve' })).resolves.toMatchObject({ success: true, status: 'accepted' });
        }
        expect(mocks.state.playersStore).toHaveLength(0);
      });
    });

    describe('enrolling needs an accepted application for the roster season (managers)', () => {
      const NOT_ONBOARDED = /has not been onboarded for 2026-27\. Send them an invite and approve it first\./;
      const seed = (...invites: ReturnType<typeof mkInvite>[]) => {
        mocks.state.playerInvitesStore = invites;
      };
      const enroll = () => enrollPlayerToRoster({ rosterId: 'r-now', memberId: 'm-kid' });
      const pool = async () => (await getSchoolPlayerPool(schoolId)).find((p) => p.memberId === 'm-kid');

      it('allows a student with an accepted application for this game and season', async () => {
        seed(mkInvite('i1', 'season-val-now', { status: 'accepted' }));
        await expect(enroll()).resolves.toMatchObject({ success: true });
      });

      it.each(['submitted', 'pending', 'rejected', 'expired'])('refuses a student whose only application is %s, writing nothing', async (status) => {
        seed(mkInvite('i1', 'season-val-now', { status }));
        await expect(enroll()).resolves.toMatchObject({ success: false, error: expect.stringMatching(NOT_ONBOARDED) });
        expect(mocks.state.playersStore).toHaveLength(0);
      });

      it('refuses a student with no application at all (archive-imported or staff-created)', async () => {
        seed();
        await expect(enroll()).resolves.toMatchObject({ success: false, error: expect.stringMatching(NOT_ONBOARDED) });
        expect(mocks.state.playersStore).toHaveLength(0);
      });

      it('refuses a past-season student (accepted only for an earlier season) or a seasonless accepted row', async () => {
        seed(mkInvite('past-acc', 'season-val-past', { status: 'accepted' }));
        await expect(enroll()).resolves.toMatchObject({ success: false });
        seed(mkInvite('none-acc', null, { status: 'accepted' }));
        await expect(enroll()).resolves.toMatchObject({ success: false });
      });

      it('an accepted application for this season beats older rejected or unreviewed rows', async () => {
        seed(
          mkInvite('old-rej', 'season-val-past', { status: 'rejected' }),
          mkInvite('old-sub', null, { status: 'submitted' }),
          mkInvite('now-acc', 'season-val-now', { status: 'accepted' })
        );
        await expect(enroll()).resolves.toMatchObject({ success: true });
      });

      it('an accepted application for another game does not count', async () => {
        seed(mkInvite('lol', 'season-val-now', { status: 'accepted', gameId: lolGameId }));
        await expect(enroll()).resolves.toMatchObject({ success: false });
      });

      it('approve then enroll works', async () => {
        seed(mkInvite('i1', 'season-val-now', { status: 'submitted' }));
        await expect(enroll()).resolves.toMatchObject({ success: false });
        await reviewPlayerInvite({ inviteId: 'i1', action: 'approve' });
        await expect(enroll()).resolves.toMatchObject({ success: true });
      });

      it('removal that keeps the student record: they can be re-enrolled in the same season', async () => {
        seed(mkInvite('i1', 'season-val-now', { status: 'accepted' }));
        await enroll();
        const playerId = mocks.state.playersStore.find((p) => p.memberId === 'm-kid')!.id;
        await removePlayerFromRoster({ rosterId: 'r-now', playerId });
        expect(mocks.state.playersStore).toHaveLength(0);
        await expect(enroll()).resolves.toMatchObject({ success: true });
      });

      it('removal that deletes the student record (and their invites): they must be onboarded again', async () => {
        seed(mkInvite('i1', 'season-val-now', { status: 'accepted' }));
        await enroll();
        const playerId = mocks.state.playersStore.find((p) => p.memberId === 'm-kid')!.id;
        mocks.state.removalDeletesMember = true;
        try {
          const removed = await removePlayerFromRoster({ rosterId: 'r-now', playerId });
          expect(removed.message).toContain('They will need a new invite to rejoin.');
        } finally {
          mocks.state.removalDeletesMember = false;
        }
        expect(mocks.state.playerInvitesStore).toHaveLength(0);
        await expect(enroll()).rejects.toThrow(/not found/);
      });

      it('a student already on a roster is not "new": a role edit or a sibling Move hint is not masked by the onboarding rule', async () => {
        seed(); // imported player: no application, but already on Varsity
        mocks.state.playersStore.push({ id: 'pl-imp', rosterId: 'r-now', memberId: 'm-kid', role: 'player', isCaptain: false, ign: 'x' });
        await expect(enrollPlayerToRoster({ rosterId: 'r-now', memberId: 'm-kid', role: 'sub' })).resolves.toMatchObject({ success: true });
        mocks.state.teamsStore.find((t) => t.id === 'team-now');
        mocks.state.rostersStore.push({ id: 'r-jv', teamId: 'team-now', name: 'JV', division: 'B' });
        await expect(enrollPlayerToRoster({ rosterId: 'r-jv', memberId: 'm-kid' })).resolves.toMatchObject({
          success: false,
          error: expect.stringMatching(/Use Move/),
        });
      });

      it('a staff admin is exempt and sees no application filter (null) in the pool', async () => {
        makeAdmin();
        seed();
        await expect(enroll()).resolves.toMatchObject({ success: true });
        expect((await pool())?.invites).toBeNull();
      });

      it('the pool exposes only id, game, season and status per application to a manager', async () => {
        seed(mkInvite('i1', 'season-val-now', { status: 'submitted' }));
        expect((await pool())?.invites).toEqual([{ id: 'i1', gameId: valGameId, seasonId: 'season-val-now', status: 'submitted' }]);
      });
    });

    describe('player pool for the Enroll dialog', () => {
      it('lists an accepted but unrostered student (no enrolled rosters) next to rostered ones', async () => {
        mocks.state.playerInvitesStore = [mkInvite('inv-now', 'season-val-now')];
        await reviewPlayerInvite({ inviteId: 'inv-now', action: 'approve' });
        const pool = await getSchoolPlayerPool(schoolId);
        const kid = pool.find((p) => p.memberId === 'm-kid');
        expect(kid).toBeDefined();
        expect(kid?.enrolledRosters).toEqual([]);
        expect(kid?.graduationYear).toBe(2027);
      });
    });

    describe('enrollPlayerToRoster', () => {
      beforeEach(() => acceptAllMembers());

      it('enrolls an onboarded student whatever their class year (the season comes from the invite only)', async () => {
        await expect(enrollPlayerToRoster({ rosterId: 'r-now', memberId: 'm-kid' })).resolves.toMatchObject({ success: true });
        await expect(enrollPlayerToRoster({ rosterId: 'r-now', memberId: 'm-nogy' })).resolves.toMatchObject({ success: true });
        await expect(enrollPlayerToRoster({ rosterId: 'r-now', memberId: 'm-grad' })).resolves.toMatchObject({ success: true });
      });

      it('still refuses a roster of a past season for a manager (view-only / different season)', async () => {
        await expect(enrollPlayerToRoster({ rosterId: 'r-past', memberId: 'm-kid' })).rejects.toThrow(/different season/);
      });
    });
  });
});
