import { describe, expect, it } from 'vitest';
import { MATCH_COOLDOWN_MS, USER_MAX_PER_WINDOW, USER_WINDOW_MS, throttleDecision } from '../throttle';

const now = new Date('2026-10-27T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('throttleDecision', () => {
  it('allows a first submission', () => {
    expect(throttleDecision({ now, lastForMatch: null, userAttempts: [] })).toEqual({ ok: true });
  });

  it('refuses a second fresh submission for the same match inside 30 seconds and says how long to wait', () => {
    const d = throttleDecision({ now, lastForMatch: ago(10_000), userAttempts: [] });
    expect(d).toMatchObject({ ok: false, waitSeconds: 20 });
    expect(!d.ok && d.message).toContain('20 seconds');
  });

  it('allows it exactly when the 30 seconds have passed', () => {
    expect(throttleDecision({ now, lastForMatch: ago(MATCH_COOLDOWN_MS), userAttempts: [] }).ok).toBe(true);
    expect(throttleDecision({ now, lastForMatch: ago(MATCH_COOLDOWN_MS - 1), userAttempts: [] }).ok).toBe(false);
  });

  it('allows ten submissions per user per hour and refuses the eleventh', () => {
    const nine = Array.from({ length: USER_MAX_PER_WINDOW - 1 }, (_, i) => ago(60_000 * (i + 1)));
    expect(throttleDecision({ now, lastForMatch: null, userAttempts: nine }).ok).toBe(true);
    const ten = [...nine, ago(600_000)];
    const d = throttleDecision({ now, lastForMatch: null, userAttempts: ten });
    expect(d.ok).toBe(false);
  });

  it('tells the user when the oldest attempt ages out', () => {
    const ten = Array.from({ length: 10 }, () => ago(USER_WINDOW_MS - 5 * 60_000)); // oldest is 5 minutes from expiring
    const d = throttleDecision({ now, lastForMatch: null, userAttempts: ten });
    expect(d).toMatchObject({ ok: false, waitSeconds: 300 });
    expect(!d.ok && d.message).toContain('5 minutes');
  });

  it('ignores attempts older than the window', () => {
    const old = Array.from({ length: 12 }, () => ago(USER_WINDOW_MS + 1000));
    expect(throttleDecision({ now, lastForMatch: null, userAttempts: old }).ok).toBe(true);
  });

  it('reports the match cooldown first when both limits apply', () => {
    const ten = Array.from({ length: 10 }, () => ago(1000));
    const d = throttleDecision({ now, lastForMatch: ago(1000), userAttempts: ten });
    expect(!d.ok && d.message).toContain('just submitted');
  });
});
