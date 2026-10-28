import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Permissions } from '@/app/lib/roles';
import * as schema from '@/app/lib/db/schema';

const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a11';
const OTHER_ROSTER = 'r-other';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint): Promise<unknown> => ({})),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  writes: [] as Array<{ op: string; table?: unknown; values?: unknown; where?: unknown }>,
  /** Order in which the advisory lock and the sibling check ran. */
  order: [] as string[],
  /** Rows an UPDATE ... RETURNING reports; [] simulates a concurrent move/removal. */
  updateReturning: [{ id: 'player-ok' }] as Array<{ id: string }>,
  /** The roster's players as the size-limit count sees them. */
  rosterRoles: [] as Array<{ id: string; role: string }>,
  lockRoster: vi.fn(async (_tx: unknown, _roster: string) => {
    mocks.order.push('lockRoster');
  }),
  rosterPlayerRoles: vi.fn(async (_tx: unknown, _roster: string) => {
    mocks.order.push('count');
    return mocks.rosterRoles;
  }),
  lockRosterMember: vi.fn(async (_tx: unknown, _team: string, _member: string) => {
    mocks.order.push('lock');
  }),
  /** Makes the matching write throw, to prove the surrounding transaction rolls back. */
  failWrite: null as null | ((w: { op: string; table?: unknown }) => Error | null),
  rolledBack: 0,
  seasonRow: [{ gameId: 'g1' }] as Array<{ gameId: string }>,
  matchCount: 0,
  teamInSchool: vi.fn(async (id: string, _s: string): Promise<{ id: string; gameSlug: string } | null> =>
    id === 'team-ok' ? { id, gameSlug: 'valorant' } : id === 'team-mc' ? { id, gameSlug: 'minecraft' } : null),
  rosterInSchool: vi.fn(async (id: string, _s: string, _tx?: unknown): Promise<{ id: string; teamId: string; name: string; division: string; gameSlug: string } | null> =>
    id === 'roster-ok' ? { id, teamId: 'team-ok', name: 'Varsity', division: 'A', gameSlug: 'valorant' }
      : id === 'roster-jv' ? { id, teamId: 'team-ok', name: 'JV', division: 'B', gameSlug: 'valorant' }
      : id === 'roster-lol' ? { id, teamId: 'team-lol', name: 'Varsity', division: 'A', gameSlug: 'league-of-legends' }
      : id === 'roster-mc' ? { id, teamId: 'team-mc', name: 'Minecraft', division: 'All', gameSlug: 'minecraft' } : null),
  playerInSchool: vi.fn(async (id: string, _s: string, _tx?: unknown) =>
    id === 'player-ok' ? { id, rosterId: 'roster-ok', memberId: 'member-ok', role: 'sub', isCaptain: false }
      : id === 'player-captain' ? { id, rosterId: 'roster-ok', memberId: 'member-captain', role: 'captain', isCaptain: true }
      : id === 'player-foreign-member' ? { id, rosterId: 'roster-ok', memberId: 'member-elsewhere', role: 'player', isCaptain: false } : null),
  memberInSchool: vi.fn(async (id: string, _s: string, _tx?: unknown) => id === 'member-ok'),
  /** Sibling roster the member is already on, per test; null = on none. */
  sibling: null as null | { playerId: string; rosterId: string; rosterName: string },
  siblingEnrollment: vi.fn(async (_t: string, _m: string, _r: string, _tx?: unknown) => {
    mocks.order.push('sibling');
    return mocks.sibling;
  }),
  /** Members already on the TARGET roster of a move. */
  onTarget: false,
  memberOnRoster: vi.fn(async (_m: string, _r: string, _tx?: unknown) => {
    mocks.order.push('onTarget');
    return mocks.onTarget;
  }),
  memberDisplayName: vi.fn(async (_m: string, _tx?: unknown) => 'Ada Lovelace'),
  /** Rows the deleteRoster pre-read of the roster's players returns. */
  rosterPlayers: [] as Array<{ memberId: string }>,
  notify: vi.fn(async (_ids: string[]) => {}),
  /**
   * What the shared removal helper reports. The helper's own decisions are tested in
   * app/lib/db/__tests__/roster-removal.test.ts; here we prove the staff actions call it inside
   * their transaction, with the school-scoped player's roster.
   */
  removal: { removed: true, memberId: 'member-ok', studentRecord: 'deleted', deleted: { consents: 0, demographics: 0, identities: 0, invites: 0 } } as Record<string, unknown>,
  removePlayerFromRosterTx: vi.fn(),
  cleanupOrphanMember: vi.fn(async (_tx: unknown, _input: unknown) => ({ studentRecord: 'kept', keptReason: 'other_roster' })),
}));

vi.mock('@/app/lib/db/roster-removal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/db/roster-removal')>()),
  removePlayerFromRosterTx: mocks.removePlayerFromRosterTx,
  cleanupOrphanMember: mocks.cleanupOrphanMember,
}));
vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }));
vi.mock('@/app/lib/db/roster-scope', () => ({
  teamInSchool: mocks.teamInSchool,
  rosterInSchool: mocks.rosterInSchool,
  playerInSchool: mocks.playerInSchool,
  memberInSchool: mocks.memberInSchool,
  siblingEnrollment: mocks.siblingEnrollment,
  lockRosterMember: mocks.lockRosterMember,
  lockRoster: mocks.lockRoster,
  rosterPlayerRoles: mocks.rosterPlayerRoles,
  memberOnRoster: mocks.memberOnRoster,
  memberDisplayName: mocks.memberDisplayName,
}));
vi.mock('@/app/lib/onboarding/roster-membership-events', () => ({ notifyRosterMembershipChanged: mocks.notify }));
vi.mock('@/app/lib/db', () => {
  type Sink = Array<{ op: string; table?: unknown; values?: unknown; where?: unknown }>;
  // `sink` is mocks.writes for the shared connection, or the transaction's staging list, which is
  // only copied into mocks.writes when the transaction callback resolves (commit) and dropped when
  // it throws (rollback).
  const record = (sink: Sink, w: { op: string; table?: unknown; values?: unknown; where?: unknown }) => {
    const err = mocks.failWrite?.(w);
    if (err) throw err;
    sink.push(w);
  };
  const executor = (sink: Sink) => {
    const chain = (op: string, table: unknown) => ({
      values: (values: unknown) => {
        record(sink, { op, table, values });
        return { returning: async () => [{ id: 'new-id' }], then: (r: (v: unknown) => void) => r(undefined) };
      },
      set: (values: unknown) => {
        const write: { op: string; table?: unknown; values?: unknown; where?: unknown } = { op, table, values };
        record(sink, write);
        return {
          where: (clause: unknown) => {
            write.where = clause;
            return Object.assign(Promise.resolve(undefined), { returning: async () => mocks.updateReturning });
          },
        };
      },
      where: () => {
        record(sink, { op, table });
        return Object.assign(Promise.resolve(undefined), { returning: async () => [{ id: 'deleted' }] });
      },
    });
    return {
      // `.where()` is awaited directly by the match count and chained into `.limit()` by the season lookup.
      select: () => ({
        from: (table: unknown) => ({
          where: () =>
            table === schema.players
              ? Promise.resolve(mocks.rosterPlayers)
              : Object.assign(Promise.resolve([{ n: mocks.matchCount }]), { limit: async () => mocks.seasonRow }),
        }),
      }),
      insert: (table: unknown) => chain('insert', table),
      update: (table: unknown) => chain('update', table),
      delete: (table: unknown) => chain('delete', table),
    };
  };
  return {
    db: {
      ...executor(mocks.writes),
      transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const staged: Sink = [];
        try {
          const result = await cb(executor(staged));
          mocks.writes.push(...staged);
          return result;
        } catch (e) {
          mocks.rolledBack += 1;
          throw e;
        }
      },
    },
  };
});

import {
  createPlayer, createRoster, createTeam, deleteRoster, deleteRosterMember, moveRosterMember, updatePlayer, updateRoster,
} from '../[schoolId]/rosters/actions';

// The stand-in deletes the players row through the transaction it is given, so the write is staged
// and committed (or rolled back) exactly like the real one.
mocks.removePlayerFromRosterTx.mockImplementation(
  async (tx: { delete: (t: unknown) => { where: (c?: unknown) => Promise<unknown> } }, _input: unknown) => {
    await tx.delete(schema.players).where();
    return mocks.removal;
  },
);

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

type Call = () => Promise<unknown>;
const calls: Record<string, Call> = {
  createTeam: () => createTeam(SCHOOL, form({ gameId: 'g1', seasonId: 's1' })),
  createRoster: () => createRoster(SCHOOL, form({ teamId: 'team-ok', name: 'Varsity', division: 'Varsity' })),
  updateRoster: () => updateRoster(SCHOOL, 'roster-ok', form({ name: 'X', division: 'Varsity' })),
  deleteRoster: () => deleteRoster(SCHOOL, 'roster-ok'),
  createPlayerExisting: () => createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' })),
  createPlayerNewMember: () => createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', role: 'player' })),
  updatePlayer: () => updatePlayer(SCHOOL, 'player-ok', form({ role: 'coach', firstName: 'A', lastName: 'B' })),
  deleteRosterMember: () => deleteRosterMember(SCHOOL, 'player-ok'),
  moveRosterMember: () => moveRosterMember(SCHOOL, 'player-ok', 'roster-jv'),
};

describe('school roster edit actions: authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.failWrite = null;
    mocks.rolledBack = 0;
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  it.each(Object.keys(calls))('%s requires MANAGE_ROSTERS before any lookup or write', async (name) => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(calls[name]()).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_ROSTERS);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.teamInSchool).not.toHaveBeenCalled();
    expect(mocks.rosterInSchool).not.toHaveBeenCalled();
    expect(mocks.playerInSchool).not.toHaveBeenCalled();
    expect(mocks.memberInSchool).not.toHaveBeenCalled();
  });

  it.each(Object.keys(calls))('%s succeeds for MANAGE_ROSTERS and refreshes the school rosters path', async (name) => {
    const res = (await calls[name]()) as { success: boolean };
    expect(res.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_ROSTERS);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/schools/${SCHOOL}/rosters`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/schools');
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/admin/roster');
    expect(mocks.updateTag).toHaveBeenCalled();
  });

  it('rejects a malformed school id without touching the database', async () => {
    const res = await deleteRoster('nope', 'roster-ok');
    expect(res).toMatchObject({ success: false });
    expect(mocks.rosterInSchool).not.toHaveBeenCalled();
    expect(mocks.writes).toHaveLength(0);
  });
});

describe('school roster edit actions: school scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  it('refuses to write to a roster, player or member outside the school', async () => {
    const results = await Promise.all([
      updateRoster(SCHOOL, OTHER_ROSTER, form({ name: 'X', division: 'Varsity' })),
      deleteRoster(SCHOOL, OTHER_ROSTER),
      updatePlayer(SCHOOL, 'player-elsewhere', form({ role: 'player', firstName: 'A', lastName: 'B' })),
      updatePlayer(SCHOOL, 'player-foreign-member', form({ role: 'player', firstName: 'A', lastName: 'B' })),
      deleteRosterMember(SCHOOL, 'player-elsewhere'),
      createRoster(SCHOOL, form({ teamId: 'team-elsewhere', name: 'V', division: 'Varsity' })),
      createPlayer(SCHOOL, form({ rosterId: OTHER_ROSTER, memberId: 'member-ok', role: 'player' })),
      createPlayer(SCHOOL, form({ rosterId: OTHER_ROSTER, firstName: 'A', lastName: 'B', role: 'player' })),
      createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-elsewhere', role: 'player' })),
    ]);
    for (const r of results) expect(r).toMatchObject({ success: false });
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('passes the school id to every scope check', async () => {
    await deleteRosterMember(SCHOOL, 'player-ok');
    expect(mocks.playerInSchool).toHaveBeenCalledWith('player-ok', SCHOOL);
    await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }));
    expect(mocks.rosterInSchool).toHaveBeenCalledWith('roster-ok', SCHOOL, expect.anything());
    expect(mocks.memberInSchool).toHaveBeenCalledWith('member-ok', SCHOOL, expect.anything());
    await updatePlayer(SCHOOL, 'player-ok', form({ role: 'player', firstName: 'A', lastName: 'B' }));
    expect(mocks.playerInSchool).toHaveBeenCalledWith('player-ok', SCHOOL, expect.anything());
    // The member comes from the player row, not from the form.
    expect(mocks.memberInSchool).toHaveBeenLastCalledWith('member-ok', SCHOOL, expect.anything());
  });

  it('never changes a member\'s school or email when editing a player, and ignores a posted memberId', async () => {
    await updatePlayer(SCHOOL, 'player-ok', form({
      role: 'player', firstName: 'A', lastName: 'B', email: 'x@y.z', schoolId: 'other', memberId: 'member-elsewhere',
    }));
    const memberSet = mocks.writes.find((w) => w.op === 'update' && w.table === schema.members)?.values as Record<string, unknown>;
    expect(Object.keys(memberSet).sort()).toEqual(['discord', 'firstName', 'graduationYear', 'lastName']);
    const playerSet = mocks.writes.find((w) => w.op === 'update' && w.table === schema.players)?.values as Record<string, unknown>;
    expect(Object.keys(playerSet).sort()).toEqual(['ign', 'isCaptain', 'role']);
    expect(mocks.memberInSchool).not.toHaveBeenCalledWith('member-elsewhere', SCHOOL, expect.anything());
  });

  it('createTeam rejects a season that belongs to a different game', async () => {
    mocks.seasonRow = [{ gameId: 'g-other' }];
    const res = await createTeam(SCHOOL, form({ gameId: 'g1', seasonId: 's1' }));
    expect(res).toMatchObject({ success: false });
    expect(mocks.writes).toHaveLength(0);
    mocks.seasonRow = [{ gameId: 'g1' }];
  });

  it('rejects JV on a game with no JV split, in both create and update', async () => {
    const created = await createRoster(SCHOOL, form({ teamId: 'team-mc', name: 'Extra', division: 'JV' }));
    expect(created).toMatchObject({ success: false });
    const updated = await updateRoster(SCHOOL, 'roster-mc', form({ name: 'Main', division: 'JV' }));
    expect(updated).toMatchObject({ success: false });
    expect(mocks.writes).toHaveLength(0);
  });

  it('rejects an unknown division and an unknown role instead of defaulting', async () => {
    expect(await createRoster(SCHOOL, form({ teamId: 'team-ok', name: 'V', division: 'Gold' }))).toMatchObject({ success: false });
    expect(await updatePlayer(SCHOOL, 'player-ok', form({ role: 'admin', firstName: 'A', lastName: 'B' }))).toMatchObject({ success: false });
    expect(await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'admin' }))).toMatchObject({ success: false });
    expect(mocks.writes).toHaveLength(0);
  });

  it('a rename that leaves the division alone keeps the stored spelling', async () => {
    await updateRoster(SCHOOL, 'roster-mc', form({ name: 'Renamed', division: 'Varsity' }));
    const set = mocks.writes.find((w) => w.op === 'update')?.values as { division: string };
    expect(set.division).toBe('All');
  });

  it('does not check the season roster lock (staff are exempt)', async () => {
    const src = readFileSync(join(__dirname, '../[schoolId]/rosters/actions.ts'), 'utf8');
    expect(src).not.toMatch(/rostersLockedAt|assertRostersUnlocked|isRostersLocked/);
  });
});

describe('player actions are one atomic save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.failWrite = null;
    mocks.rolledBack = 0;
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  const failOn = (table: unknown, op: string, err: Error) => {
    mocks.failWrite = (w) => (w.table === table && w.op === op ? err : null);
  };

  // drizzle-orm 0.45 throws DrizzleQueryError whose `.cause` is the driver (Postgres) error.
  const drizzleWrapped = (pg: { code: string; constraint_name: string }) =>
    Object.assign(new Error('Failed query: insert into "players" ...'), {
      name: 'DrizzleQueryError',
      query: 'insert into "players" ...',
      params: [],
      cause: Object.assign(new Error(`duplicate key value violates unique constraint "${pg.constraint_name}"`), pg),
    });

  it('createPlayer with a new member writes the member and the player in one transaction', async () => {
    const res = await createPlayer(SCHOOL, form({
      rosterId: 'roster-ok', firstName: ' Ada ', lastName: 'Lovelace', discord: 'ada#1', graduationYear: '2027', role: 'captain', ign: 'Ada',
    }));
    expect(res).toEqual({ success: true });
    expect(mocks.writes.map((w) => `${w.op}:${w.table === schema.members ? 'members' : 'players'}`)).toEqual(['insert:members', 'insert:players']);
    expect(mocks.writes[0].values).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', schoolId: SCHOOL, discord: 'ada#1', graduationYear: 2027 });
    expect(mocks.writes[1].values).toMatchObject({ rosterId: 'roster-ok', memberId: 'new-id', role: 'captain', isCaptain: true });
    for (const tag of ['members', 'players', 'rosters']) expect(mocks.updateTag).toHaveBeenCalledWith(tag);
  });

  it('createPlayer: if the player insert fails, the new member is rolled back and the error says nothing was saved', async () => {
    failOn(schema.players, 'insert', Object.assign(new Error('duplicate key'), { constraint_name: 'players_roster_one_captain_idx' }));
    const res = (await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', role: 'captain' }))) as { success: boolean; error: string };
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already has a captain/);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.rolledBack).toBe(1);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('createPlayer: a wrapped (DrizzleQueryError-shaped) captain conflict is recognized', async () => {
    failOn(schema.players, 'insert', drizzleWrapped({ code: '23505', constraint_name: 'players_roster_one_captain_idx' }));
    const res = (await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', role: 'captain' }))) as { error: string };
    expect(res.error).toMatch(/already has a captain/);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.rolledBack).toBe(1);
    expect(mocks.writes).toHaveLength(0);
  });

  it('createPlayer: a duplicate member-on-roster failure also rolls back and says nothing was saved', async () => {
    failOn(schema.players, 'insert', new Error('unique violation'));
    const res = (await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }))) as { error: string };
    expect(res.error).toMatch(/only be registered once per roster/);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.writes).toHaveLength(0);
  });

  it('createPlayer: a wrapped duplicate-member unique violation is not mistaken for a captain conflict', async () => {
    failOn(schema.players, 'insert', drizzleWrapped({ code: '23505', constraint_name: 'players_roster_id_member_id_unique' }));
    const res = (await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }))) as { error: string };
    expect(res.error).toMatch(/only be registered once per roster/);
    expect(res.error).not.toMatch(/already has a captain/);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.writes).toHaveLength(0);
  });

  it('createPlayer validates a new member before opening the transaction', async () => {
    const res = await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', role: 'player' }));
    expect(res).toMatchObject({ success: false });
    expect(await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', graduationYear: '27', role: 'player' }))).toMatchObject({ success: false });
    expect(mocks.rosterInSchool).not.toHaveBeenCalled();
    expect(mocks.writes).toHaveLength(0);
  });

  it('updatePlayer writes the player and the member in one transaction', async () => {
    const res = await updatePlayer(SCHOOL, 'player-ok', form({
      role: 'captain', ign: 'Ign', firstName: 'A', lastName: 'B', discord: 'd#1', graduationYear: '2028',
    }));
    expect(res).toEqual({ success: true });
    expect(mocks.writes.map((w) => (w.table === schema.players ? 'players' : 'members'))).toEqual(['players', 'members']);
    expect(mocks.writes[0].values).toEqual({ role: 'captain', ign: 'Ign', isCaptain: true });
    expect(mocks.writes[1].values).toEqual({ firstName: 'A', lastName: 'B', discord: 'd#1', graduationYear: 2028 });
  });

  it('updatePlayer: if the second write fails, the first is rolled back and the error says nothing was saved', async () => {
    failOn(schema.members, 'update', new Error('connection reset'));
    const res = (await updatePlayer(SCHOOL, 'player-ok', form({ role: 'coach', firstName: 'A', lastName: 'B' }))) as { success: boolean; error: string };
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.rolledBack).toBe(1);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('updatePlayer: a captain conflict on the role change leaves the member details unedited', async () => {
    failOn(schema.players, 'update', Object.assign(new Error('x'), { constraint_name: 'players_roster_one_captain_idx' }));
    const res = (await updatePlayer(SCHOOL, 'player-ok', form({ role: 'captain', firstName: 'New', lastName: 'Name' }))) as { error: string };
    expect(res.error).toMatch(/already has a captain/);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.writes).toHaveLength(0);
  });

  it('updatePlayer: a wrapped (DrizzleQueryError-shaped) captain conflict is recognized', async () => {
    failOn(schema.players, 'update', drizzleWrapped({ code: '23505', constraint_name: 'players_roster_one_captain_idx' }));
    const res = (await updatePlayer(SCHOOL, 'player-ok', form({ role: 'captain', firstName: 'New', lastName: 'Name' }))) as { error: string };
    expect(res.error).toMatch(/already has a captain/);
    expect(res.error).toMatch(/Nothing was saved/);
    expect(mocks.writes).toHaveLength(0);
  });

  it('updatePlayer: a wrapped unique violation on another constraint gets the sanitized unique message', async () => {
    failOn(schema.players, 'update', drizzleWrapped({ code: '23505', constraint_name: 'something_else' }));
    const res = (await updatePlayer(SCHOOL, 'player-ok', form({ role: 'player', firstName: 'A', lastName: 'B' }))) as { error: string };
    expect(res.error).toMatch(/already exists/);
    expect(res.error).not.toMatch(/already has a captain/);
  });

  it('updatePlayer validates before opening the transaction', async () => {
    expect(await updatePlayer(SCHOOL, 'player-ok', form({ role: 'player', firstName: '', lastName: 'B' }))).toMatchObject({ success: false });
    expect(await updatePlayer(SCHOOL, 'player-ok', form({ role: 'player', firstName: 'A', lastName: 'B', graduationYear: '12' }))).toMatchObject({ success: false });
    expect(mocks.playerInSchool).not.toHaveBeenCalled();
    expect(mocks.writes).toHaveLength(0);
  });

  it('the old two-step actions no longer exist', () => {
    const src = readFileSync(join(__dirname, '../[schoolId]/rosters/actions.ts'), 'utf8');
    expect(src).not.toMatch(/export async function (createMember|updateMember|createRosterMember|updateRosterMember)\b/);
  });
});

describe('deleteRoster: matches protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.matchCount = 0;
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  it('refuses a roster that has matches (home or away) and deletes nothing', async () => {
    mocks.matchCount = 3;
    const res = await deleteRoster(SCHOOL, 'roster-ok');
    expect(res).toMatchObject({ success: false });
    expect((res as { error: string }).error).toContain('3 matches');
    expect((res as { error: string }).error).toContain('under Matches first');
    expect(mocks.writes.filter((w) => w.op === 'delete')).toHaveLength(0);
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('counts both the home and the away side of the match', () => {
    const src = readFileSync(join(__dirname, '../[schoolId]/rosters/actions.ts'), 'utf8');
    const body = src.slice(src.indexOf('export async function deleteRoster('), src.indexOf('// --- PLAYER'));
    expect(body).toMatch(/homeRosterId, rosterId/);
    expect(body).toMatch(/awayRosterId, rosterId/);
  });

  it('deletes a roster without matches and invalidates matches along with the other tags', async () => {
    const res = await deleteRoster(SCHOOL, 'roster-ok');
    expect(res).toMatchObject({ success: true });
    expect(mocks.writes.filter((w) => w.op === 'delete')).toHaveLength(1);
    for (const tag of ['rosters', 'players', 'teams', 'matches']) expect(mocks.updateTag).toHaveBeenCalledWith(tag);
  });

  it('checks permission first and stays school-scoped', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('Forbidden'));
    mocks.matchCount = 0;
    await expect(deleteRoster(SCHOOL, 'roster-ok')).rejects.toThrow('Forbidden');
    expect(mocks.rosterInSchool).not.toHaveBeenCalled();

    const res = await deleteRoster(SCHOOL, OTHER_ROSTER);
    expect(res).toMatchObject({ success: false });
    expect(mocks.rosterInSchool).toHaveBeenCalledWith(OTHER_ROSTER, SCHOOL);
    expect(mocks.writes).toHaveLength(0);
  });
});

describe('removing a player runs the shared orphan cleanup (spec-042)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.matchCount = 0;
    mocks.rosterPlayers = [];
    mocks.requirePermission.mockImplementation(async () => ({}));
    mocks.removal = { removed: true, memberId: 'member-ok', studentRecord: 'deleted', deleted: { consents: 0, demographics: 0, identities: 0, invites: 0 } };
  });

  it('deleteRosterMember calls the helper inside a transaction with the school-scoped player and roster', async () => {
    const res = await deleteRosterMember(SCHOOL, 'player-ok');
    expect(mocks.playerInSchool).toHaveBeenCalledWith('player-ok', SCHOOL);
    expect(mocks.removePlayerFromRosterTx).toHaveBeenCalledTimes(1);
    expect(mocks.removePlayerFromRosterTx).toHaveBeenCalledWith(expect.anything(), { playerId: 'player-ok', rosterId: 'roster-ok' });
    // The helper's delete was staged in the transaction and committed with it.
    expect(mocks.writes.filter((w) => w.op === 'delete')).toHaveLength(1);
    expect(res).toMatchObject({ success: true, studentRecord: 'deleted' });
    expect((res as { message: string }).message).toMatch(/onboarding record was deleted/);
  });

  it('refreshes rosters, players and members when the member went, and not members when kept', async () => {
    await deleteRosterMember(SCHOOL, 'player-ok');
    for (const tag of ['rosters', 'players', 'members']) expect(mocks.updateTag).toHaveBeenCalledWith(tag);
    mocks.updateTag.mockClear();
    mocks.removal = { removed: true, memberId: 'member-ok', studentRecord: 'kept', keptReason: 'match_history' };
    const res = await deleteRosterMember(SCHOOL, 'player-ok');
    expect(mocks.updateTag).toHaveBeenCalledWith('rosters');
    expect(mocks.updateTag).toHaveBeenCalledWith('players');
    expect(mocks.updateTag).not.toHaveBeenCalledWith('members');
    expect(res).toMatchObject({ success: true, studentRecord: 'kept' });
    expect((res as { message: string }).message).toContain('kept because they have match history');
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/schools/${SCHOOL}/rosters`);
    expect(mocks.notify).toHaveBeenCalledWith(['member-ok']);
  });

  it('a player of another school is refused before the helper runs', async () => {
    const res = await deleteRosterMember(SCHOOL, 'player-elsewhere');
    expect(res).toMatchObject({ success: false });
    expect(mocks.removePlayerFromRosterTx).not.toHaveBeenCalled();
  });

  it('a helper failure rolls the transaction back and reports an error without notifying', async () => {
    mocks.removePlayerFromRosterTx.mockRejectedValueOnce(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await deleteRosterMember(SCHOOL, 'player-ok');
    spy.mockRestore();
    expect(res).toMatchObject({ success: false });
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('deleteRoster runs the cleanup for each distinct member after the roster delete, in the same transaction', async () => {
    mocks.rosterPlayers = [{ memberId: 'm1' }, { memberId: 'm2' }, { memberId: 'm1' }];
    await deleteRoster(SCHOOL, 'roster-ok');
    expect(mocks.cleanupOrphanMember).toHaveBeenCalledTimes(2);
    expect(mocks.cleanupOrphanMember).toHaveBeenCalledWith(expect.anything(), { memberId: 'm1', rosterId: 'roster-ok', teamId: 'team-ok', ign: null });
    expect(mocks.cleanupOrphanMember).toHaveBeenCalledWith(expect.anything(), { memberId: 'm2', rosterId: 'roster-ok', teamId: 'team-ok', ign: null });
    expect(mocks.updateTag).toHaveBeenCalledWith('members');
  });

  it('deleteRoster refused for matches never runs the cleanup', async () => {
    mocks.matchCount = 1;
    mocks.rosterPlayers = [{ memberId: 'm1' }];
    await deleteRoster(SCHOOL, 'roster-ok');
    expect(mocks.cleanupOrphanMember).not.toHaveBeenCalled();
  });
});

describe('staff roster moves and the sibling-roster rule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.failWrite = null;
    mocks.rolledBack = 0;
    mocks.sibling = null;
    mocks.onTarget = false;
    mocks.rosterPlayers = [];
    mocks.matchCount = 0;
    mocks.order.length = 0;
    mocks.rosterRoles = [];
    mocks.updateReturning = [{ id: 'player-ok' }];
    mocks.requirePermission.mockImplementation(async () => ({}));
    mocks.notify.mockImplementation(async () => {});
  });

  const playerWrites = () => mocks.writes.filter((w) => w.op === 'update' && w.table === schema.players);

  it('moves the row to the sibling roster, scoped to the school, and refreshes the right tags', async () => {
    const res = await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv');
    expect(res).toEqual({ success: true, fromName: 'Varsity', toName: 'JV', wasCaptain: false });
    expect(playerWrites()).toHaveLength(1);
    expect(playerWrites()[0].values).toMatchObject({ rosterId: 'roster-jv', role: 'sub', isCaptain: false });
    expect(mocks.playerInSchool).toHaveBeenCalledWith('player-ok', SCHOOL, expect.anything());
    expect(mocks.rosterInSchool).toHaveBeenCalledWith('roster-jv', SCHOOL, expect.anything());
    for (const tag of ['players', 'rosters']) expect(mocks.updateTag).toHaveBeenCalledWith(tag);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/schools/${SCHOOL}/rosters`);
  });

  it('demotes a moved captain to a regular player (role and flag together)', async () => {
    const res = await moveRosterMember(SCHOOL, 'player-captain', 'roster-jv');
    expect(res).toMatchObject({ success: true, wasCaptain: true });
    expect(playerWrites()[0].values).toMatchObject({ rosterId: 'roster-jv', role: 'player', isCaptain: false });
  });

  it('refuses a roster on another team (another game) and writes nothing', async () => {
    const res = await moveRosterMember(SCHOOL, 'player-ok', 'roster-lol');
    expect(res).toMatchObject({ success: false });
    expect((res as { error: string }).error).toMatch(/same team/);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('refuses a target roster outside the school, a foreign player, and the same roster', async () => {
    expect(await moveRosterMember(SCHOOL, 'player-ok', OTHER_ROSTER)).toMatchObject({ success: false });
    expect(await moveRosterMember(SCHOOL, 'player-elsewhere', 'roster-jv')).toMatchObject({ success: false });
    expect(await moveRosterMember(SCHOOL, 'player-ok', 'roster-ok')).toMatchObject({ success: false });
    expect(mocks.writes).toHaveLength(0);
  });

  it('refuses when the member is already on the target roster', async () => {
    mocks.onTarget = true;
    const res = await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv');
    expect(res).toEqual({ success: false, error: 'Ada Lovelace is already on JV.' });
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('needs MANAGE_ROSTERS and has no season-lock check (staff bypass the manager lock)', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(moveRosterMember(SCHOOL, 'player-ok', 'roster-jv')).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_ROSTERS);
    expect(mocks.writes).toHaveLength(0);
    expect(await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv')).toMatchObject({ success: true });
  });

  it('createPlayer rejects an existing member who is already on a sibling roster', async () => {
    mocks.sibling = { playerId: 'p', rosterId: 'roster-ok', rosterName: 'Varsity' };
    const res = await createPlayer(SCHOOL, form({ rosterId: 'roster-jv', memberId: 'member-ok', role: 'player' }));
    expect(res).toEqual({
      success: false,
      error: 'Ada Lovelace is already on Varsity. Use Move to put them on JV. Nothing was saved.',
    });
    expect(mocks.siblingEnrollment).toHaveBeenCalledWith('team-ok', 'member-ok', 'roster-jv', expect.anything());
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('createPlayer does not run the sibling check for a brand-new member', async () => {
    mocks.sibling = { playerId: 'p', rosterId: 'roster-ok', rosterName: 'Varsity' };
    const res = await createPlayer(SCHOOL, form({ rosterId: 'roster-jv', firstName: 'A', lastName: 'B', role: 'player' }));
    expect(res).toEqual({ success: true });
    expect(mocks.siblingEnrollment).not.toHaveBeenCalled();
  });

  describe('concurrency: advisory lock and guarded update', () => {
    it('createPlayer takes the (team, member) lock before the sibling check', async () => {
      await createPlayer(SCHOOL, form({ rosterId: 'roster-jv', memberId: 'member-ok', role: 'player' }));
      expect(mocks.lockRosterMember).toHaveBeenCalledWith(expect.anything(), 'team-ok', 'member-ok');
      expect(mocks.order).toEqual(['lock', 'sibling', 'lockRoster', 'count']);
    });

    it('moveRosterMember takes the (team, member) lock before checking the target roster', async () => {
      await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv');
      expect(mocks.lockRosterMember).toHaveBeenCalledWith(expect.anything(), 'team-ok', 'member-ok');
      expect(mocks.order).toEqual(['lock', 'lockRoster', 'onTarget', 'count']);
    });

    it('the UPDATE is restricted to the roster the player was read on, and zero rows is a known rejection', async () => {
      mocks.updateReturning = [];
      const res = await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv');
      expect(res).toEqual({
        success: false,
        error: 'This player was just moved or removed by someone else. Refresh the page and try again.',
      });
      // The condition names both the row and its source roster, so a concurrent move matches nothing.
      const update = playerWrites()[0];
      const { sql, params } = new PgDialect().sqlToQuery(update.where as never);
      expect(sql).toMatch(/"id" = \$1/);
      expect(sql).toMatch(/"roster_id" = \$2/);
      expect(params).toEqual(['player-ok', 'roster-ok']);
      expect(mocks.notify).not.toHaveBeenCalled();
      expect(mocks.updateTag).not.toHaveBeenCalled();
    });
  });

  it('updatePlayer (a role change) notifies the member', async () => {
    const res = await updatePlayer(SCHOOL, 'player-ok', form({ role: 'captain', firstName: 'A', lastName: 'B' }));
    expect(res).toEqual({ success: true });
    expect(mocks.notify).toHaveBeenCalledWith(['member-ok']);
  });

  it('updatePlayer does not notify when the player is outside the school', async () => {
    await updatePlayer(SCHOOL, 'player-elsewhere', form({ role: 'captain', firstName: 'A', lastName: 'B' }));
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  describe('roster size limits (7 players, 2 subs)', () => {
    const rows = (n: number, subs = 0, prefix = 'r') =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, role: i >= n - subs ? 'sub' : 'player' }));

    it('createPlayer refuses an 8th player on a full roster and writes nothing', async () => {
      mocks.rosterRoles = rows(7);
      const res = await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }));
      expect(res).toEqual({ success: false, error: 'Varsity is full (7 of 7 players). Nothing was saved.' });
      expect(mocks.writes).toHaveLength(0);
      expect(mocks.notify).not.toHaveBeenCalled();
      expect(mocks.updateTag).not.toHaveBeenCalled();
    });

    it('createPlayer accepts the 7th player', async () => {
      mocks.rosterRoles = rows(6);
      expect(await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }))).toEqual({ success: true });
    });

    it('createPlayer applies the cap to a brand-new member too, without creating the member', async () => {
      mocks.rosterRoles = rows(7);
      const res = await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', role: 'player' }));
      expect(res).toMatchObject({ success: false });
      expect(mocks.writes).toHaveLength(0);
    });

    it('createPlayer refuses a third sub but accepts a second', async () => {
      mocks.rosterRoles = rows(5, 2);
      expect(await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'sub' }))).toEqual({
        success: false,
        error: 'Varsity already has 2 substitutes. Nothing was saved.',
      });
      mocks.rosterRoles = rows(5, 1);
      expect(await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'sub' }))).toEqual({ success: true });
    });

    it('updatePlayer refuses changing someone to sub when two OTHER subs exist', async () => {
      mocks.rosterRoles = [...rows(3), { id: 's1', role: 'sub' }, { id: 's2', role: 'sub' }, { id: 'player-ok', role: 'player' }];
      const res = await updatePlayer(SCHOOL, 'player-ok', form({ role: 'sub', firstName: 'A', lastName: 'B' }));
      expect(res).toEqual({ success: false, error: 'Varsity already has 2 substitutes. Nothing was saved.' });
      expect(playerWrites()).toHaveLength(0);
      expect(mocks.notify).not.toHaveBeenCalled();
    });

    it('updatePlayer lets an existing sub stay a sub (only other players are counted)', async () => {
      mocks.rosterRoles = [{ id: 's1', role: 'sub' }, { id: 'player-ok', role: 'sub' }, ...rows(4)];
      expect(await updatePlayer(SCHOOL, 'player-ok', form({ role: 'sub', firstName: 'A', lastName: 'B' }))).toEqual({ success: true });
    });

    it('updatePlayer to a non-sub role is not capped and does not count at all', async () => {
      mocks.rosterRoles = rows(7, 2);
      expect(await updatePlayer(SCHOOL, 'player-ok', form({ role: 'captain', firstName: 'A', lastName: 'B' }))).toEqual({ success: true });
      expect(mocks.rosterPlayerRoles).not.toHaveBeenCalled();
    });

    it('moveRosterMember refuses a full target roster', async () => {
      mocks.rosterRoles = rows(7);
      const res = await moveRosterMember(SCHOOL, 'player-captain', 'roster-jv');
      expect(res).toEqual({ success: false, error: 'JV is full (7 of 7 players).' });
      expect(mocks.writes).toHaveLength(0);
      expect(mocks.notify).not.toHaveBeenCalled();
    });

    it('moveRosterMember refuses a sub when the target has 2 subs, but a starter may go', async () => {
      mocks.rosterRoles = rows(5, 2);
      // player-ok is a sub in the fixture.
      expect(await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv')).toEqual({ success: false, error: 'JV already has 2 substitutes.' });
      // A captain arrives as a starter, so only the player-count cap could stop it.
      expect(await moveRosterMember(SCHOOL, 'player-captain', 'roster-jv')).toMatchObject({ success: true });
    });

    it('moving OUT of a full roster is fine (only the target is counted)', async () => {
      mocks.rosterRoles = rows(3);
      expect(await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv')).toMatchObject({ success: true });
    });

    it('takes the roster lock before counting (createPlayer, moveRosterMember, updatePlayer)', async () => {
      await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', role: 'player' }));
      expect(mocks.order).toEqual(['lockRoster', 'count']);
      mocks.order.length = 0;
      await updatePlayer(SCHOOL, 'player-ok', form({ role: 'sub', firstName: 'A', lastName: 'B' }));
      expect(mocks.order).toEqual(['lockRoster', 'count']);
      expect(mocks.lockRoster).toHaveBeenLastCalledWith(expect.anything(), 'roster-ok');
    });
  });

  describe('post-commit notifications', () => {
    it('move notifies the moved member once, after the transaction committed', async () => {
      const order: string[] = [];
      mocks.notify.mockImplementation(async () => {
        order.push(`notify(writes=${mocks.writes.length})`);
      });
      await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv');
      expect(mocks.notify).toHaveBeenCalledTimes(1);
      expect(mocks.notify).toHaveBeenCalledWith(['member-ok']);
      // Staged writes are only copied into mocks.writes on commit, so a non-zero count proves it.
      expect(order).toEqual(['notify(writes=1)']);
    });

    it('a throwing notify does not fail the committed action', async () => {
      mocks.notify.mockRejectedValue(new Error('discord down'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await moveRosterMember(SCHOOL, 'player-ok', 'roster-jv')).toMatchObject({ success: true });
      expect(await deleteRosterMember(SCHOOL, 'player-ok')).toMatchObject({ success: true });
      spy.mockRestore();
    });

    it('createPlayer notifies the existing member, and the new member id for a new member', async () => {
      await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }));
      expect(mocks.notify).toHaveBeenLastCalledWith(['member-ok']);
      await createPlayer(SCHOOL, form({ rosterId: 'roster-ok', firstName: 'A', lastName: 'B', role: 'player' }));
      expect(mocks.notify).toHaveBeenLastCalledWith(['new-id']);
    });

    it('deleteRosterMember notifies the removed member; a rejected delete notifies nobody', async () => {
      await deleteRosterMember(SCHOOL, 'player-ok');
      expect(mocks.notify).toHaveBeenCalledWith(['member-ok']);
      mocks.notify.mockClear();
      await deleteRosterMember(SCHOOL, 'player-elsewhere');
      expect(mocks.notify).not.toHaveBeenCalled();
    });

    it('deleteRoster notifies every member the cascade removed, and nobody when it is refused', async () => {
      mocks.rosterPlayers = [{ memberId: 'm1' }, { memberId: 'm2' }];
      await deleteRoster(SCHOOL, 'roster-ok');
      expect(mocks.notify).toHaveBeenCalledWith(['m1', 'm2']);

      mocks.notify.mockClear();
      mocks.matchCount = 2;
      await deleteRoster(SCHOOL, 'roster-ok');
      expect(mocks.notify).not.toHaveBeenCalled();
    });
  });
});


describe('stale /admin/roster revalidation', () => {
  const walk = (dir: string, out: string[] = []) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === '__tests__') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(full);
    }
    return out;
  };

  it('no source file revalidates the removed /admin/roster page', () => {
    const offenders = walk(join(process.cwd(), 'app')).filter((f) =>
      /revalidatePath\(\s*['"`]\/admin\/roster['"`]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
