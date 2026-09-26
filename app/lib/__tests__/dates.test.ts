import { describe, it, expect } from 'vitest';
import { parseEastern, formatNY } from '../dates';

describe('parseEastern', () => {
  it('parses daylight saving time (EDT, UTC-4) datetime-local inputs', () => {
    // 7:00 PM EDT on July 15, 2026 -> 23:00:00 UTC
    const d = parseEastern('2026-07-15T19:00');
    expect(d.toISOString()).toBe('2026-07-15T23:00:00.000Z');
  });

  it('parses standard time (EST, UTC-5) datetime-local inputs', () => {
    // 7:00 PM EST on January 15, 2026 -> 00:00:00 UTC on Jan 16
    const d = parseEastern('2026-01-15T19:00');
    expect(d.toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('parses space-separated spreadsheet / database seed format', () => {
    const d1 = parseEastern('2026-09-18 19:00:00');
    expect(d1.toISOString()).toBe('2026-09-18T23:00:00.000Z');

    const d2 = parseEastern('2026-01-15 19:00:00');
    expect(d2.toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('handles optional seconds in input strings', () => {
    const withSec = parseEastern('2026-09-18T19:00:30');
    expect(withSec.toISOString()).toBe('2026-09-18T23:00:30.000Z');

    const spaceWithoutSec = parseEastern('2026-09-18 19:00');
    expect(spaceWithoutSec.toISOString()).toBe('2026-09-18T23:00:00.000Z');
  });

  it('correctly handles DST spring-forward boundary (March 8, 2026)', () => {
    // 1:00 AM EST (before 2 AM transition) is UTC-5 -> 06:00 UTC
    const beforeDst = parseEastern('2026-03-08T01:00');
    expect(beforeDst.toISOString()).toBe('2026-03-08T06:00:00.000Z');

    // 3:00 AM EDT (after transition) is UTC-4 -> 07:00 UTC
    const afterDst = parseEastern('2026-03-08T03:00');
    expect(afterDst.toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });

  it('correctly handles DST fall-back boundary (November 1, 2026)', () => {
    // Picks the first (EDT) occurrence for an ambiguous fall-back time (01:30 AM)
    expect(parseEastern('2026-11-01T01:30').toISOString()).toBe('2026-11-01T05:30:00.000Z');

    // Noon on October 31 (EDT, UTC-4) -> 16:00 UTC
    const edtDate = parseEastern('2026-10-31T12:00');
    expect(edtDate.toISOString()).toBe('2026-10-31T16:00:00.000Z');

    // Noon on November 2 (EST, UTC-5) -> 17:00 UTC
    const estDate = parseEastern('2026-11-02T12:00');
    expect(estDate.toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });

  it('rejects non-existent wall times during spring-forward transition', () => {
    // 2:30 AM does not exist on March 8, 2026 in America/New_York
    expect(Number.isNaN(parseEastern('2026-03-08T02:30').getTime())).toBe(true);
  });

  it('rejects out-of-range or rolled over dates', () => {
    expect(Number.isNaN(parseEastern('2026-02-30T10:00').getTime())).toBe(true);
    expect(Number.isNaN(parseEastern('2026-07-15T25:00').getTime())).toBe(true);
    expect(Number.isNaN(parseEastern('2026-04-31T12:00').getTime())).toBe(true);
  });

  it('returns invalid date for empty or malformed inputs', () => {
    expect(Number.isNaN(parseEastern('').getTime())).toBe(true);
    expect(Number.isNaN(parseEastern('   ').getTime())).toBe(true);
    expect(Number.isNaN(parseEastern('invalid-date').getTime())).toBe(true);
  });
});

describe('formatNY', () => {
  it('formats time with explicit ET suffix', () => {
    const edtDate = new Date('2026-07-15T23:00:00.000Z');
    expect(formatNY(edtDate, 'time')).toBe('7:00 PM ET');

    const estDate = new Date('2026-01-16T00:00:00.000Z');
    expect(formatNY(estDate, 'time')).toBe('7:00 PM ET');
  });

  it('supports time-bare without ET suffix', () => {
    const edtDate = new Date('2026-07-15T23:00:00.000Z');
    expect(formatNY(edtDate, 'time-bare')).toBe('7:00 PM');
  });

  it('formats ymd in America/New_York regardless of UTC date crossing', () => {
    // 11:00 PM EDT on July 15 is 03:00 UTC on July 16
    const lateNightMatch = new Date('2026-07-16T03:00:00.000Z');
    expect(formatNY(lateNightMatch, 'ymd')).toBe('2026-07-15');

    // 1:00 AM EDT on July 16 is 05:00 UTC on July 16 (and 10:00 PM PT on July 15)
    const earlyMorningMatch = new Date('2026-07-16T05:00:00.000Z');
    expect(formatNY(earlyMorningMatch, 'ymd')).toBe('2026-07-16');
  });

  it('round-trips between parseEastern and formatNY', () => {
    const input = '2026-09-18T19:00';
    const parsed = parseEastern(input);
    expect(formatNY(parsed, 'time')).toBe('7:00 PM ET');
    expect(formatNY(parsed, 'ymd')).toBe('2026-09-18');
  });
});
