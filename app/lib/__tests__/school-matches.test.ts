import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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
});

// --- getSchoolMatches: scoping and outcome redaction -------------------------------------------

const mocks = vi.hoisted(() => ({
  assertManagerForSchool: vi.fn(),
  getAuthorizedGameScopes: vi.fn(),
  getSchoolMatchRows: vi.fn(),
  getOutcomesPublicSeasonIds: vi.fn(),
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
vi.mock('@/app/lib/db/standings', () => ({
  getOutcomesPublicSeasonIds: mocks.getOutcomesPublicSeasonIds,
}));

describe('getSchoolMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertManagerForSchool.mockResolvedValue({});
    mocks.getOutcomesPublicSeasonIds.mockResolvedValue(new Set<string>());
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
