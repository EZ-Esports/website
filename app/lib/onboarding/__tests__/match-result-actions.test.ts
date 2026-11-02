import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelPendingSubmission: vi.fn(),
  loadRows: vi.fn(),
  assertManagerForSchoolGame: vi.fn(),
  resolveSeries: vi.fn(),
  saveSeriesResult: vi.fn(),
  upsertPendingSubmission: vi.fn(),
  getPendingSubmissionForMatch: vi.fn(),
  getMatchRosterRiotIds: vi.fn(),
  reserveSubmissionAttempt: vi.fn(),
  fetchMatch: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// A thenable chain standing in for the drizzle select in loadMatch.
vi.mock('@/app/lib/db', () => {
  const chain: Record<string, unknown> = {};
  for (const name of ['from', 'innerJoin', 'where']) chain[name] = () => chain;
  chain.limit = () => mocks.loadRows();
  return { db: { select: () => chain } };
});
vi.mock('next/cache', () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));
vi.mock('@/app/lib/onboarding/manager-auth', () => ({ assertManagerForSchoolGame: mocks.assertManagerForSchoolGame }));
vi.mock('@/app/lib/db/match-results', () => ({
  cancelPendingSubmission: mocks.cancelPendingSubmission,
  gameRepository: {},
  isUniqueViolation: (e: unknown) => (e as { code?: string })?.code === '23505',
  getMatchRosterRiotIds: mocks.getMatchRosterRiotIds,
  reserveSubmissionAttempt: mocks.reserveSubmissionAttempt,
  getMatchScoreboard: vi.fn(),
  getPendingSubmissionForMatch: mocks.getPendingSubmissionForMatch,
  saveSeriesResult: mocks.saveSeriesResult,
  upsertPendingSubmission: mocks.upsertPendingSubmission,
}));
vi.mock('@/app/lib/match-results/resolve-series', () => ({ resolveSeries: mocks.resolveSeries }));
vi.mock('@/app/lib/match-results/server', () => ({ getMatchDataPort: () => ({ fetchMatch: mocks.fetchMatch }) }));

import { retryMatchResult, submitMatchResult } from '../match-result-actions';

const ID_1 = '00000000-0000-4000-8000-000000000001';
const ID_2 = '00000000-0000-4000-8000-000000000002';

const matchRow = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  seasonId: 's1',
  gameId: 'g1',
  gameSlug: 'valorant',
  status: 'scheduled',
  scheduledAt: new Date('2026-10-20T23:00:00.000Z'),
  homeScore: null,
  homeRosterId: 'hr',
  awayRosterId: 'ar',
  homeSchoolId: 'school-a',
  homeSchoolName: 'A',
  awaySchoolId: 'school-b',
  awaySchoolName: 'B',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadRows.mockResolvedValue([matchRow()]);
  mocks.assertManagerForSchoolGame.mockResolvedValue({
    context: { userId: 'u1', isStaffAdmin: false },
    season: { id: 's1' },
  });
  mocks.getMatchRosterRiotIds.mockResolvedValue({ home: new Set(), away: new Set() });
  mocks.reserveSubmissionAttempt.mockResolvedValue({ ok: true });
});

describe('submitMatchResult', () => {
  it('rejects malformed input before touching the database or the API', async () => {
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: 'garbage' });
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(mocks.loadRows).not.toHaveBeenCalled();
    expect(mocks.resolveSeries).not.toHaveBeenCalled();
  });

  it('refuses a school that is not playing in the match', async () => {
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-z', input: `${ID_1} ${ID_2}` });
    expect(result).toMatchObject({ success: false, error: 'Your school is not playing in this match.' });
    expect(mocks.resolveSeries).not.toHaveBeenCalled();
  });

  it('refuses a manager whose season is not the match season', async () => {
    mocks.assertManagerForSchoolGame.mockResolvedValue({ context: { userId: 'u1', isStaffAdmin: false }, season: { id: 'other' } });
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` });
    expect(result.error).toBe('This match is not in your season.');
  });

  it('lets a staff admin submit as the viewed school, attributing the attempt to the staff user (spec-055)', async () => {
    mocks.assertManagerForSchoolGame.mockResolvedValue({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });
    mocks.resolveSeries.mockResolvedValue({ status: 'ok', series: { homeWins: 2, awayWins: 0, winner: 'home', games: [] }, games: [] });
    mocks.saveSeriesResult.mockResolvedValue(true);
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` });
    expect(result).toEqual({ success: true, summary: '2-0' });
    expect(mocks.reserveSubmissionAttempt).toHaveBeenCalledWith({ matchId: 'm1', userId: 'staff-1' });
  });

  it('still refuses a staff admin acting as a school that is not in the match', async () => {
    mocks.assertManagerForSchoolGame.mockResolvedValue({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-z', input: `${ID_1} ${ID_2}` });
    expect(result.error).toBe('Your school is not playing in this match.');
  });

  it('refuses a match that already has a result, and non-Valorant games', async () => {
    mocks.loadRows.mockResolvedValue([matchRow({ status: 'completed', homeScore: 2 })]);
    expect((await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` })).error).toContain('already has a result');
    mocks.loadRows.mockResolvedValue([matchRow({ gameSlug: 'tetris' })]);
    expect((await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` })).error).toContain('for Valorant');
    expect(mocks.resolveSeries).not.toHaveBeenCalled();
  });

  it('saves the series, invalidates the match caches and reports the score from the submitter side', async () => {
    mocks.resolveSeries.mockResolvedValue({ status: 'ok', series: { homeWins: 2, awayWins: 1, winner: 'home', games: [] }, games: [] });
    mocks.saveSeriesResult.mockResolvedValue(true);
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-b', input: `${ID_1} ${ID_2}` });
    expect(result).toEqual({ success: true, summary: '1-2' });
    expect(mocks.updateTag).toHaveBeenCalledWith('matches');
    expect(mocks.updateTag).toHaveBeenCalledWith('rosters');
    expect(mocks.updateTag).toHaveBeenCalledWith('teams');
  });

  it('stops a fresh submission the throttle refuses, before any lookup or API call', async () => {
    mocks.reserveSubmissionAttempt.mockResolvedValue({ ok: false, waitSeconds: 20, message: 'Wait 20 seconds before submitting again.' });
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` });
    expect(result).toEqual({ success: false, error: 'Wait 20 seconds before submitting again.' });
    expect(mocks.resolveSeries).not.toHaveBeenCalled();
  });

  it('says a game is already counted when the unique index fires, and when the match was completed meanwhile', async () => {
    mocks.resolveSeries.mockResolvedValue({ status: 'ok', series: { homeWins: 2, awayWins: 0, winner: 'home', games: [] }, games: [] });
    mocks.saveSeriesResult.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    mocks.cancelPendingSubmission.mockClear();
    expect((await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` })).error).toBe(
      'One of these games is already counted for another match.'
    );
    mocks.saveSeriesResult.mockResolvedValueOnce(false);
    expect((await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` })).error).toBe(
      'This match can no longer take a result.'
    );
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('returns the per-game errors when validation fails and writes nothing', async () => {
    mocks.resolveSeries.mockResolvedValue({ status: 'invalid', errors: ['Game 1: not custom'] });
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` });
    expect(result).toMatchObject({ success: false, errors: ['Game 1: not custom'] });
    expect(mocks.saveSeriesResult).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('saves a pending submission with the retry time when the service is rate limited', async () => {
    mocks.resolveSeries.mockResolvedValue({ status: 'pending', message: 'busy', retryAfterSeconds: 30, fetchedCount: 1 });
    const result = await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` });
    expect(result).toMatchObject({ success: false, pending: true });
    const saved = mocks.upsertPendingSubmission.mock.calls[0][0];
    expect(saved).toMatchObject({ matchId: 'm1', schoolId: 'school-a', riotMatchIds: [ID_1, ID_2] });
    expect(saved.retryAfter.getTime()).toBeGreaterThan(Date.now());
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});

describe('retryMatchResult', () => {
  it('does not call the API before the service-requested wait has passed', async () => {
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() + 60_000) });
    const result = await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' });
    expect(result).toMatchObject({ success: false, pending: true });
    expect(mocks.resolveSeries).not.toHaveBeenCalled();
  });

  it('resubmits the saved ids once the wait is over', async () => {
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() - 1000) });
    mocks.resolveSeries.mockResolvedValue({ status: 'ok', series: { homeWins: 2, awayWins: 0, winner: 'home', games: [] }, games: [] });
    mocks.saveSeriesResult.mockResolvedValue(true);
    const result = await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' });
    expect(result.success).toBe(true);
    expect(mocks.resolveSeries.mock.calls[0][0].matchIds).toEqual([ID_1, ID_2]);
    // Check again costs the same API calls, so it counts toward the submission limits too.
    expect(mocks.reserveSubmissionAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.cancelPendingSubmission).not.toHaveBeenCalled();
  });

  it('bounds repeated Check again clicks with the throttle and leaves the pending row alone', async () => {
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() - 1000) });
    mocks.reserveSubmissionAttempt.mockResolvedValue({ ok: false, waitSeconds: 12, message: 'Wait 12 seconds before submitting again.' });
    const result = await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' });
    expect(result).toMatchObject({ success: false, pending: true, error: 'Wait 12 seconds before submitting again.' });
    expect(mocks.resolveSeries).not.toHaveBeenCalled();
    expect(mocks.cancelPendingSubmission).not.toHaveBeenCalled();
  });

  it('closes the pending row when the retry is refused as invalid, so nothing is left stuck', async () => {
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() - 1000) });
    mocks.resolveSeries.mockResolvedValue({ status: 'invalid', errors: ['Game 1: not custom'], definitive: true });
    const result = await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' });
    expect(result).toMatchObject({ success: false, errors: ['Game 1: not custom'] });
    expect(mocks.cancelPendingSubmission).toHaveBeenCalledWith('m1');
  });

  it('keeps the pending row when the retry fails for a reason that is not definitive (rotated key, schema drift)', async () => {
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() - 1000) });
    mocks.resolveSeries.mockResolvedValue({ status: 'invalid', errors: ['Game ...000001: not set up'], definitive: false });
    const result = await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' });
    expect(result).toMatchObject({ success: false, errors: ['Game ...000001: not set up'] });
    expect(mocks.cancelPendingSubmission).not.toHaveBeenCalled();
  });

  it('closes the pending row when the save finds the match can no longer take a result (retry and fresh submit)', async () => {
    mocks.resolveSeries.mockResolvedValue({ status: 'ok', series: { homeWins: 2, awayWins: 0, winner: 'home', games: [] }, games: [] });
    mocks.saveSeriesResult.mockResolvedValue(false);
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() - 1000) });
    expect((await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' })).error).toBe('This match can no longer take a result.');
    expect(mocks.cancelPendingSubmission).toHaveBeenCalledTimes(1);
    expect((await submitMatchResult({ matchId: 'm1', schoolId: 'school-a', input: `${ID_1} ${ID_2}` })).error).toBe('This match can no longer take a result.');
    expect(mocks.cancelPendingSubmission).toHaveBeenCalledTimes(2);
  });

  it('keeps the pending row when the retry is still rate limited', async () => {
    mocks.getPendingSubmissionForMatch.mockResolvedValue({ riotMatchIds: [ID_1, ID_2], retryAfter: new Date(Date.now() - 1000) });
    mocks.resolveSeries.mockResolvedValue({ status: 'pending', message: 'busy', retryAfterSeconds: 30, fetchedCount: 0 });
    await retryMatchResult({ matchId: 'm1', schoolId: 'school-a' });
    expect(mocks.cancelPendingSubmission).not.toHaveBeenCalled();
    expect(mocks.upsertPendingSubmission).toHaveBeenCalled();
  });
});
