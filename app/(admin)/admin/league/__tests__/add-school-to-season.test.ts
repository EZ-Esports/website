import { beforeEach, describe, expect, it, vi } from 'vitest';

// Awaiting any select chain resolves the next queued result; inserts are recorded in order.
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const inserts: Array<{ table: unknown; values: any }> = [];
  const insertResults: unknown[][] = [];
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
        const result = insertResults.shift() ?? [];
        return Object.assign(Promise.resolve(undefined), { returning: async () => result });
      },
    };
  }
  const tx = {
    select: () => selectChain(),
    insert,
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
  return { queue, inserts, insertResults, state, db, requirePermission: vi.fn() };
});

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/db', () => ({ db: mocks.db }));

import { updateTag } from 'next/cache';
import { addSchoolToSeason } from '../season-schools-actions';
import { Permissions } from '@/app/lib/roles';
import * as schema from '@/app/lib/db/schema';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEASON = uuid(1);
const SCHOOL = uuid(2);
const TEAM = uuid(3);
const input = { seasonId: SEASON, schoolId: SCHOOL };

const season = (gameSlug = 'valorant') => ({ id: SEASON, gameId: uuid(9), gameSlug });
const school = { id: SCHOOL, name: 'Stuyvesant' };

beforeEach(() => {
  mocks.queue.length = 0;
  mocks.inserts.length = 0;
  mocks.insertResults.length = 0;
  mocks.state.txRan = false;
  mocks.state.locked = 0;
  mocks.state.failInsertWith = null;
  mocks.requirePermission.mockReset().mockResolvedValue({});
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

  it('creates the team plus Varsity (A) and JV (B) rosters in one transaction', async () => {
    mocks.queue.push([season()], [school], []); // season, school, no existing team
    mocks.insertResults.push([{ id: TEAM }]); // team insert returning
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: true, rostersCreated: ['Varsity', 'JV'] });
    expect(mocks.state.locked).toBe(1);
    expect(mocks.inserts[0]).toMatchObject({ table: schema.seasonSchools, values: { schoolId: SCHOOL, gameId: uuid(9), seasonId: SEASON } });
    expect(mocks.inserts[1].table).toBe(schema.rosters);
    expect(mocks.inserts[1].values).toEqual([
      { teamId: TEAM, schoolId: SCHOOL, gameId: uuid(9), seasonId: SEASON, name: 'Varsity', division: 'A' },
      { teamId: TEAM, schoolId: SCHOOL, gameId: uuid(9), seasonId: SEASON, name: 'JV', division: 'B' },
    ]);
    for (const tag of ['teams', 'rosters']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('is idempotent: an existing team with both rosters is left alone and no tags are refreshed', async () => {
    mocks.queue.push([season()], [school], [{ id: TEAM }], [
      { name: 'Varsity', division: 'A' },
      { name: 'JV', division: 'B' },
    ]);
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: false, rostersCreated: [] });
    expect(mocks.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('repairs an existing team that is missing a division and never duplicates the team', async () => {
    mocks.queue.push([season()], [school], [{ id: TEAM }], [{ name: 'Varsity', division: 'Varsity' }]);
    const res = await addSchoolToSeason(input);

    expect(res).toMatchObject({ success: true, teamCreated: false, rostersCreated: ['JV'] });
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0].table).toBe(schema.rosters);
    expect(mocks.inserts[0].values).toEqual([{ teamId: TEAM, schoolId: SCHOOL, gameId: uuid(9), seasonId: SEASON, name: 'JV', division: 'B' }]);
  });

  it('creates only Varsity for a game without a JV split', async () => {
    mocks.queue.push([season('minecraft')], [school], []);
    mocks.insertResults.push([{ id: TEAM }]);
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
    mocks.queue.push([season()], [school], []);
    mocks.state.failInsertWith = Object.assign(new Error('dup'), { code: '23505' });
    const res = await addSchoolToSeason(input);
    expect(res).toMatchObject({ success: false });
    expect((res as { error: string }).error).toMatch(/Refresh the page/);
  });
});
