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
  const updates: Array<{ table: unknown; set: any }> = [];
  const tx = {
    select: () => selectChain(),
    insert,
    update: (table: unknown) => ({
      set: (set: unknown) => ({
        where: async () => {
          updates.push({ table, set });
        },
      }),
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
  return { queue, inserts, insertResults, updates, state, db, requirePermission: vi.fn() };
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
const TEAM = uuid(3);
const input = { seasonId: SEASON, schoolId: SCHOOL };

const season = (gameSlug = 'valorant') => ({ id: SEASON, gameId: uuid(9), gameSlug });
const school = { id: SCHOOL, name: 'Stuyvesant' };

beforeEach(() => {
  mocks.queue.length = 0;
  mocks.inserts.length = 0;
  mocks.updates.length = 0;
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

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: true, restored: false, rostersCreated: ['Varsity', 'JV'] });
    expect(mocks.state.locked).toBe(1);
    expect(mocks.inserts[0]).toMatchObject({ table: schema.teams, values: { schoolId: SCHOOL, gameId: uuid(9), seasonId: SEASON } });
    expect(mocks.inserts[1].table).toBe(schema.rosters);
    expect(mocks.inserts[1].values).toEqual([
      { teamId: TEAM, name: 'Varsity', division: 'A' },
      { teamId: TEAM, name: 'JV', division: 'B' },
    ]);
    for (const tag of ['teams', 'rosters']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('is idempotent: an existing team with both rosters is left alone and no tags are refreshed', async () => {
    mocks.queue.push([season()], [school], [{ id: TEAM }], [
      { name: 'Varsity', division: 'A' },
      { name: 'JV', division: 'B' },
    ]);
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: false, restored: false, rostersCreated: [] });
    expect(mocks.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('repairs an existing team that is missing a division and never duplicates the team', async () => {
    mocks.queue.push([season()], [school], [{ id: TEAM }], [{ name: 'Varsity', division: 'Varsity' }]);
    const res = await addSchoolToSeason(input);

    expect(res).toMatchObject({ success: true, teamCreated: false, rostersCreated: ['JV'] });
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0].table).toBe(schema.rosters);
    expect(mocks.inserts[0].values).toEqual([{ teamId: TEAM, name: 'JV', division: 'B' }]);
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

describe('adding a removed school back', () => {
  it('clears the removal marker and reuses the existing rosters instead of creating new ones', async () => {
    mocks.queue.push([season()], [school], [{ id: TEAM, removedAt: new Date() }], [
      { name: 'Varsity', division: 'A' },
      { name: 'JV', division: 'B' },
    ]);
    const res = await addSchoolToSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', teamCreated: false, restored: true, rostersCreated: [] });
    expect(mocks.updates).toEqual([{ table: schema.teams, set: { removedAt: null } }]);
    expect(mocks.inserts).toHaveLength(0); // no second team, no duplicate rosters
    for (const tag of ['teams', 'rosters', 'matches']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('only fills a missing division on a restored team', async () => {
    mocks.queue.push([season()], [school], [{ id: TEAM, removedAt: new Date() }], [{ name: 'Varsity', division: 'A' }]);
    const res = await addSchoolToSeason(input);
    expect(res).toMatchObject({ success: true, restored: true, rostersCreated: ['JV'] });
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0].table).toBe(schema.rosters);
  });
});

describe('removeSchoolFromSeason', () => {
  beforeEach(() => {
    mocks.requirePermission.mockResolvedValue({ id: 'staff1', email: 'staff@example.com' });
  });

  it('requires MANAGE_LEAGUE and changes nothing when denied', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(removeSchoolFromSeason(input)).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_LEAGUE);
    expect(mocks.state.txRan).toBe(false);
  });

  it('marks the team removed (never deletes), audits it, reports hidden matches and refreshes caches', async () => {
    mocks.queue.push([{ teamId: TEAM, removedAt: null, schoolName: 'Stuyvesant' }], [{ value: 3 }]);
    const res = await removeSchoolFromSeason(input);

    expect(res).toEqual({ success: true, schoolName: 'Stuyvesant', alreadyRemoved: false, hiddenMatches: 3 });
    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].table).toBe(schema.teams);
    expect(mocks.updates[0].set.removedAt).toBeInstanceOf(Date);
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0].table).toBe(schema.staffAuditLogs);
    expect(mocks.inserts[0].values).toMatchObject({ event: 'remove_school_from_season', userId: 'staff1' });
    for (const tag of ['teams', 'rosters', 'matches']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('is idempotent: removing twice writes nothing the second time', async () => {
    mocks.queue.push([{ teamId: TEAM, removedAt: new Date(), schoolName: 'Stuyvesant' }], [{ value: 0 }]);
    const res = await removeSchoolFromSeason(input);
    expect(res).toMatchObject({ success: true, alreadyRemoved: true });
    expect(mocks.updates).toHaveLength(0);
    expect(mocks.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('reports a school that is not in the season', async () => {
    mocks.queue.push([]);
    expect(await removeSchoolFromSeason(input)).toEqual({ success: false, error: 'That school is not in this season.' });
  });

  it('rejects malformed ids before touching the database', async () => {
    expect(await removeSchoolFromSeason({ seasonId: 'x', schoolId: SCHOOL })).toMatchObject({ success: false });
    expect(mocks.state.txRan).toBe(false);
  });
});
