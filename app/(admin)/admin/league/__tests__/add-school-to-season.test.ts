import { beforeEach, describe, expect, it, vi } from 'vitest';

// Awaiting any select chain resolves the next queued result; writes are recorded in order.
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const inserts: Array<{ table: unknown; values: any }> = [];
  const deletes: Array<{ table: unknown }> = [];
  const deleteResults: unknown[][] = [];
  const state = { txRan: false, locked: 0, failInsertWith: null as unknown };

  function selectChain(): any {
    const proxy: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = queue.shift();
          return (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
        }
        return () => proxy;
      },
    });
    return proxy;
  }
  function insert(table: unknown) {
    return {
      values: (values: unknown) => {
        if (state.failInsertWith) throw state.failInsertWith;
        inserts.push({ table, values });
        return Promise.resolve(undefined);
      },
    };
  }
  const tx = {
    select: () => selectChain(),
    insert,
    delete: (table: unknown) => ({
      where: () => {
        deletes.push({ table });
        return { returning: async () => deleteResults.shift() ?? [] };
      },
    }),
    execute: async () => {
      state.locked += 1;
    },
  };
  const db = {
    transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      state.txRan = true;
      return fn(tx);
    },
  };
  return { queue, inserts, deletes, deleteResults, state, db, requirePermission: vi.fn() };
});

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/db', () => ({ db: mocks.db }));

import { updateTag } from 'next/cache';
import { addSchoolToSeason, removeSchoolFromSeason } from '../season-schools-actions';
import { Permissions } from '@/app/lib/roles';
import * as schema from '@/app/lib/db/schema';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEASON = uuid(1);
const SCHOOL = uuid(2);
const GAME = uuid(9);
const input = { seasonId: SEASON, schoolId: SCHOOL };

const season = (gameSlug = 'valorant') => ({ id: SEASON, gameId: GAME, gameSlug });
const school = { id: SCHOOL, name: 'Stuyvesant' };
const scoped = (name: string, division: string) => ({ schoolId: SCHOOL, gameId: GAME, seasonId: SEASON, name, division });

beforeEach(() => {
  mocks.queue.length = 0;
  mocks.inserts.length = 0;
  mocks.deletes.length = 0;
  mocks.deleteResults.length = 0;
  mocks.state.txRan = false;
  mocks.state.locked = 0;
  mocks.state.failInsertWith = null;
  mocks.requirePermission.mockReset().mockResolvedValue({ id: 'staff1', email: 'staff@example.com' });
  vi.mocked(updateTag).mockClear();
});

describe('addSchoolToSeason', () => {
  it('requires MANAGE_LEAGUE and writes nothing when denied', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(addSchoolToSeason(input)).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_LEAGUE);
    expect(mocks.state.txRan).toBe(false);
  });

  it('rejects malformed ids before touching the database', async () => {
    expect(await addSchoolToSeason({ seasonId: 'nope', schoolId: SCHOOL })).toMatchObject({ success: false });
    expect(await addSchoolToSeason({ seasonId: SEASON, schoolId: '' })).toMatchObject({ success: false });
    expect(mocks.state.txRan).toBe(false);
  });

  it('creates the membership row plus Varsity (A) and JV (B) rosters owned by the school, game and season', async () => {
    mocks.queue.push([season()], [school], [], []); // season, school, no membership, no rosters
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: true, restored: false, rostersCreated: ['Varsity', 'JV'] });
    expect(mocks.state.locked).toBe(1);
    expect(mocks.inserts[0]).toMatchObject({ table: schema.seasonSchools, values: { schoolId: SCHOOL, gameId: GAME, seasonId: SEASON } });
    expect(mocks.inserts[1].table).toBe(schema.rosters);
    expect(mocks.inserts[1].values).toEqual([
      { schoolId: SCHOOL, gameId: GAME, seasonId: SEASON, name: 'Varsity', division: 'A' },
      { schoolId: SCHOOL, gameId: GAME, seasonId: SEASON, name: 'JV', division: 'B' },
    ]);
    for (const tag of ['teams', 'rosters', 'matches']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('is idempotent: a member with both rosters writes nothing and refreshes nothing', async () => {
    mocks.queue.push([season()], [school], [{ id: uuid(3) }], [scoped('Varsity', 'A'), scoped('JV', 'B')]);
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: false, restored: false, rostersCreated: [] });
    expect(mocks.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('adds only the missing division to a member and never a second membership row', async () => {
    mocks.queue.push([season()], [school], [{ id: uuid(3) }], [scoped('Varsity', 'Varsity')]);
    const res = await addSchoolToSeason(input);

    expect(res).toMatchObject({ success: true, teamCreated: false, rostersCreated: ['JV'] });
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0].table).toBe(schema.rosters);
    expect(mocks.inserts[0].values).toEqual([{ schoolId: SCHOOL, gameId: GAME, seasonId: SEASON, name: 'JV', division: 'B' }]);
  });

  it('creates only Varsity for a game without a JV split', async () => {
    mocks.queue.push([season('minecraft')], [school], [], []);
    const res = await addSchoolToSeason(input);
    expect(res).toMatchObject({ success: true, rostersCreated: ['Varsity'] });
  });

  it('reports a missing season or a deleted school without writing', async () => {
    mocks.queue.push([]);
    expect(await addSchoolToSeason(input)).toEqual({ success: false, error: 'Season not found.' });
    mocks.queue.push([season()], []);
    expect(await addSchoolToSeason(input)).toEqual({ success: false, error: 'School not found.' });
    expect(mocks.inserts).toHaveLength(0);
  });

  it('maps a unique-index race to a readable message', async () => {
    mocks.queue.push([season()], [school], [], []);
    mocks.state.failInsertWith = Object.assign(new Error('dup'), { code: '23505' });
    const res = await addSchoolToSeason(input);
    expect(res).toMatchObject({ success: false });
    expect((res as { error: string }).error).toMatch(/Refresh the page/);
  });
});

describe('adding a removed school back', () => {
  it('writes the membership row only: the existing rosters come back untouched, and the restore is audited', async () => {
    // No membership row, but the school still has both rosters for the season.
    mocks.queue.push([season()], [school], [], [scoped('Varsity', 'A'), scoped('JV', 'B')]);
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: true, restored: true, rostersCreated: [] });
    expect(mocks.inserts.map((i) => i.table)).toEqual([schema.seasonSchools, schema.staffAuditLogs]);
    expect(mocks.inserts[1].values).toMatchObject({ event: 'restore_school_to_season', userId: 'staff1' });
    for (const tag of ['teams', 'rosters', 'matches']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('only fills a missing division when restoring', async () => {
    mocks.queue.push([season()], [school], [], [scoped('Varsity', 'A')]);
    const res = await addSchoolToSeason(input);
    expect(res).toMatchObject({ success: true, restored: true, rostersCreated: ['JV'] });
    expect(mocks.inserts.map((i) => i.table)).toEqual([schema.seasonSchools, schema.rosters, schema.staffAuditLogs]);
  });
});

describe('removeSchoolFromSeason', () => {
  it('requires MANAGE_LEAGUE and changes nothing when denied', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(removeSchoolFromSeason(input)).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_LEAGUE);
    expect(mocks.state.txRan).toBe(false);
  });

  it('deletes only the membership row, audits it, reports hidden matches and refreshes the public caches', async () => {
    mocks.deleteResults.push([{ id: uuid(3) }]);
    mocks.queue.push([{ name: 'Stuyvesant' }], [{ id: uuid(20) }, { id: uuid(21) }], [{ value: 3 }]);
    const res = await removeSchoolFromSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', alreadyRemoved: false, hiddenMatches: 3 });
    // The one delete is the membership table: rosters, players and matches are never deleted here.
    expect(mocks.deletes.map((d) => d.table)).toEqual([schema.seasonSchools]);
    expect(mocks.inserts.map((i) => i.table)).toEqual([schema.staffAuditLogs]);
    expect(mocks.inserts[0].values).toMatchObject({ event: 'remove_school_from_season', userId: 'staff1' });
    for (const tag of ['teams', 'rosters', 'matches']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('is idempotent: removing twice writes nothing the second time', async () => {
    mocks.deleteResults.push([]);
    mocks.queue.push([{ name: 'Stuyvesant' }], [], []);
    const res = await removeSchoolFromSeason(input);
    expect(res).toMatchObject({ success: true, alreadyRemoved: true });
    expect(mocks.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('reports an unknown school and rejects malformed ids before touching the database', async () => {
    mocks.queue.push([]);
    expect(await removeSchoolFromSeason(input)).toEqual({ success: false, error: 'School not found.' });
    mocks.state.txRan = false;
    expect(await removeSchoolFromSeason({ seasonId: 'x', schoolId: SCHOOL })).toMatchObject({ success: false });
    expect(mocks.state.txRan).toBe(false);
  });
});
