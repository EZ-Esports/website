import { describe, expect, it } from 'vitest';
import { canonicalDivision, standingsTeamLabel, toStandingsFormat } from '@/app/lib/db/match-page';

describe('standings snapshot vs computed preference & standings_format', () => {
  it('canonicalizes division spellings consistently', () => {
    expect(canonicalDivision('Varsity')).toBe('Varsity');
    expect(canonicalDivision('A')).toBe('Varsity');
    expect(canonicalDivision('JV')).toBe('JV');
    expect(canonicalDivision('B')).toBe('JV');
    // Unrecognised values always map to Varsity (never null / invisible)
    expect(canonicalDivision('Unknown')).toBe('Varsity');
    expect(canonicalDivision(null)).toBe('Varsity');
  });

  it('formats team labels cleanly depending on standingsFormat', () => {
    const entry = { schoolName: 'Midwood High School', division: 'JV' };
    expect(standingsTeamLabel(entry, 'divided')).toBe('Midwood High School');
    expect(standingsTeamLabel(entry, 'combined')).toBe('Midwood High School — JV');
  });

  it('toStandingsFormat narrows raw DB strings safely', () => {
    expect(toStandingsFormat('combined')).toBe('combined');
    expect(toStandingsFormat('divided')).toBe('divided');
    // Unknown / null / undefined DB values default to the safe 'divided' fallback
    expect(toStandingsFormat(null)).toBe('divided');
    expect(toStandingsFormat(undefined)).toBe('divided');
    expect(toStandingsFormat('bogus')).toBe('divided');
  });

  it('getTeamStandingsRecords returns empty Map for empty input without hitting the DB', async () => {
    // Dynamic import to avoid top-level import of DB-initialising module
    const { getTeamStandingsRecords } = await import('@/app/lib/db/queries');
    expect(typeof getTeamStandingsRecords).toBe('function');
    const result = await getTeamStandingsRecords([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('exports getActiveSeasonForGame, getLeagueAdminData, and DAL query functions', async () => {
    const {
      getActiveSeasonForGame,
      getGameTeamsPageData,
      getSchoolGameTeamsPageData,
      getLeagueAdminData,
      NEWS_PAGE_SIZE,
    } = await import('@/app/lib/db/queries');
    expect(typeof getActiveSeasonForGame).toBe('function');
    expect(typeof getGameTeamsPageData).toBe('function');
    expect(typeof getSchoolGameTeamsPageData).toBe('function');
    expect(typeof getLeagueAdminData).toBe('function');
    expect(NEWS_PAGE_SIZE).toBe(20);
  });
});

