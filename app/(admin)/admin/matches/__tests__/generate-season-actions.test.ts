import { beforeEach, describe, expect, it, vi } from 'vitest';

// Awaiting any select chain resolves the next queued result; inserts are recorded in order.
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const inserts: Array<{ table: unknown; values: any }> = [];
  const insertResults: unknown[][] = [];
  const state = { txRan: false };

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
        inserts.push({ table, values });
        const result = insertResults.shift() ?? [];
        return Object.assign(Promise.resolve(undefined), { returning: async () => result });
      },
    };
  }
  const tx = { select: () => selectChain(), insert };
  const db = {
    select: () => selectChain(),
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
import { commitGenerateSeason, previewGenerateSeason } from '../generate-season-actions';
import * as schema from '@/app/lib/db/schema';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEASON = uuid(900);
const schoolIds = Array.from({ length: 8 }, (_, i) => uuid(i + 1));
const input = (over: Record<string, unknown> = {}) => ({
  seasonId: SEASON,
  division: 'Varsity',
  schoolIds,
  startDate: '2026-11-02',
  ...over,
});

const seasonRow = { id: SEASON, name: 'Fall 2026', gameId: uuid(800), gameName: 'Valorant', gameSlug: 'valorant' };
const schoolRows = schoolIds.map((id, i) => ({ id, name: `School ${i}` }));

/** Queue the reads loadPlan makes: season, match count, schools, teams, (rosters when teams exist). */
function queueLoad({ matchCount = 0, teams = [] as any[], rosters = [] as any[] } = {}) {
  mocks.queue.push([seasonRow], [{ value: matchCount }], schoolRows, teams);
  if (teams.length) mocks.queue.push(rosters);
}

beforeEach(() => {
  mocks.queue.length = 0;
  mocks.inserts.length = 0;
  mocks.insertResults.length = 0;
  mocks.state.txRan = false;
  mocks.requirePermission.mockReset().mockResolvedValue({});
  vi.mocked(updateTag).mockClear();
});

describe('authorization and input validation', () => {
  it('requires the same permission as the sibling match actions and stops when denied', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(previewGenerateSeason(input())).rejects.toThrow('Forbidden');
    await expect(commitGenerateSeason(input(), 'abc')).rejects.toThrow('Forbidden');
    expect(mocks.state.txRan).toBe(false);
  });

  it('rejects malformed input before touching the database', async () => {
    expect((await previewGenerateSeason(input({ seasonId: 'nope' }))).success).toBe(false);
    expect((await previewGenerateSeason(input({ startDate: '2026-02-30' }))).success).toBe(false);
    expect((await previewGenerateSeason(input({ division: 'All' }))).success).toBe(false);
    expect((await previewGenerateSeason(input({ schoolIds: ['x'] }))).success).toBe(false);
  });

  it('explains odd and too-small selections', async () => {
    const odd = await previewGenerateSeason(input({ schoolIds: [...schoolIds, uuid(50)] }));
    expect(odd).toMatchObject({ success: false });
    expect((odd as any).error).toMatch(/odd number/);
    const few = await previewGenerateSeason(input({ schoolIds: schoolIds.slice(0, 6) }));
    expect((few as any).error).toMatch(/at least 8/);
  });
});

describe('previewGenerateSeason', () => {
  it('writes nothing and lists teams to create and 7 weeks of matches', async () => {
    queueLoad();
    const res = await previewGenerateSeason(input());
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.preview.teamsToCreate).toHaveLength(8);
    expect(res.preview.weeks).toHaveLength(7);
    expect(res.preview.matchCount).toBe(28);
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.state.txRan).toBe(false);
  });

  it('refuses a season that already has matches', async () => {
    queueLoad({ matchCount: 3 });
    const res = await previewGenerateSeason(input());
    expect(res).toMatchObject({ success: false });
    expect((res as any).error).toMatch(/already has 3 matches/);
  });

  it('refuses a game without the requested division', async () => {
    mocks.queue.push([{ ...seasonRow, gameSlug: 'tetris', gameName: 'Tetris' }]);
    const res = await previewGenerateSeason(input());
    expect((res as any).error).toMatch(/does not have a Varsity division/);
  });
});

describe('commitGenerateSeason', () => {
  async function fingerprintFor() {
    queueLoad();
    const res = await previewGenerateSeason(input());
    if (!res.success) throw new Error('preview failed');
    return res.preview.fingerprint;
  }

  it('creates missing teams, rosters and all 28 matches in one transaction', async () => {
    const fp = await fingerprintFor();
    // Lock read, then the same reads as the preview.
    mocks.queue.push([{ id: SEASON }]);
    queueLoad();
    mocks.insertResults.push(
      schoolIds.map((id, i) => ({ id: uuid(100 + i), schoolId: id })),
      schoolIds.map((_, i) => ({ id: uuid(200 + i), teamId: uuid(100 + i) }))
    );

    const res = await commitGenerateSeason(input(), fp);
    expect(res).toEqual({ success: true, teamsCreated: 8, matchesCreated: 28 });
    expect(mocks.state.txRan).toBe(true);
    expect(mocks.inserts.map((i) => i.table)).toEqual([schema.teams, schema.rosters, schema.matches]);
    const matchRows = mocks.inserts[2].values as Array<{ homeRosterId: string; awayRosterId: string; status: string }>;
    expect(matchRows).toHaveLength(28);
    const per = new Map<string, number>();
    for (const m of matchRows) {
      expect(m.homeRosterId).not.toBe(m.awayRosterId);
      expect(m.status).toBe('scheduled');
      per.set(m.homeRosterId, (per.get(m.homeRosterId) ?? 0) + 1);
      per.set(m.awayRosterId, (per.get(m.awayRosterId) ?? 0) + 1);
    }
    expect([...per.values()]).toEqual(Array(8).fill(7));
    for (const tag of ['matches', 'rosters', 'teams']) expect(updateTag).toHaveBeenCalledWith(tag);
  });

  it('reuses existing teams and rosters instead of duplicating them', async () => {
    queueLoad();
    const preview = await previewGenerateSeason(input());
    // Same inputs, but now every school already has a team and a Varsity roster.
    const teams = schoolIds.map((id, i) => ({ id: uuid(100 + i), schoolId: id }));
    const rosters = teams.map((t, i) => ({ id: uuid(200 + i), teamId: t.id, name: 'Varsity', division: 'A' }));
    mocks.queue.push([{ id: SEASON }]);
    queueLoad({ teams, rosters });
    const fp = (preview as any).preview.fingerprint as string;
    const res = await commitGenerateSeason(input(), fp);
    expect(res).toEqual({ success: true, teamsCreated: 0, matchesCreated: 28 });
    expect(mocks.inserts.map((i) => i.table)).toEqual([schema.matches]);
  });

  it('refuses a double generate: the locked re-check sees the first run matches', async () => {
    const fp = await fingerprintFor();
    mocks.queue.push([{ id: SEASON }]);
    queueLoad({ matchCount: 28 });
    const res = await commitGenerateSeason(input(), fp);
    expect(res).toMatchObject({ success: false });
    expect((res as any).error).toMatch(/already has 28 matches/);
    expect(mocks.inserts).toHaveLength(0);
  });

  it('refuses a stale or missing fingerprint', async () => {
    mocks.queue.push([{ id: SEASON }]);
    queueLoad();
    const stale = await commitGenerateSeason(input(), 'deadbeef');
    expect((stale as any).error).toMatch(/Preview it again/);
    expect(mocks.inserts).toHaveLength(0);
    expect(await commitGenerateSeason(input(), undefined)).toMatchObject({ success: false });
  });

  it('previews existing teams as reused and never errors on collisions or extra rosters', async () => {
    const teams = [
      { id: uuid(100), schoolId: schoolIds[0] },
      { id: uuid(101), schoolId: schoolIds[1] },
      { id: uuid(102), schoolId: schoolIds[2] },
    ];
    queueLoad({
      teams,
      rosters: [
        // school 0: two Varsity rosters -> reused, no error
        { id: uuid(200), teamId: uuid(100), name: 'Alpha', division: 'A' },
        { id: uuid(201), teamId: uuid(100), name: 'Beta', division: 'A' },
        // school 1: name collision, stored in JV -> new roster gets a different name
        { id: uuid(202), teamId: uuid(101), name: 'Varsity', division: 'B' },
        // school 2: nothing in Varsity -> roster only
      ],
    });
    const res = await previewGenerateSeason(input());
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.preview.reusedSchools).toEqual(['School 0']);
    expect(res.preview.teamsToCreate).toHaveLength(5);
    expect(res.preview.rostersToCreate).toContain('School 1');
    expect(res.preview.rostersToCreate).toContain('School 2');
    expect(res.preview.rostersToCreate).not.toContain('School 0');
  });

  it('commit creates a roster under a non-colliding name for a colliding school', async () => {
    queueLoad();
    const preview = await previewGenerateSeason(input());
    const teams = [{ id: uuid(101), schoolId: schoolIds[1] }];
    const rosters = [{ id: uuid(202), teamId: uuid(101), name: 'Varsity', division: 'B' }];
    // Re-plan with the existing team to get its fingerprint, then commit with the same data.
    queueLoad({ teams, rosters });
    const re = await previewGenerateSeason(input());
    const fp = (re as any).preview.fingerprint as string;
    expect((preview as any).preview.fingerprint).toBe(fp);
    mocks.queue.push([{ id: SEASON }]);
    queueLoad({ teams, rosters });
    mocks.insertResults.push(
      schoolIds.filter((_, i) => i !== 1).map((id, i) => ({ id: uuid(300 + i), schoolId: id })),
      schoolIds.map((_, i) => ({ id: uuid(400 + i), teamId: i === 1 ? uuid(101) : uuid(300 + (i > 1 ? i - 1 : i)) }))
    );
    const res = await commitGenerateSeason(input(), fp);
    expect(res).toEqual({ success: true, teamsCreated: 7, matchesCreated: 28 });
    const rosterInsert = mocks.inserts.find((i) => i.table === schema.rosters)!;
    const names = (rosterInsert.values as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain('Varsity 2');
    expect(names.filter((n) => n === 'Varsity')).toHaveLength(7);
  });

  it('maps a unique-index violation during the write to a readable message', async () => {
    const fp = await fingerprintFor();
    mocks.queue.push([{ id: SEASON }]);
    queueLoad();
    mocks.insertResults.length = 0;
    const original = mocks.db.transaction;
    mocks.db.transaction = async () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    };
    const res = await commitGenerateSeason(input(), fp);
    mocks.db.transaction = original;
    expect((res as any).error).toMatch(/created by someone else/);
  });
});
