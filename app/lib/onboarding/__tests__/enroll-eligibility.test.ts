import { describe, expect, it } from 'vitest';
import {
  hasAcceptedApplicationForSeason,
  notOnboardedForSeasonError,
  type EnrollmentInvite,
} from '../enroll-eligibility';

const inv = (status: string, seasonId: string | null = 's1', gameId: string | null = 'g1'): EnrollmentInvite => ({ gameId, seasonId, status });
const ok = (invites: EnrollmentInvite[]) => hasAcceptedApplicationForSeason(invites, 'g1', 's1');

describe('hasAcceptedApplicationForSeason', () => {
  it('needs an accepted application for the game and season', () => {
    expect(ok([inv('accepted')])).toBe(true);
    expect(ok([inv('rejected'), inv('accepted')])).toBe(true);
  });
  it('is false with no application, or anything that is not accepted', () => {
    expect(ok([])).toBe(false);
    for (const st of ['submitted', 'pending', 'rejected', 'expired']) expect(ok([inv(st)])).toBe(false);
  });
  it('is false for an accepted application of another season, no season, or another game', () => {
    expect(ok([inv('accepted', 's0')])).toBe(false);
    expect(ok([inv('accepted', null)])).toBe(false);
    expect(ok([inv('accepted', 's1', 'g2')])).toBe(false);
  });
  it('names the season in the refusal', () => {
    expect(notOnboardedForSeasonError('Ada L', '2026-27')).toBe('Ada L has not been onboarded for 2026-27. Send them an invite and approve it first.');
  });
});
