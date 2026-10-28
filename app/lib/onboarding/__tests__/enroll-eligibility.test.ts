import { describe, expect, it } from 'vitest';
import { hasUnacceptedApplication, type EnrollmentInvite } from '../enroll-eligibility';

const inv = (status: string, seasonId: string | null = 's1', gameId: string | null = 'g1'): EnrollmentInvite => ({ gameId, seasonId, status });

describe('hasUnacceptedApplication', () => {
  it('blocks submitted, pending and rejected; ignores expired', () => {
    for (const st of ['submitted', 'pending', 'rejected']) expect(hasUnacceptedApplication([inv(st)], 'g1', 's1')).toBe(true);
    expect(hasUnacceptedApplication([inv('expired')], 'g1', 's1')).toBe(false);
  });
  it('does not block with no applications or an accepted one', () => {
    expect(hasUnacceptedApplication([], 'g1', 's1')).toBe(false);
    expect(hasUnacceptedApplication([inv('accepted')], 'g1', 's1')).toBe(false);
  });
  it('accepted for the roster season wins; accepted for another season does not', () => {
    expect(hasUnacceptedApplication([inv('rejected', 's0'), inv('accepted', 's1')], 'g1', 's1')).toBe(false);
    expect(hasUnacceptedApplication([inv('rejected', 's1'), inv('accepted', 's0')], 'g1', 's1')).toBe(true);
  });
  it('ignores other games', () => {
    expect(hasUnacceptedApplication([inv('rejected', 's1', 'g2')], 'g1', 's1')).toBe(false);
  });
});
