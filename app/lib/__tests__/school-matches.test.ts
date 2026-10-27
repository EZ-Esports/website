import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  divisionOptions,
  filterByDivision,
  schoolMatchStatusLabel,
  splitSchoolMatches,
  toSchoolMatchItem,
  type SchoolMatchItem,
  type SchoolMatchRow,
} from '../school-matches';

const NOW = new Date('2026-10-24T12:00:00.000Z');

function row(over: Partial<SchoolMatchRow> = {}): SchoolMatchRow {
  return {
    id: 'm1',
    seasonId: 'season-1',
    seasonName: '2026-27',
    gameId: 'game-1',
    gameName: 'Valorant',
    gameSlug: 'valorant',
    scheduledAt: new Date('2026-10-30T23:00:00.000Z'),
    status: 'scheduled',
    homeScore: 2,
    awayScore: 1,
    division: 'JV',
    homeSchoolId: 'stuy',
    homeSchoolName: 'Stuyvesant',
    awaySchoolId: 'tech',
    awaySchoolName: 'Brooklyn Tech',
    ...over,
  };
}

describe('toSchoolMatchItem', () => {
  it('reads the match from the home side', () => {
    const item = toSchoolMatchItem(row(), 'stuy');
    expect(item).toMatchObject({
      opponentName: 'Brooklyn Tech',
      isHome: true,
      ownScore: 2,
      opponentScore: 1,
      division: 'Junior Varsity',
    });
    expect(item.scheduledAt).toBe('2026-10-30T23:00:00.000Z');
  });

  it('reads the match from the away side', () => {
    expect(toSchoolMatchItem(row(), 'tech')).toMatchObject({
      opponentName: 'Stuyvesant',
      isHome: false,
      ownScore: 1,
      opponentScore: 2,
    });
  });

  it('reads a school playing its own other squad from the home side', () => {
    const item = toSchoolMatchItem(
      row({ awaySchoolId: 'stuy', awaySchoolName: 'Stuyvesant' }),
      'stuy'
    );
    expect(item).toMatchObject({ isHome: true, opponentName: 'Stuyvesant', ownScore: 2 });
  });

  it('keeps redacted scores null', () => {
    const item = toSchoolMatchItem(row({ homeScore: null, awayScore: null }), 'tech');
    expect(item.ownScore).toBeNull();
    expect(item.opponentScore).toBeNull();
  });
});

describe('splitSchoolMatches', () => {
  const item = (id: string, scheduledAt: string, status: SchoolMatchItem['status']): SchoolMatchItem => ({
    ...toSchoolMatchItem(row({ id, status, scheduledAt: new Date(scheduledAt) }), 'stuy'),
  });

  it('puts live and future scheduled matches in Upcoming, soonest first', () => {
    const { upcoming, past } = splitSchoolMatches(
      [
        item('later', '2026-11-05T22:00:00.000Z', 'scheduled'),
        item('live', '2026-10-24T11:00:00.000Z', 'live'),
        item('soon', '2026-10-25T22:00:00.000Z', 'scheduled'),
      ],
      NOW
    );
    expect(upcoming.map((m) => m.id)).toEqual(['live', 'soon', 'later']);
    expect(past).toEqual([]);
  });

  it('puts finished and overdue matches in Past, newest first', () => {
    const { upcoming, past } = splitSchoolMatches(
      [
        item('old', '2026-10-01T22:00:00.000Z', 'completed'),
        item('overdue', '2026-10-20T22:00:00.000Z', 'scheduled'),
        item('cancelled', '2026-11-01T22:00:00.000Z', 'cancelled'),
      ],
      NOW
    );
    expect(upcoming).toEqual([]);
    expect(past.map((m) => m.id)).toEqual(['cancelled', 'overdue', 'old']);
  });

  it('treats a match starting exactly now as upcoming', () => {
    const { upcoming } = splitSchoolMatches([item('now', NOW.toISOString(), 'scheduled')], NOW);
    expect(upcoming.map((m) => m.id)).toEqual(['now']);
  });
});

describe('division filter', () => {
  const mk = (id: string, division: string) => toSchoolMatchItem(row({ id, division }), 'stuy');
  const items = [mk('a', 'JV'), mk('b', 'Varsity'), mk('c', 'JV'), mk('d', 'Varsity')];

  it('lists the divisions present, Varsity before Junior Varsity, however the rows are ordered', () => {
    expect(divisionOptions(items)).toEqual(['Varsity', 'Junior Varsity']);
    expect(divisionOptions([mk('x', 'All'), mk('y', 'JV'), mk('z', 'Varsity')])).toEqual([
      'Varsity',
      'Junior Varsity',
      'All',
    ]);
    expect(divisionOptions([])).toEqual([]);
  });

  it('keeps one division, or everything for null, without reordering', () => {
    expect(filterByDivision(items, 'Junior Varsity').map((m) => m.id)).toEqual(['a', 'c']);
    expect(filterByDivision(items, 'Varsity').map((m) => m.id)).toEqual(['b', 'd']);
    expect(filterByDivision(items, null).map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterByDivision(items, 'All')).toEqual([]);
  });

  it('splits the filtered list into Upcoming and Past on its own', () => {
    const later = (id: string, division: string, scheduledAt: Date) =>
      toSchoolMatchItem(row({ id, division, scheduledAt }), 'stuy');
    const mixed = [
      later('jv-future', 'JV', new Date('2026-11-05T22:00:00.000Z')),
      later('v-future', 'Varsity', new Date('2026-11-06T22:00:00.000Z')),
      later('jv-past', 'JV', new Date('2026-10-01T22:00:00.000Z')),
    ];
    const { upcoming, past } = splitSchoolMatches(filterByDivision(mixed, 'Junior Varsity'), NOW);
    expect(upcoming.map((m) => m.id)).toEqual(['jv-future']);
    expect(past.map((m) => m.id)).toEqual(['jv-past']);
  });
});

describe('schoolMatchStatusLabel', () => {
  it('labels each state', () => {
    const at = (scheduledAt: string, status: SchoolMatchItem['status']) =>
      schoolMatchStatusLabel({ status, scheduledAt }, NOW);
    expect(at('2026-10-30T22:00:00.000Z', 'scheduled')).toBe('Scheduled');
    expect(at('2026-10-20T22:00:00.000Z', 'scheduled')).toBe('Awaiting result');
    expect(at('2026-10-20T22:00:00.000Z', 'completed')).toBe('Completed');
    expect(at('2026-10-20T22:00:00.000Z', 'forfeit')).toBe('Forfeit');
    expect(at('2026-10-30T22:00:00.000Z', 'cancelled')).toBe('Cancelled');
    expect(at('2026-10-24T11:00:00.000Z', 'live')).toBe('Live');
  });

  it('calls an unplayed match that staff moved "Rescheduled", but never hides a result', () => {
    const moved = (scheduledAt: string, status: SchoolMatchItem['status']) =>
      schoolMatchStatusLabel({ status, scheduledAt, rescheduledFrom: '2026-10-20T22:00:00.000Z' }, NOW);
    expect(moved('2026-10-30T22:00:00.000Z', 'scheduled')).toBe('Rescheduled');
    expect(moved('2026-10-20T22:00:00.000Z', 'scheduled')).toBe('Awaiting result');
    expect(moved('2026-10-22T22:00:00.000Z', 'completed')).toBe('Completed');
    expect(moved('2026-10-30T22:00:00.000Z', 'cancelled')).toBe('Cancelled');
  });
});

// --- getSchoolMatches: scoping and outcome redaction -------------------------------------------

const mocks = vi.hoisted(() => ({
  assertManagerForSchool: vi.fn(),
  getAuthorizedGameScopes: vi.fn(),
  getSchoolMatchRows: vi.fn(),
  getOutcomesPublicSeasonIds: vi.fn(),
  getLatestRescheduleRequests: vi.fn(),
  getRescheduledFrom: vi.fn(),
  getGameCounts: vi.fn(),
  getPendingSubmissions: vi.fn(),
}));

vi.mock('@/app/lib/db', () => ({ db: {} }));
vi.mock('@/app/lib/cache', () => ({ updateCacheTags: vi.fn(), CACHE_TAGS: {} }));
vi.mock('@/app/lib/onboarding/manager-auth', () => ({
  assertManagerForSchool: mocks.assertManagerForSchool,
  assertManagerForSchoolGame: vi.fn(),
  assertManagerForRoster: vi.fn(),
  assertSeasonRostersUnlocked: vi.fn(),
  getAuthorizedGameScopes: mocks.getAuthorizedGameScopes,
  getActiveSeasonForGame: vi.fn(),
  NO_ACTIVE_SEASON_ERROR: 'no active season',
}));
vi.mock('@/app/lib/db/matches', () => ({ getSchoolMatchRows: mocks.getSchoolMatchRows }));
vi.mock('@/app/lib/db/reschedules', () => ({
  getLatestRescheduleRequests: mocks.getLatestRescheduleRequests,
  getRescheduledFrom: mocks.getRescheduledFrom,
}));
vi.mock('@/app/lib/db/match-results', () => ({
  getGameCounts: mocks.getGameCounts,
  getPendingSubmissions: mocks.getPendingSubmissions,
}));
vi.mock('@/app/lib/db/standings', () => ({
  getOutcomesPublicSeasonIds: mocks.getOutcomesPublicSeasonIds,
}));

describe('getSchoolMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertManagerForSchool.mockResolvedValue({});
    mocks.getOutcomesPublicSeasonIds.mockResolvedValue(new Set<string>());
    mocks.getLatestRescheduleRequests.mockResolvedValue(new Map());
    mocks.getRescheduledFrom.mockResolvedValue(new Map());
    mocks.getGameCounts.mockResolvedValue(new Map());
    mocks.getPendingSubmissions.mockResolvedValue(new Map());
  });

  async function load(schoolId: string, gameId?: string) {
    const { getSchoolMatches } = await import('@/app/lib/onboarding/portal-actions');
    return getSchoolMatches(schoolId, gameId);
  }

  it('authorizes the school (reads stay allowed on an inactive season)', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([]);
    await load('stuy', 'game-1');
    expect(mocks.assertManagerForSchool).toHaveBeenCalledWith('stuy', 'game-1', {
      allowInactive: true,
    });
  });

  it('returns nothing and skips the query when the manager has no managed season', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([]);
    expect(await load('stuy')).toEqual([]);
    expect(mocks.getSchoolMatchRows).not.toHaveBeenCalled();
  });

  it("restricts a manager to their resolved seasons and hides unpublished scores", async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([{ seasonId: 'season-1' }]);
    mocks.getSchoolMatchRows.mockResolvedValue([
      row({ id: 'hidden', status: 'forfeit' }),
      row({ id: 'public', seasonId: 'season-2', status: 'completed' }),
    ]);
    mocks.getOutcomesPublicSeasonIds.mockResolvedValue(new Set(['season-2']));

    const items = await load('stuy', 'game-1');

    expect(mocks.getSchoolMatchRows).toHaveBeenCalledWith({
      schoolId: 'stuy',
      gameId: 'game-1',
      seasonIds: ['season-1'],
    });
    const hidden = items.find((i) => i.id === 'hidden')!;
    expect(hidden).toMatchObject({ ownScore: null, opponentScore: null, status: 'completed' });
    expect(items.find((i) => i.id === 'public')).toMatchObject({ ownScore: 2, opponentScore: 1 });
  });

  it('attaches each match’s latest reschedule request', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([{ seasonId: 'season-1' }]);
    mocks.getSchoolMatchRows.mockResolvedValue([row({ id: 'with' }), row({ id: 'without' })]);
    const request = { id: 'req-1', matchId: 'with', status: 'pending_opponent' };
    mocks.getLatestRescheduleRequests.mockResolvedValue(new Map([['with', request]]));

    const items = await load('stuy');

    expect(mocks.getLatestRescheduleRequests).toHaveBeenCalledWith(['with', 'without']);
    expect(items.find((i) => i.id === 'with')!.reschedule).toBe(request);
    expect(items.find((i) => i.id === 'without')!.reschedule).toBeNull();
  });

  it('marks a match staff moved with the time it moved from, even when its latest request is not approved', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([{ seasonId: 'season-1' }]);
    mocks.getSchoolMatchRows.mockResolvedValue([row({ id: 'moved' }), row({ id: 'plain' })]);
    mocks.getRescheduledFrom.mockResolvedValue(new Map([['moved', '2026-10-20T22:00:00.000Z']]));

    const items = await load('stuy');

    expect(mocks.getRescheduledFrom).toHaveBeenCalledWith(['moved', 'plain']);
    expect(items.find((i) => i.id === 'moved')!.rescheduledFrom).toBe('2026-10-20T22:00:00.000Z');
    expect(items.find((i) => i.id === 'plain')!.rescheduledFrom).toBeNull();
  });

  it('carries the stored game count and a pending fetched result onto each match', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([{ seasonId: 'season-1' }]);
    mocks.getSchoolMatchRows.mockResolvedValue([row({ id: 'played' }), row({ id: 'waiting' }), row({ id: 'plain' })]);
    mocks.getGameCounts.mockResolvedValue(new Map([['played', 2]]));
    mocks.getPendingSubmissions.mockResolvedValue(
      new Map([['waiting', { id: 's', matchId: 'waiting', matchIds: ['a', 'b'], retryAfter: null, message: 'busy' }]])
    );

    const items = await load('stuy');

    expect(items.find((i) => i.id === 'played')!.gameCount).toBe(2);
    expect(items.find((i) => i.id === 'waiting')!.pendingResult).toEqual({ retryAfter: null, message: 'busy', gameCount: 2 });
    expect(items.find((i) => i.id === 'plain')).toMatchObject({ gameCount: 0, pendingResult: null });
  });

  it('still returns the schedule when the reschedule lookups fail', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue([{ seasonId: 'season-1' }]);
    mocks.getSchoolMatchRows.mockResolvedValue([row({ id: 'm' })]);
    mocks.getLatestRescheduleRequests.mockRejectedValue(new Error('relation does not exist'));
    mocks.getRescheduledFrom.mockRejectedValue(new Error('relation does not exist'));
    mocks.getGameCounts.mockRejectedValue(new Error('relation does not exist'));
    mocks.getPendingSubmissions.mockRejectedValue(new Error('relation does not exist'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const items = await load('stuy');

    expect(items).toHaveLength(1);
    expect(items[0].reschedule).toBeNull();
    expect(items[0].rescheduledFrom).toBeNull();
    expect(log).toHaveBeenCalledTimes(4);
    expect(items[0]).toMatchObject({ gameCount: 0, pendingResult: null });
    log.mockRestore();
  });

  it('gives a staff admin every season, unredacted', async () => {
    mocks.getAuthorizedGameScopes.mockResolvedValue(null);
    mocks.getSchoolMatchRows.mockResolvedValue([row({ id: 'raw', status: 'forfeit' })]);

    const items = await load('stuy');

    expect(mocks.getSchoolMatchRows).toHaveBeenCalledWith({
      schoolId: 'stuy',
      gameId: undefined,
      seasonIds: undefined,
    });
    expect(mocks.getOutcomesPublicSeasonIds).not.toHaveBeenCalled();
    expect(items[0]).toMatchObject({ ownScore: 2, opponentScore: 1, status: 'forfeit' });
  });
});
