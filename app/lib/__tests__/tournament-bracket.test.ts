import { describe, expect, it } from 'vitest';
import {
  buildTournamentStructure,
  transformStageToBracketry,
} from '@/app/lib/bracket';
import type { TournamentMatch } from '@/app/types/tournament';
import { GAMES, getGameSubRoute } from '@/app/lib/constants';

describe('Tournament Bracket domain structuring & adapter', () => {
  it('builds full tournament structure with groups and stages from domain matches', () => {
    const matches: TournamentMatch[] = [
      {
        id: 'm1',
        tournamentId: 't1',
        stage: 'group',
        roundName: 'Legends Group Round 1',
        roundOrder: 1,
        matchOrder: 1,
        bracketGroup: 'Legends Group',
        scheduledAt: new Date('2026-04-20T17:00:00.000Z'),
        status: 'completed',
        isForfeit: false,
        home: {
          playerTitle: 'SloppyPotatoes',
          schoolName: 'Brooklyn Tech',
          score: 11,
          isWinner: true,
        },
        away: {
          playerTitle: 'YEKINDAR',
          schoolName: 'Stuyvesant',
          score: 7,
          isWinner: false,
        },
        winnerSide: 'home',
      },
      {
        id: 'm2',
        tournamentId: 't1',
        stage: 'knockout',
        roundName: 'Knockout Semifinals',
        roundOrder: 1,
        matchOrder: 1,
        bracketGroup: null,
        scheduledAt: new Date('2026-04-27T18:00:00.000Z'),
        status: 'completed',
        isForfeit: false,
        home: {
          playerTitle: 'Quitekewl',
          schoolName: 'Stuyvesant',
          score: 11,
          isWinner: true,
        },
        away: {
          playerTitle: 'thedarksoar',
          schoolName: 'Stuyvesant',
          score: 1,
          isWinner: false,
        },
        winnerSide: 'home',
      },
      {
        id: 'm3',
        tournamentId: 't1',
        stage: 'grand_finals',
        roundName: 'Grand Finals',
        roundOrder: 2,
        matchOrder: 1,
        bracketGroup: null,
        scheduledAt: new Date('2026-04-28T18:00:00.000Z'),
        status: 'completed',
        isForfeit: false,
        home: {
          playerTitle: 'Quitekewl',
          schoolName: 'Stuyvesant',
          score: 2,
          isWinner: true,
        },
        away: {
          playerTitle: 'YEKINDAR',
          schoolName: 'Stuyvesant',
          score: 0,
          isWinner: false,
        },
        winnerSide: 'home',
      },
    ];

    const structure = buildTournamentStructure(matches);

    expect(structure.hasGroups).toBe(true);
    expect(structure.groups).toHaveLength(1);
    expect(structure.groups[0].name).toBe('Legends Group');
    expect(structure.groups[0].standings).toHaveLength(2);
    expect(structure.groups[0].standings[0].playerTitle).toBe('SloppyPotatoes');
    expect(structure.groups[0].standings[0].wins).toBe(1);
    expect(structure.groups[0].standings[0].points).toBe(3);

    expect(structure.hasBrackets).toBe(true);
    const knockoutStage = structure.stages.find((s) => s.stage === 'knockout');
    expect(knockoutStage).toBeDefined();
    expect(knockoutStage?.rounds).toHaveLength(1);
    expect(knockoutStage?.rounds[0].name).toBe('Knockout Semifinals');

    const finalsStage = structure.stages.find((s) => s.stage === 'grand_finals');
    expect(finalsStage).toBeDefined();
    expect(finalsStage?.rounds[0].name).toBe('Grand Finals');
  });

  it('transforms stage data into bracketry adapter format with player IGN and school', () => {
    const matches: TournamentMatch[] = [
      {
        id: 'semi-1',
        tournamentId: 't1',
        stage: 'knockout',
        roundName: 'Semifinals',
        roundOrder: 1,
        matchOrder: 1,
        scheduledAt: new Date('2026-04-27T18:00:00.000Z'),
        status: 'completed',
        isForfeit: false,
        home: {
          playerTitle: 'Quitekewl',
          schoolName: 'Bronx Science',
          score: 2,
          isWinner: true,
        },
        away: {
          playerTitle: 'thedarksoar',
          schoolName: 'Stuyvesant High School',
          score: 1,
          isWinner: false,
        },
        winnerSide: 'home',
      },
    ];

    const structure = buildTournamentStructure(matches);
    const stage = structure.stages[0];
    expect(stage).toBeDefined();

    const { data, matchLookup } = transformStageToBracketry(stage);

    expect(data.rounds).toEqual([{ name: 'Semifinals' }]);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].roundIndex).toBe(0);
    expect(data.matches[0].order).toBe(0);
    expect(data.matches[0].sides).toHaveLength(2);

    // Verify contestant information carries IGN as title and School as nationality
    const c1Key = 'Bronx Science:::Quitekewl';
    const c2Key = 'Stuyvesant High School:::thedarksoar';
    expect(data.contestants[c1Key].players[0]).toEqual({
      title: 'Quitekewl',
      nationality: 'Bronx Science',
    });
    expect(data.contestants[c2Key].players[0]).toEqual({
      title: 'thedarksoar',
      nationality: 'Stuyvesant High School',
    });

    // Verify match lookup
    const lookupMatch = matchLookup.get('0_0');
    expect(lookupMatch).toBeDefined();
    expect(lookupMatch?.id).toBe('semi-1');
  });
});

describe('Competition Model Decoupling', () => {
  it('identifies tournament vs team games properly', () => {
    expect(GAMES.valorant.competitionModel).toBe('team');
    expect(GAMES['league-of-legends'].competitionModel).toBe('team');
    expect(GAMES.tetris.competitionModel).toBe('tournament');
    expect(GAMES['team-fight-tactics'].competitionModel).toBe('tournament');
  });

  it('getGameSubRoute accepts bracket and returns valid path', () => {
    expect(getGameSubRoute('tetris', 'bracket')).toBe('/tetris/bracket');
    expect(getGameSubRoute('team-fight-tactics', 'bracket')).toBe('/team-fight-tactics/bracket');
  });
});
