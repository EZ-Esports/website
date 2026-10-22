import { describe, expect, it } from 'vitest';
import {
  buildGameOptions,
  buildSeasonBlocks,
  defaultExpandedKeys,
  filterBlocksByGame,
  type RosterViewRoster,
  type SchoolRosterTeamInput,
} from '@/app/lib/school-roster-view';

const roster = (id: string, name: string, division: string, players = 0): RosterViewRoster => ({
  id,
  name,
  division,
  players: Array.from({ length: players }, (_, i) => ({
    id: `${id}-p${i}`,
    name: `Player ${i}`,
    ign: null,
    discord: null,
    graduationYear: null,
    role: i === 0 ? 'player' : 'captain',
  })),
});

const team = (over: Partial<SchoolRosterTeamInput> & { teamId: string }): SchoolRosterTeamInput => ({
  gameId: 'g-val',
  gameSlug: 'valorant',
  gameName: 'Valorant',
  seasonId: `s-${over.teamId}`,
  seasonName: '2025-26',
  seasonIsActive: false,
  rostersLockedAt: null,
  rosters: [],
  ...over,
});

describe('buildSeasonBlocks', () => {
  it('orders seasons newest first, unparseable names last, ties broken by game name', () => {
    const blocks = buildSeasonBlocks([
      team({ teamId: 'a', seasonName: '2022-23' }),
      team({ teamId: 'b', seasonName: '2025-26' }),
      team({ teamId: 'c', seasonName: 'Pilot' }),
      team({ teamId: 'd', seasonName: '2023-24' }),
      team({ teamId: 'e', seasonName: '2025-26', gameId: 'g-lol', gameSlug: 'league-of-legends', gameName: 'League of Legends' }),
    ]);
    expect(blocks.map((b) => b.key)).toEqual(['e', 'b', 'd', 'a', 'c']);
  });

  it('puts Varsity left and JV right, mapping A/B and Varsity/JV labels alike', () => {
    const [b] = buildSeasonBlocks([
      team({ teamId: 't', rosters: [roster('r1', 'JV', 'B'), roster('r2', 'Varsity', 'A')] }),
    ]);
    expect(b.layout).toBe('divided');
    expect(b.columns.map((c) => c.division)).toEqual(['Varsity', 'JV']);
    expect(b.columns[0].rosters.map((r) => r.id)).toEqual(['r2']);
    expect(b.columns[1].rosters.map((r) => r.id)).toEqual(['r1']);
  });

  it('marks a missing JV (or Varsity) column for a placeholder when the game has a JV split', () => {
    const [noJv] = buildSeasonBlocks([team({ teamId: 't', rosters: [roster('r1', 'Varsity', 'A')] })]);
    expect(noJv.columns.map((c) => [c.division, c.missing])).toEqual([['Varsity', false], ['JV', true]]);
    const [noVarsity] = buildSeasonBlocks([team({ teamId: 'u', rosters: [roster('r2', 'JV', 'B')] })]);
    expect(noVarsity.columns.map((c) => [c.division, c.missing])).toEqual([['Varsity', true], ['JV', false]]);
  });

  it('gives a game with no JV division one Varsity column, folding "All" onto it', () => {
    const [b] = buildSeasonBlocks([
      team({ teamId: 't', gameSlug: 'minecraft', gameName: 'Minecraft', rosters: [roster('r1', 'Squad', 'All', 2)] }),
    ]);
    expect(b.layout).toBe('single');
    expect(b.columns).toHaveLength(1);
    expect(b.columns[0].division).toBe('Varsity');
    expect(b.columns[0].rosters).toHaveLength(1);
  });

  it('keeps tournament-model games out of the Varsity/JV layout', () => {
    for (const slug of ['team-fight-tactics', 'osu', 'tetr-io']) {
      const [b] = buildSeasonBlocks([team({ teamId: slug, gameSlug: slug, rosters: [roster('r', 'Entrants', 'All')] })]);
      expect(b.layout).toBe('tournament');
      expect(b.columns).toEqual([]);
      expect(b.rosters).toHaveLength(1);
    }
  });

  it('reports roster-lock status per season', () => {
    const [locked, open] = buildSeasonBlocks([
      team({ teamId: 'x', seasonName: '2025-26', rostersLockedAt: new Date('2026-01-02T00:00:00Z') }),
      team({ teamId: 'y', seasonName: '2024-25' }),
    ]);
    expect(locked.rostersLocked).toBe(true);
    expect(open.rostersLocked).toBe(false);
  });

  it('lists captains first within a roster', () => {
    const [b] = buildSeasonBlocks([team({ teamId: 't', rosters: [roster('r', 'Varsity', 'A', 2)] })]);
    expect(b.columns[0].rosters[0].players[0].role).toBe('captain');
  });
});

describe('defaultExpandedKeys', () => {
  it('expands active seasons only, falling back to the newest block', () => {
    const blocks = buildSeasonBlocks([
      team({ teamId: 'old', seasonName: '2022-23' }),
      team({ teamId: 'cur', seasonName: '2025-26', seasonIsActive: true }),
    ]);
    expect(defaultExpandedKeys(blocks)).toEqual(['cur']);
    const none = buildSeasonBlocks([team({ teamId: 'a', seasonName: '2022-23' }), team({ teamId: 'b', seasonName: '2023-24' })]);
    expect(defaultExpandedKeys(none)).toEqual(['b']);
    expect(defaultExpandedKeys([])).toEqual([]);
  });
});

describe('game filter', () => {
  const blocks = buildSeasonBlocks([
    team({ teamId: 'v' }),
    team({ teamId: 'l', gameId: 'g-lol', gameSlug: 'league-of-legends', gameName: 'League of Legends' }),
  ]);
  it('narrows to one game, or keeps all', () => {
    expect(filterBlocksByGame(blocks, 'g-lol').map((b) => b.key)).toEqual(['l']);
    expect(filterBlocksByGame(blocks, null)).toHaveLength(2);
  });
  it('lists each game once, alphabetically', () => {
    expect(buildGameOptions(blocks).map((g) => g.name)).toEqual(['League of Legends', 'Valorant']);
  });
});
