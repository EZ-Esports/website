import { describe, expect, it } from 'vitest';
import {
  areOutcomesPublic,
  redactHiddenMatches,
  redactMatchOutcome,
  redactStandingRows,
} from '@/app/lib/season-outcomes';

describe('areOutcomesPublic', () => {
  it('is hidden until a finalize timestamp exists', () => {
    expect(areOutcomesPublic({ outcomesFinalizedAt: null })).toBe(false);
    expect(areOutcomesPublic({})).toBe(false);
    expect(areOutcomesPublic(null)).toBe(false);
    expect(areOutcomesPublic(undefined)).toBe(false);
  });

  it('is public once finalized, as a Date or a cache-serialized string', () => {
    expect(areOutcomesPublic({ outcomesFinalizedAt: new Date('2026-10-18') })).toBe(true);
    expect(areOutcomesPublic({ outcomesFinalizedAt: '2026-10-18T00:00:00.000Z' })).toBe(true);
  });
});

describe('redactStandingRows', () => {
  const rows = [
    { schoolName: 'Zeta High', division: 'Varsity', rank: 1, wins: 9, losses: 0, gamesPlayed: 9, winPct: 1, points: null, playerName: null, notes: 'Derived from match results' },
    { schoolName: 'Alpha High', division: 'Varsity', rank: 2, wins: 5, losses: 4, gamesPlayed: 9, winPct: 0.55, points: null, playerName: null, notes: null },
    { schoolName: 'Mid High', division: 'Varsity', rank: 3, wins: 1, losses: 8, gamesPlayed: 9, winPct: 0.11, points: null, playerName: null, notes: null },
  ];

  it('nulls every result stat and lists teams alphabetically so order cannot encode rank', () => {
    const out = redactStandingRows(rows);
    expect(out.map((r) => r.schoolName)).toEqual(['Alpha High', 'Mid High', 'Zeta High']);
    for (const r of out) {
      expect(r.rank).toBeNull();
      expect(r.wins).toBeNull();
      expect(r.losses).toBeNull();
      expect(r.gamesPlayed).toBeNull();
      expect(r.winPct).toBeNull();
      expect(r.notes).toBeNull();
    }
    expect(JSON.stringify(out)).not.toMatch(/Derived|0\.55/);
  });

  it('does not mutate its input', () => {
    redactStandingRows(rows);
    expect(rows[0].rank).toBe(1);
    expect(rows[0].schoolName).toBe('Zeta High');
  });

  it('hides individual points (including the notes blob) and sorts players by name', () => {
    const players = [
      { schoolName: 'B School', division: 'All', rank: 1, points: 120, playerName: 'Zed', notes: 'Total Points: 120.0 | Discord: z#1' },
      { schoolName: 'A School', division: 'All', rank: 2, points: 80, playerName: 'Amy', notes: 'Total Points: 80.0' },
    ];
    const out = redactStandingRows(players);
    expect(out.map((p) => p.playerName)).toEqual(['Amy', 'Zed']);
    expect(out.every((p) => p.points === null && p.notes === null && p.rank === null)).toBe(true);
  });
});

describe('redactMatchOutcome', () => {
  const played = {
    id: 'm1',
    seasonId: 's1',
    status: 'completed',
    homeScore: 2 as number | null,
    awayScore: 1 as number | null,
    mvp: 'Ace',
    notes: 'Home won 2-1',
    homeTeam: 'A',
  };

  it('strips scores, MVP and notes but keeps the fixture', () => {
    expect(redactMatchOutcome(played)).toEqual({
      ...played,
      homeScore: null,
      awayScore: null,
      mvp: null,
      notes: null,
    });
  });

  it('reads a forfeit as a plain completed match', () => {
    expect(redactMatchOutcome({ ...played, status: 'forfeit' }).status).toBe('completed');
  });

  it('leaves non-result statuses alone', () => {
    expect(
      redactMatchOutcome({ ...played, status: 'scheduled', homeScore: null, awayScore: null }).status,
    ).toBe('scheduled');
  });
});

describe('redactHiddenMatches', () => {
  it('redacts only matches whose season is not published', () => {
    const matches = [
      { seasonId: 'pub', status: 'completed', homeScore: 3 as number | null, awayScore: 0 as number | null },
      { seasonId: 'hidden', status: 'completed', homeScore: 3 as number | null, awayScore: 0 as number | null },
    ];
    const out = redactHiddenMatches(matches, new Set(['pub']));
    expect(out[0].homeScore).toBe(3);
    expect(out[1].homeScore).toBeNull();
    expect(out[1].awayScore).toBeNull();
  });

  it('hides everything when no season is published (fail closed)', () => {
    const out = redactHiddenMatches(
      [{ seasonId: 'x', status: 'completed', homeScore: 1 as number | null, awayScore: 0 as number | null }],
      new Set(),
    );
    expect(out[0].homeScore).toBeNull();
  });
});
