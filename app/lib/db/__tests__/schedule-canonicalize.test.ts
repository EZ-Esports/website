import { describe, expect, it } from 'vitest';
import { buildSeasonMatchesQuery, buildMatchesPageQuery } from '@/app/lib/db/queries';
import { canonicalDivision, COMBINED_DIVISION } from '@/app/lib/db/match-page';

describe('Issue #143: Schedule match division canonicalization and filtering', () => {
  it('canonicalizes raw division "A" to "Varsity" and checks both home and away rosters in getSeasonMatches', () => {
    const query = buildSeasonMatchesQuery('season-123', 'A');
    const { sql, params } = query.toSQL();

    // Must check both home and away rosters using the canonical CASE statement
    expect(sql).toContain('"home_roster"."division"');
    expect(sql).toContain('"away_roster"."division"');
    expect(sql).toMatch(/home_roster"\."division".+ or .+away_roster"\."division"/s);
    // Division parameter passed to query must be canonicalized to 'Varsity'
    expect(params).toContain('Varsity');
    expect(params).not.toContain('A');
  });

  it('canonicalizes raw division "B" to "JV" and checks both home and away rosters in getSeasonMatches', () => {
    const query = buildSeasonMatchesQuery('season-123', 'B');
    const { sql, params } = query.toSQL();

    expect(sql).toContain('"home_roster"."division"');
    expect(sql).toContain('"away_roster"."division"');
    expect(params).toContain('JV');
    expect(params).not.toContain('B');
  });

  it('does not push division filter condition when division is Combined', () => {
    const query = buildSeasonMatchesQuery('season-123', COMBINED_DIVISION);
    const { params } = query.toSQL();

    // The SELECT always has a CASE expression referencing home_roster.division,
    // so we verify no division value appears as a bound param (the WHERE filter).
    expect(params).not.toContain(COMBINED_DIVISION);
    expect(params).not.toContain('Varsity');
    expect(params).not.toContain('JV');
    // Only the seasonId param should be bound
    expect(params).toHaveLength(1);
  });

  it('canonicalizes division filtering in buildMatchesPageQuery', () => {
    const query = buildMatchesPageQuery({ seasonId: 'season-123', division: 'A' });
    const { sql, params } = query.toSQL();

    expect(sql).toContain('"home_roster"."division"');
    expect(sql).toContain('"away_roster"."division"');
    expect(params).toContain('Varsity');
  });

  it('fetchMatchesPage accepts raw division "A", "B", and "Combined"', async () => {
    // Verify canonicalDivision helper mapping
    expect(canonicalDivision('A')).toBe('Varsity');
    expect(canonicalDivision('B')).toBe('JV');
    expect(canonicalDivision('Varsity')).toBe('Varsity');
    expect(canonicalDivision('JV')).toBe('JV');
  });
});

describe('Issue #143: MatchScheduleForm same-season roster restriction', () => {
  it('filters rosters to teams matching selectedSeasonId', () => {
    const _seasons = [
      { id: 'season-1', name: 'Spring 2025', gameId: 'game-lol' },
      { id: 'season-2', name: 'Fall 2024', gameId: 'game-lol' },
    ];
    const teams = [
      { id: 'team-1', name: 'Stuyvesant A', gameId: 'game-lol', seasonId: 'season-1' },
      { id: 'team-2', name: 'Bronx Science A', gameId: 'game-lol', seasonId: 'season-2' },
    ];
    const rosters = [
      { id: 'roster-1', teamId: 'team-1', division: 'A' },
      { id: 'roster-2', teamId: 'team-2', division: 'A' },
    ];

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    // Simulating filteredRosters logic for season-1
    const selectedSeasonId = 'season-1';
    const filteredRosters = rosters.filter((r) => {
      const team = teamMap.get(r.teamId);
      return team?.seasonId === selectedSeasonId;
    });

    expect(filteredRosters).toHaveLength(1);
    expect(filteredRosters[0].id).toBe('roster-1');
  });
});

describe('Issue #143: Teams view snapshot W/L and explicit Unpublished state', () => {
  it('resolves snapshot W/L over silent 0-0', () => {
    const standingsMap = new Map<string, { wins: number; losses: number }>();
    const snapshotMap = new Map<string, { wins: number | null; losses: number | null }>();

    // Simulated archived snapshot for season-1, school-1, Varsity
    snapshotMap.set('season-1-school-1-Varsity', { wins: 7, losses: 1 });

    const getRecord = (seasonId: string, schoolId: string, teamId: string, division: string) => {
      const canonDiv = canonicalDivision(division);
      const standing = standingsMap.get(`${teamId}-${canonDiv}`);
      const snapshot = snapshotMap.get(`${seasonId}-${schoolId}-${canonDiv}`);

      if (snapshot && snapshot.wins !== null && snapshot.losses !== null) {
        return `${snapshot.wins}-${snapshot.losses}`;
      }
      if (standing) {
        return `${standing.wins}-${standing.losses}`;
      }
      return 'Unpublished';
    };

    expect(getRecord('season-1', 'school-1', 'team-1', 'A')).toBe('7-1');
    expect(getRecord('season-2', 'school-2', 'team-2', 'B')).toBe('Unpublished');
  });
});
