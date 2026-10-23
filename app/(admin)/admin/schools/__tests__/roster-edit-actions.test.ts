import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Permissions } from '@/app/lib/roles';
import * as schema from '@/app/lib/db/schema';

const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a11';
const OTHER_ROSTER = 'r-other';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint): Promise<unknown> => ({})),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  writes: [] as Array<{ op: string; table?: unknown; values?: unknown }>,
  /** Makes the matching write throw, to prove the surrounding transaction rolls back. */
  failWrite: null as null | ((w: { op: string; table?: unknown }) => Error | null),
  rolledBack: 0,
  seasonRow: [{ gameId: 'g1' }] as Array<{ gameId: string }>,
  matchCount: 0,
  teamInSchool: vi.fn(async (id: string, _s: string): Promise<{ id: string; gameSlug: string } | null> =>
    id === 'team-ok' ? { id, gameSlug: 'valorant' } : id === 'team-mc' ? { id, gameSlug: 'minecraft' } : null),
  rosterInSchool: vi.fn(async (id: string, _s: string): Promise<{ id: string; division: string; gameSlug: string } | null> =>
    id === 'roster-ok' ? { id, division: 'A', gameSlug: 'valorant' }
      : id === 'roster-mc' ? { id, division: 'All', gameSlug: 'minecraft' } : null),
  playerInSchool: vi.fn(async (id: string, _s: string, _tx?: unknown) =>
    id === 'player-ok' ? { id, rosterId: 'roster-ok', memberId: 'member-ok' }
      : id === 'player-foreign-member' ? { id, rosterId: 'roster-ok', memberId: 'member-elsewhere' } : null),
  memberInSchool: vi.fn(async (id: string, _s: string, _tx?: unknown) => id === 'member-ok'),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }));
vi.mock('@/app/lib/db/roster-scope', () => ({
  teamInSchool: mocks.teamInSchool,
  rosterInSchool: mocks.rosterInSchool,
  playerInSchool: mocks.playerInSchool,
  memberInSchool: mocks.memberInSchool,
}));
vi.mock('@/app/lib/db', () => {
  type Sink = Array<{ op: string; table?: unknown; values?: unknown }>;
  // `sink` is mocks.writes for the shared connection, or the transaction's staging list, which is
  // only copied into mocks.writes when the transaction callback resolves (commit) and dropped when
  // it throws (rollback).
  const record = (sink: Sink, w: { op: string; table?: unknown; values?: unknown }) => {
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
        record(sink, { op, table, values });
        return { where: async () => undefined };
      },
      where: async () => {
        record(sink, { op, table });
      },
    });
    return {
      // `.where()` is awaited directly by the match count and chained into `.limit()` by the season lookup.
      select: () => ({
        from: () => ({
          where: () =>
            Object.assign(Promise.resolve([{ n: mocks.matchCount }]), { limit: async () => mocks.seasonRow }),
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
  createPlayer, createRoster, createTeam, deleteRoster, deleteRosterMember, updatePlayer, updateRoster,
} from '../[schoolId]/rosters/actions';

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
    expect((res as { error: string }).error).toContain('Matches & Standings');
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
