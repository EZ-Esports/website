import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicMatchesPage: vi.fn(),
  getMatchesPage: vi.fn(),
  getStaffForAdminSection: vi.fn(),
}));

vi.mock('@/app/lib/db/queries', () => ({
  getPublicMatchesPage: mocks.getPublicMatchesPage,
  getMatchesPage: mocks.getMatchesPage,
}));
vi.mock('../db/queries', () => ({
  getPublicMatchesPage: mocks.getPublicMatchesPage,
  getMatchesPage: mocks.getMatchesPage,
}));
vi.mock('../auth', () => ({ getStaffForAdminSection: mocks.getStaffForAdminSection }));

import { fetchMatchesPage, fetchStaffMatchesPage } from '../match-actions';

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
