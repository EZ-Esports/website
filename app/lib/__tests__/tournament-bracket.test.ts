import { describe, expect, it } from 'vitest';
import { parseMatchDetails, buildTournamentStructure } from '@/app/lib/bracket';
import { GAMES, getGameSubRoute } from '@/app/lib/constants';

describe('Tournament Bracket parsing and structuring', () => {
  it('parses player IGNs, round name, and stage from match notes correctly', () => {
    const rawMatch = {
      id: 'tetrio-1',
      scheduledAt: '2026-04-20T17:00:00.000Z',
      homeTeam: 'Brooklyn Technical High School',
      awayTeam: 'Stuyvesant High School',
      homeScore: 11,
      awayScore: 7,
      status: 'completed',
      notes: 'Legends Group Round 1: SloppyPotatoes vs YEKINDAR',
    };

    const parsed = parseMatchDetails(rawMatch);

    expect(parsed.roundName).toBe('Legends Group Round 1');
    expect(parsed.stage).toBe('group');
    expect(parsed.groupName).toBe('Legends Group');

    // Participant 1
    expect(parsed.participant1.name).toBe('SloppyPotatoes');
    expect(parsed.participant1.schoolName).toBe('Brooklyn Technical High School');
    expect(parsed.participant1.score).toBe(11);
    expect(parsed.participant1.isWinner).toBe(true);

    // Participant 2
    expect(parsed.participant2.name).toBe('YEKINDAR');
    expect(parsed.participant2.schoolName).toBe('Stuyvesant High School');
    expect(parsed.participant2.score).toBe(7);
    expect(parsed.participant2.isWinner).toBe(false);
  });

  it('parses double-elimination Winners and Losers bracket rounds', () => {
    const rawMatch = {
      id: 'tetrio-2',
      scheduledAt: '2023-04-22T10:00:00.000Z',
      homeTeam: 'Midwood High School',
      awayTeam: 'Stuyvesant High School',
      homeScore: 16,
      awayScore: 20,
      status: 'completed',
      notes: 'Winners Pilot Round: Midwood#1 (Apersan & Shlare) vs Stuyvesant #5 (Ppnore & Jaytep)',
    };

    const parsed = parseMatchDetails(rawMatch);
    expect(parsed.stage).toBe('winners');
    expect(parsed.roundName).toBe('Winners Pilot Round');
    expect(parsed.participant1.name).toBe('Midwood#1 (Apersan & Shlare)');
    expect(parsed.participant2.name).toBe('Stuyvesant #5 (Ppnore & Jaytep)');
    expect(parsed.participant2.isWinner).toBe(true);
  });

  it('builds full tournament structure with groups and stages', () => {
    const matches = [
      {
        id: 'm1',
        scheduledAt: '2026-04-20T17:00:00.000Z',
        homeTeam: 'Brooklyn Tech',
        awayTeam: 'Stuyvesant',
        homeScore: 11,
        awayScore: 7,
        status: 'completed',
        notes: 'Legends Group Round 1: SloppyPotatoes vs YEKINDAR',
      },
      {
        id: 'm2',
        scheduledAt: '2026-04-27T18:00:00.000Z',
        homeTeam: 'Stuyvesant',
        awayTeam: 'Stuyvesant',
        homeScore: 11,
        awayScore: 1,
        status: 'completed',
        notes: 'Knockout Semifinals: Quitekewl vs thedarksoar',
      },
      {
        id: 'm3',
        scheduledAt: '2026-04-28T18:00:00.000Z',
        homeTeam: 'Stuyvesant',
        awayTeam: 'Stuyvesant',
        homeScore: 2,
        awayScore: 0,
        status: 'completed',
        notes: 'Knockout Grand Finals: Quitekewl vs YEKINDAR',
      },
    ];

    const structure = buildTournamentStructure(matches);

    expect(structure.hasGroups).toBe(true);
    expect(structure.groups).toHaveLength(1);
    expect(structure.groups[0].name).toBe('Legends Group');
    expect(structure.groups[0].standings).toHaveLength(2);

    expect(structure.hasBrackets).toBe(true);
    const knockoutStage = structure.stages.find((s) => s.stage === 'knockout');
    expect(knockoutStage).toBeDefined();
    expect(knockoutStage?.rounds).toHaveLength(1);
    expect(knockoutStage?.rounds[0].name).toBe('Knockout Semifinals');

    const finalsStage = structure.stages.find((s) => s.stage === 'grand_finals');
    expect(finalsStage).toBeDefined();
    expect(finalsStage?.rounds[0].name).toBe('Knockout Grand Finals');
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
