import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicMatchesPage: vi.fn(),
  getMatchesPage: vi.fn(),
  getStaffForAdminSection: vi.fn(),
  getMatchTabCounts: vi.fn(),
}));

vi.mock('@/app/lib/db/queries', () => ({
  getPublicMatchesPage: mocks.getPublicMatchesPage,
  getMatchesPage: mocks.getMatchesPage,
  getMatchTabCounts: mocks.getMatchTabCounts,
}));
vi.mock('../db/queries', () => ({
  getPublicMatchesPage: mocks.getPublicMatchesPage,
  getMatchesPage: mocks.getMatchesPage,
  getMatchTabCounts: mocks.getMatchTabCounts,
}));
vi.mock('../auth', () => ({ getStaffForAdminSection: mocks.getStaffForAdminSection }));

import { fetchMatchesPage, fetchStaffMatchesPage, fetchStaffMatchTabCounts } from '../match-actions';

const SEASON = '11111111-1111-4111-8111-111111111111';
const emptyPage = { items: [], nextCursor: null };

describe('match page server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicMatchesPage.mockResolvedValue(emptyPage);
    mocks.getMatchesPage.mockResolvedValue(emptyPage);
  });

  it('the public action always reads through the redacting query, never the raw one', async () => {
    await fetchMatchesPage({ seasonId: SEASON, division: 'Varsity' });
    expect(mocks.getPublicMatchesPage).toHaveBeenCalledTimes(1);
    expect(mocks.getMatchesPage).not.toHaveBeenCalled();
    expect(mocks.getStaffForAdminSection).not.toHaveBeenCalled();
  });

  it('the public action ignores a status filter so forfeits cannot be probed in hidden seasons', async () => {
    await fetchMatchesPage({ seasonId: SEASON, status: 'forfeit' });
    expect(mocks.getPublicMatchesPage.mock.calls[0][0].status).toBeUndefined();
  });

  it('the public action does not trust a client-supplied season to be published', async () => {
    // It passes the id through; deciding visibility is the query's job, per match season.
    await fetchMatchesPage({ seasonId: SEASON });
    expect(mocks.getPublicMatchesPage.mock.calls[0][0].seasonId).toBe(SEASON);
  });

  it('the staff action refuses callers without Matches access and returns raw data to staff', async () => {
    mocks.getStaffForAdminSection.mockResolvedValue(null);
    await expect(fetchStaffMatchesPage({ seasonId: SEASON })).rejects.toThrow('Forbidden');
    expect(mocks.getMatchesPage).not.toHaveBeenCalled();

    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff' });
    await fetchStaffMatchesPage({ seasonId: SEASON, status: 'forfeit' });
    expect(mocks.getMatchesPage).toHaveBeenCalledTimes(1);
    expect(mocks.getMatchesPage.mock.calls[0][0].status).toBe('forfeit');
    expect(mocks.getPublicMatchesPage).not.toHaveBeenCalled();
  });
});

describe('staff status tabs and counts (spec-030)', () => {
  const counts = { 'needs-results': 2, upcoming: 3, completed: 4, all: 9 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicMatchesPage.mockResolvedValue(emptyPage);
    mocks.getMatchesPage.mockResolvedValue(emptyPage);
    mocks.getMatchTabCounts.mockResolvedValue(counts);
  });

  it('the public action drops the tab filter so Completed cannot probe hidden seasons', async () => {
    await fetchMatchesPage({ seasonId: SEASON, tab: 'completed' });
    expect(mocks.getPublicMatchesPage.mock.calls[0][0].tab).toBeUndefined();
  });

  it('the staff page action validates the tab and uses the server clock', async () => {
    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff' });
    await fetchStaffMatchesPage({ tab: 'needs-results', sort: 'asc' });
    const params = mocks.getMatchesPage.mock.calls.at(-1)![0];
    expect(params.tab).toBe('needs-results');
    expect(params.now).toBeInstanceOf(Date);
    await fetchStaffMatchesPage({ tab: 'bogus' });
    expect(mocks.getMatchesPage.mock.calls.at(-1)![0].tab).toBeUndefined();
  });

  it('the staff counts action is staff-guarded for Matches and only forwards facets', async () => {
    mocks.getStaffForAdminSection.mockResolvedValue(null);
    await expect(fetchStaffMatchTabCounts({ seasonId: SEASON })).rejects.toThrow('Forbidden');
    expect(mocks.getMatchTabCounts).not.toHaveBeenCalled();

    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff' });
    const GAME = '22222222-2222-4222-8222-222222222222';
    const res = await fetchStaffMatchTabCounts({
      gameId: GAME, seasonId: SEASON, division: 'JV', search: 'bronx', tab: 'completed', sort: 'asc',
      cursor: { scheduledAt: '2026-10-01T00:00:00Z', id: SEASON },
    });
    expect(res).toEqual(counts);
    expect(mocks.getStaffForAdminSection).toHaveBeenLastCalledWith('/admin/matches');
    const params = mocks.getMatchTabCounts.mock.calls.at(-1)![0];
    expect(params).toMatchObject({ gameId: GAME, seasonId: SEASON, division: 'JV', search: 'bronx' });
    expect(params).not.toHaveProperty('tab');
    expect(params).not.toHaveProperty('cursor');
    expect(params.now).toBeInstanceOf(Date);
  });
});

describe('staff match reads stay raw with season and game filters (spec-022, spec-025)', () => {
  it('passes game and season through the raw query, never the redacting one', async () => {
    mocks.getMatchesPage.mockResolvedValue(emptyPage);
    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff' });
    const GAME = '22222222-2222-4222-8222-222222222222';
    await fetchStaffMatchesPage({ gameId: GAME, seasonId: SEASON, status: 'completed' });
    const params = mocks.getMatchesPage.mock.calls.at(-1)![0];
    expect(params).toMatchObject({ gameId: GAME, seasonId: SEASON, status: 'completed' });
    expect(mocks.getPublicMatchesPage).not.toHaveBeenCalled();
  });

  it('ignores a malformed game or season id instead of erroring', async () => {
    mocks.getMatchesPage.mockResolvedValue(emptyPage);
    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff' });
    await fetchStaffMatchesPage({ gameId: 'nope', seasonId: 'x' });
    const params = mocks.getMatchesPage.mock.calls.at(-1)![0];
    expect(params.gameId).toBeUndefined();
    expect(params.seasonId).toBeUndefined();
  });
});
