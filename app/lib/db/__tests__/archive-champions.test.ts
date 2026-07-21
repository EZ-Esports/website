import { describe, expect, it } from 'vitest';
import { pickChampionsBySeason } from '@/app/lib/db/queries';

// getArchiveIndex() itself hits a live DB connection, so it isn't unit-tested
// here. pickChampionsBySeason() is the pure division-priority logic that both
// `champion` (Archives cards) and `championSchool` (Command Deck stat tile)
// depend on, so it's the part worth covering in isolation.
describe('pickChampionsBySeason', () => {
  it('prefers Varsity over All over JV for the same season', () => {
    const result = pickChampionsBySeason([
      { seasonId: 's1', division: 'JV', schoolName: 'JV School', playerName: null },
      { seasonId: 's1', division: 'All', schoolName: 'All School', playerName: null },
      { seasonId: 's1', division: 'Varsity', schoolName: 'Varsity School', playerName: null },
    ]);

    expect(result.get('s1')).toEqual({ champion: 'Varsity School', championSchool: 'Varsity School' });
  });

  it('falls back to All, then JV, when Varsity is absent', () => {
    const allOnly = pickChampionsBySeason([
      { seasonId: 's1', division: 'All', schoolName: 'All School', playerName: null },
    ]);
    expect(allOnly.get('s1')?.champion).toBe('All School');

    const jvOnly = pickChampionsBySeason([
      { seasonId: 's1', division: 'JV', schoolName: 'JV School', playerName: null },
    ]);
    expect(jvOnly.get('s1')?.champion).toBe('JV School');
  });

  it('uses the player name as champion but the school name as championSchool for individual-format divisions', () => {
    const result = pickChampionsBySeason([
      { seasonId: 'tft-season', division: 'All', schoolName: 'Brooklyn Tech', playerName: 'PlayerOne' },
    ]);

    expect(result.get('tft-season')).toEqual({
      champion: 'PlayerOne',
      championSchool: 'Brooklyn Tech',
    });
  });

  it('does not include a season with no rank-1 standings row', () => {
    const result = pickChampionsBySeason([
      { seasonId: 's1', division: 'Varsity', schoolName: 'Only School', playerName: null },
    ]);

    expect(result.has('s2')).toBe(false);
    expect(result.get('s2')).toBeUndefined();
  });

  it('keeps distinct seasons independent of each other', () => {
    const result = pickChampionsBySeason([
      { seasonId: 's1', division: 'Varsity', schoolName: 'School A', playerName: null },
      { seasonId: 's2', division: 'JV', schoolName: 'School B', playerName: null },
    ]);

    expect(result.get('s1')?.championSchool).toBe('School A');
    expect(result.get('s2')?.championSchool).toBe('School B');
  });
});
