import { describe, it, expect } from 'vitest';
import { isPastSeason, pastSeasonViewOnlyError } from '../season-name';

const s = (name: string, isActive = false) => ({ name, isActive });

describe('isPastSeason (spec-028)', () => {
  it('with an active season: older inactive is past, the active one and newer inactive are not', () => {
    const all = [s('2024-25'), s('2025-26'), s('2026-27', true), s('2027-28')];
    expect(isPastSeason(all[0], all)).toBe(true);
    expect(isPastSeason(all[1], all)).toBe(true);
    expect(isPastSeason(all[2], all)).toBe(false);
    expect(isPastSeason(all[3], all)).toBe(false); // upcoming/prep season stays editable
  });

  it('with no active season: a season with a newer-named sibling is past, the newest is not', () => {
    const all = [s('2025-26'), s('2026-27'), s('2027-28')];
    expect(isPastSeason(all[0], all)).toBe(true);
    expect(isPastSeason(all[1], all)).toBe(true);
    expect(isPastSeason(all[2], all)).toBe(false);
  });

  it('a single season is never past, active or not', () => {
    expect(isPastSeason(s('2026-27'), [s('2026-27')])).toBe(false);
    expect(isPastSeason(s('2026-27', true), [s('2026-27', true)])).toBe(false);
  });

  it('an active season is never past, even when a newer season exists', () => {
    const all = [s('2025-26', true), s('2026-27')];
    expect(isPastSeason(all[0], all)).toBe(false);
  });

  it('does not depend on input order', () => {
    const all = [s('2027-28'), s('2026-27', true), s('2024-25'), s('2025-26')];
    expect(all.map((x) => isPastSeason(x, all))).toEqual([false, false, true, true]);
  });

  it('formats the view-only error', () => {
    expect(pastSeasonViewOnlyError('2025-26')).toBe('2025-26 is a past season and is view-only.');
  });
});
