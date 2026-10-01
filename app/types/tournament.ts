/**
 * Domain entity types for Tournaments and Brackets (Hexagonal Core Domain).
 */

export type TournamentStageType =
  | 'winners'
  | 'losers'
  | 'grand_finals'
  | 'knockout'
  | 'group'
  | 'other';

export type TournamentFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'groups_and_knockout'
  | 'swiss'
  | 'round_robin';

export interface Tournament {
  id: string;
  gameId: string;
  seasonId: string;
  name: string;
  slug: string;
  format: TournamentFormat;
  status: 'upcoming' | 'ongoing' | 'completed';
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
}

export interface TournamentParticipant {
  playerTitle: string; // IGN or squad name (e.g. "Quitekewl")
  schoolName: string;  // Affiliated school (e.g. "Stuyvesant High School")
  score: number | null;
  isWinner: boolean;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  stage: TournamentStageType;
  roundName: string;
  roundOrder: number;
  matchOrder: number;
  bracketGroup?: string | null;
  scheduledAt: Date;
  status: string;
  isForfeit: boolean;
  home: TournamentParticipant;
  away: TournamentParticipant;
  winnerSide: 'home' | 'away' | 'draw' | null;
  notes?: string | null;
}

export interface TournamentRound {
  name: string;
  roundOrder: number;
  matches: TournamentMatch[];
}

export interface TournamentStage {
  stage: TournamentStageType;
  label: string;
  rounds: TournamentRound[];
}

export interface GroupStanding {
  playerTitle: string;
  schoolName: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

export interface TournamentGroup {
  name: string;
  standings: GroupStanding[];
  matches: TournamentMatch[];
}

export interface TournamentStructure {
  hasGroups: boolean;
  hasBrackets: boolean;
  stages: TournamentStage[];
  groups: TournamentGroup[];
}
