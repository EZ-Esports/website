import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Permissions } from '@/app/lib/roles';

const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a11';
const OTHER_ROSTER = 'r-other';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint): Promise<unknown> => ({})),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  writes: [] as Array<{ op: string; values?: unknown }>,
  seasonRow: [{ gameId: 'g1' }] as Array<{ gameId: string }>,
  teamInSchool: vi.fn(async (id: string, _s: string): Promise<{ id: string; gameSlug: string } | null> =>
    id === 'team-ok' ? { id, gameSlug: 'valorant' } : id === 'team-mc' ? { id, gameSlug: 'minecraft' } : null),
  rosterInSchool: vi.fn(async (id: string, _s: string): Promise<{ id: string; division: string; gameSlug: string } | null> =>
    id === 'roster-ok' ? { id, division: 'A', gameSlug: 'valorant' }
      : id === 'roster-mc' ? { id, division: 'All', gameSlug: 'minecraft' } : null),
  playerInSchool: vi.fn(async (id: string, _s: string) => (id === 'player-ok' ? { id, rosterId: 'roster-ok' } : null)),
  memberInSchool: vi.fn(async (id: string, _s: string) => id === 'member-ok'),
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
  const chain = (op: string) => ({
    values: (values: unknown) => {
      mocks.writes.push({ op, values });
      return { returning: async () => [{ id: 'new-id' }], then: (r: (v: unknown) => void) => r(undefined) };
    },
    set: (values: unknown) => {
      mocks.writes.push({ op, values });
      return { where: async () => undefined };
    },
    where: async () => {
      mocks.writes.push({ op });
    },
  });
  return {
    db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.seasonRow }) }) }),
      insert: () => chain('insert'),
      update: () => chain('update'),
      delete: () => chain('delete'),
    },
  };
});

import {
  createMember, createRoster, createRosterMember, createTeam, deleteRoster, deleteRosterMember,
  updateMember, updateRoster, updateRosterMember,
} from '../[schoolId]/rosters/actions';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

type Call = () => Promise<unknown>;
const calls: Record<string, Call> = {
  createMember: () => createMember(SCHOOL, form({ firstName: 'A', lastName: 'B' })),
  updateMember: () => updateMember(SCHOOL, 'member-ok', form({ firstName: 'A', lastName: 'B' })),
  createTeam: () => createTeam(SCHOOL, form({ gameId: 'g1', seasonId: 's1' })),
  createRoster: () => createRoster(SCHOOL, form({ teamId: 'team-ok', name: 'Varsity', division: 'Varsity' })),
  updateRoster: () => updateRoster(SCHOOL, 'roster-ok', form({ name: 'X', division: 'Varsity' })),
  deleteRoster: () => deleteRoster(SCHOOL, 'roster-ok'),
  createRosterMember: () => createRosterMember(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' })),
  updateRosterMember: () => updateRosterMember(SCHOOL, 'player-ok', form({ role: 'coach' })),
  deleteRosterMember: () => deleteRosterMember(SCHOOL, 'player-ok'),
};

describe('school roster edit actions: authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writes.length = 0;
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  it.each(Object.keys(calls))('%s requires MANAGE_ROSTERS before any lookup or write', async (name) => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(calls[name]()).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_ROSTERS);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.teamInSchool).not.toHaveBeenCalled();
    expect(mocks.rosterInSchool).not.toHaveBeenCalled();
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
      updateRosterMember(SCHOOL, 'player-elsewhere', form({ role: 'player' })),
      deleteRosterMember(SCHOOL, 'player-elsewhere'),
      updateMember(SCHOOL, 'member-elsewhere', form({ firstName: 'A', lastName: 'B' })),
      createRoster(SCHOOL, form({ teamId: 'team-elsewhere', name: 'V', division: 'Varsity' })),
      createRosterMember(SCHOOL, form({ rosterId: OTHER_ROSTER, memberId: 'member-ok', role: 'player' })),
      createRosterMember(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-elsewhere', role: 'player' })),
    ]);
    for (const r of results) expect(r).toMatchObject({ success: false });
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('passes the school id to every scope check', async () => {
    await deleteRosterMember(SCHOOL, 'player-ok');
    expect(mocks.playerInSchool).toHaveBeenCalledWith('player-ok', SCHOOL);
    await createRosterMember(SCHOOL, form({ rosterId: 'roster-ok', memberId: 'member-ok', role: 'player' }));
    expect(mocks.rosterInSchool).toHaveBeenCalledWith('roster-ok', SCHOOL);
    expect(mocks.memberInSchool).toHaveBeenCalledWith('member-ok', SCHOOL);
  });

  it('never changes a member\'s school or email when editing details', async () => {
    await updateMember(SCHOOL, 'member-ok', form({ firstName: 'A', lastName: 'B', email: 'x@y.z', schoolId: 'other' }));
    const set = mocks.writes.find((w) => w.op === 'update')?.values as Record<string, unknown>;
    expect(Object.keys(set).sort()).toEqual(['discord', 'firstName', 'graduationYear', 'lastName']);
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
    expect(await updateRosterMember(SCHOOL, 'player-ok', form({ role: 'admin' }))).toMatchObject({ success: false });
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
