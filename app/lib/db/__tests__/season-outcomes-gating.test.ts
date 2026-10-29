import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Data-layer gating: each public read must hand out neutral data for a season
 * whose `outcomes_finalized_at` is null. `db.select()` returns a chainable
 * thenable that resolves to the next queued result, in call order.
 */
const mocks = vi.hoisted(() => {
  const queue: unknown[][] = [];
  const makeChain = (result: unknown[]) => {
    const chain: any = new Proxy(() => chain, {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
        return () => chain;
      },
      apply: () => chain,
    });
    return chain;
  };
  return { queue, select: vi.fn(() => makeChain(mocks_next())) };
  function mocks_next() {
    return queue.shift() ?? [];
  }
});

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('../index', () => ({ db: { select: mocks.select } }));

import {
  getGameSeasonSummary,
  getSeasonStandingsFor,
  getTeamStandingsRecords,
} from '../standings';
import { getPublicSeasonMatches } from '../matches';

const FINALIZED = new Date('2026-10-18T00:00:00Z');

const snapshotRow = (over: Record<string, unknown>) => ({
  schoolName: 'X',
  division: 'Varsity',
  rank: 1,
  wins: 8,
  losses: 1,
  gamesPlayed: 9,
  winPct: 0.88,
  points: null,
  playerName: null,
  playerIgn: null,
  notes: null,
  ...over,
});

describe('season outcome gating in the data layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue.length = 0;
  });

  it('getSeasonStandingsFor returns neutral alphabetical rows for a hidden season', async () => {
    mocks.queue.push(
      [{ standingsFormat: 'divided', outcomesFinalizedAt: null }],
      [snapshotRow({ schoolName: 'Zeta', rank: 1 }), snapshotRow({ schoolName: 'Alpha', rank: 2, wins: 1, losses: 8 })],
    );
    const res = await getSeasonStandingsFor('s1', 'Varsity');
    expect(res.outcomesPublic).toBe(false);
    expect(res.rows.map((r) => r.schoolName)).toEqual(['Alpha', 'Zeta']);
    expect(res.rows.every((r) => r.rank === null && r.wins === null && r.losses === null && r.winPct === null)).toBe(true);
  });

  it('getSeasonStandingsFor keeps real standings once finalized', async () => {
    mocks.queue.push(
      [{ standingsFormat: 'divided', outcomesFinalizedAt: FINALIZED }],
      [snapshotRow({ schoolName: 'Zeta', rank: 1 }), snapshotRow({ schoolName: 'Alpha', rank: 2 })],
    );
    const res = await getSeasonStandingsFor('s1', 'Varsity');
    expect(res.outcomesPublic).toBe(true);
    expect(res.rows.map((r) => [r.schoolName, r.rank, r.wins])).toEqual([
      ['Zeta', 1, 8],
      ['Alpha', 2, 8],
    ]);
  });

  it('an unknown season is treated as hidden', async () => {
    mocks.queue.push([], [snapshotRow({})]);
    expect((await getSeasonStandingsFor('missing', 'Varsity')).rows[0].wins).toBeNull();
  });

  it('getGameSeasonSummary lists every team alphabetically with no stats when hidden', async () => {
    const teams = ['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha', 'Foxtrot'].map((schoolName, i) =>
      snapshotRow({ schoolName, rank: i + 1 }),
    );
    // snapshot, then season meta
    mocks.queue.push(teams, [{ standingsFormat: 'combined', outcomesFinalizedAt: null }]);
    const summary = await getGameSeasonSummary('s1');
    expect(summary.outcomesPublic).toBe(false);
    expect(summary.standingsReconstructed).toBe(false);
    const names = summary.topTeamsByDivision.Varsity.map((t) => t.team);
    // Six teams, not a "top five": any cut would reveal who ranks highest.
    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']);
    for (const t of summary.topTeamsByDivision.Varsity) {
      expect(t.rank).toBeNull();
      expect(t.wins).toBeNull();
      expect(t.losses).toBeNull();
      expect(t.winPct).toBeNull();
      expect(t.schoolSlug).toBeDefined();
    }
  });

  it('getGameSeasonSummary still ranks and caps at five when finalized', async () => {
    const teams = ['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha', 'Foxtrot'].map((schoolName, i) =>
      snapshotRow({ schoolName, rank: i + 1 }),
    );
    mocks.queue.push(teams, [{ standingsFormat: 'combined', outcomesFinalizedAt: FINALIZED }]);
    const summary = await getGameSeasonSummary('s1');
    expect(summary.outcomesPublic).toBe(true);
    expect(summary.topTeams).toHaveLength(5);
    expect(summary.topTeams[0]).toMatchObject({ team: 'Echo', rank: 1, wins: 8 });
    expect(summary.topTeams[0].schoolSlug).toBe('echo');
  });

  it('getTeamStandingsRecords publishes nothing for hidden seasons and keeps finalized ones', async () => {
    const teams = [
      { teamId: 't-hidden', seasonId: 'hidden', schoolId: 'sc1' },
      { teamId: 't-public', seasonId: 'public', schoolId: 'sc1' },
    ];
    mocks.queue.push(
      // snapshot rows, season formats, computed roster_standings (select order)
      [
        { seasonId: 'hidden', schoolId: 'sc1', division: 'Varsity', wins: 7, losses: 2 },
        { seasonId: 'public', schoolId: 'sc1', division: 'Varsity', wins: 3, losses: 4 },
      ],
      [
        { id: 'hidden', standingsFormat: 'divided', outcomesFinalizedAt: null },
        { id: 'public', standingsFormat: 'divided', outcomesFinalizedAt: FINALIZED },
      ],
      [
        { teamId: 't-hidden', division: 'Varsity', wins: 7, losses: 2 },
        { teamId: 't-public', division: 'Varsity', wins: 3, losses: 4 },
      ],
    );
    const map = await getTeamStandingsRecords(teams);
    expect([...map.keys()].some((k) => k.startsWith('t-hidden'))).toBe(false);
    expect(map.get('t-public-Varsity')).toEqual({ wins: 3, losses: 4 });
  });

  it('getPublicSeasonMatches strips scores only for seasons that are not published', async () => {
    const m = (id: string, seasonId: string) => ({
      id,
      seasonId,
      status: 'forfeit',
      homeScore: 1,
      awayScore: 0,
      mvp: 'Ace',
      notes: 'won',
    });
    mocks.queue.push([m('a', 'hidden'), m('b', 'public')], [{ id: 'public' }]);
    const out = await getPublicSeasonMatches('whatever');
    expect(out[0]).toMatchObject({ homeScore: null, awayScore: null, mvp: null, notes: null, status: 'completed' });
    expect(out[1]).toMatchObject({ homeScore: 1, awayScore: 0, status: 'forfeit' });
  });
});
