import { describe, it, expect } from 'vitest';
import {
  isValidSeasonName,
  seasonNameFromStartYear,
  SEASON_NAME_OPTIONS,
  MANAGER_SEASON_OPTIONS,
  DEFAULT_MANAGER_SEASON,
} from '@/app/lib/season-name';

describe('season name format (YYYY-YY)', () => {
  it('builds the canonical name from a start year', () => {
    expect(seasonNameFromStartYear(2025)).toBe('2025-26');
    expect(seasonNameFromStartYear(2021)).toBe('2021-22');
    expect(seasonNameFromStartYear(2099)).toBe('2099-00');
  });

  it('accepts only YYYY-YY where the second part is first year + 1', () => {
    expect(isValidSeasonName('2025-26')).toBe(true);
    expect(isValidSeasonName('2021-22')).toBe(true);
    expect(isValidSeasonName('2099-00')).toBe(true);
    expect(isValidSeasonName('2025-27')).toBe(false);
    expect(isValidSeasonName('2025-25')).toBe(false);
    expect(isValidSeasonName('2025-2026')).toBe(false);
    expect(isValidSeasonName('25-26')).toBe(false);
    expect(isValidSeasonName('Spring 2025')).toBe(false);
    expect(isValidSeasonName('')).toBe(false);
    expect(isValidSeasonName(' 2025-26')).toBe(false);
    expect(isValidSeasonName(null)).toBe(false);
    expect(isValidSeasonName(2025)).toBe(false);
  });

  it('every offered option is itself valid, and the archive seasons are selectable', () => {
    for (const name of [...SEASON_NAME_OPTIONS, ...MANAGER_SEASON_OPTIONS]) {
      expect(isValidSeasonName(name)).toBe(true);
    }
    expect(SEASON_NAME_OPTIONS).toContain('2021-22');
    expect(SEASON_NAME_OPTIONS).toContain('2026-27');
    expect(isValidSeasonName(DEFAULT_MANAGER_SEASON)).toBe(true);
    expect(MANAGER_SEASON_OPTIONS).toContain(DEFAULT_MANAGER_SEASON);
  });
});
