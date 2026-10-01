/**
 * Pure domain service and view adapter for tournament bracket structures.
 * Transforms domain TournamentMatch entities into structured stages, groups, and bracketry layouts.
 */

import type {
  TournamentMatch,
  TournamentStage,
  TournamentRound,
  TournamentGroup,
  TournamentStructure,
  GroupStanding,
  TournamentStageType,
} from '@/app/types/tournament';

// Re-export domain types for components
export type {
  TournamentMatch,
  TournamentStage,
  TournamentRound,
  TournamentGroup,
  TournamentStructure,
  GroupStanding,
};

const STAGE_ORDER: TournamentStageType[] = ['winners', 'losers', 'knockout', 'grand_finals', 'other'];

const STAGE_LABELS: Record<TournamentStageType, string> = {
  winners: 'Winners Bracket',
  losers: 'Losers Bracket',
  knockout: 'Knockout Stage',
  grand_finals: 'Grand Finals',
  group: 'Group Stage',
  other: 'Tournament Matches',
};

/**
 * Builds structured tournament stages, rounds, and group tables from domain matches.
 */
export function buildTournamentStructure(matches: TournamentMatch[]): TournamentStructure {
  const stageMap = new Map<TournamentStageType, TournamentMatch[]>();
  const groupMap = new Map<string, TournamentMatch[]>();

  for (const m of matches) {
    if (m.stage === 'group' && m.bracketGroup) {
      if (!groupMap.has(m.bracketGroup)) groupMap.set(m.bracketGroup, []);
      groupMap.get(m.bracketGroup)!.push(m);
    } else {
      if (!stageMap.has(m.stage)) stageMap.set(m.stage, []);
      stageMap.get(m.stage)!.push(m);
    }
  }

  const stages: TournamentStage[] = [];

  for (const s of STAGE_ORDER) {
    const stageMatches = stageMap.get(s);
    if (!stageMatches || stageMatches.length === 0) continue;

    // Group into distinct ordered rounds
    const roundMap = new Map<string, { roundOrder: number; matches: TournamentMatch[] }>();
    for (const m of stageMatches) {
      if (!roundMap.has(m.roundName)) {
        roundMap.set(m.roundName, { roundOrder: m.roundOrder, matches: [] });
      }
      roundMap.get(m.roundName)!.matches.push(m);
    }

    const rounds: TournamentRound[] = Array.from(roundMap.entries())
      .map(([name, data]) => ({
        name,
        roundOrder: data.roundOrder,
        matches: data.matches.sort((a, b) => a.matchOrder - b.matchOrder),
      }))
      .sort((a, b) => a.roundOrder - b.roundOrder);

    stages.push({
      stage: s,
      label: STAGE_LABELS[s] || s,
      rounds,
    });
  }

  // Calculate Group Standings if group stages exist
  const groups: TournamentGroup[] = [];
  for (const [groupName, groupMatches] of groupMap.entries()) {
    const standingMap = new Map<string, GroupStanding>();

    for (const m of groupMatches) {
      for (const p of [m.home, m.away]) {
        if (!standingMap.has(p.playerTitle)) {
          standingMap.set(p.playerTitle, {
            playerTitle: p.playerTitle,
            schoolName: p.schoolName,
            played: 0,
            wins: 0,
            losses: 0,
            points: 0,
          });
        }
      }

      if (m.home.score !== null && m.away.score !== null) {
        const hStanding = standingMap.get(m.home.playerTitle)!;
        const aStanding = standingMap.get(m.away.playerTitle)!;
        hStanding.played += 1;
        aStanding.played += 1;

        if (m.home.isWinner) {
          hStanding.wins += 1;
          hStanding.points += 3;
          aStanding.losses += 1;
        } else if (m.away.isWinner) {
          aStanding.wins += 1;
          aStanding.points += 3;
          hStanding.losses += 1;
        }
      }
    }

    const standings = Array.from(standingMap.values()).sort(
      (a, b) => b.wins - a.wins || b.points - a.points
    );

    groups.push({
      name: groupName,
      standings,
      matches: groupMatches,
    });
  }

  return {
    hasGroups: groups.length > 0,
    hasBrackets: stages.length > 0,
    stages,
    groups,
  };
}

/**
 * Adapter interface for the bracketry library
 */
export interface BracketryData {
  rounds: { name: string }[];
  matches: {
    roundIndex: number;
    order: number;
    sides: {
      contestantId?: string;
      isWinner?: boolean;
      scores?: { mainScore: number | string; isWinner?: boolean }[];
    }[];
    matchStatus?: string;
  }[];
  contestants: Record<string, { players: { title: string; nationality?: string }[] }>;
}

/**
 * Transforms a TournamentStage into the structure required by bracketry,
 * accompanied by a lookup map to retrieve the original TournamentMatch on click.
 */
export function transformStageToBracketry(stage: TournamentStage): {
  data: BracketryData;
  matchLookup: Map<string, TournamentMatch>;
} {
  const rounds: BracketryData['rounds'] = [];
  const matches: BracketryData['matches'] = [];
  const contestants: BracketryData['contestants'] = {};
  const matchLookup = new Map<string, TournamentMatch>();

  stage.rounds.forEach((round, roundIndex) => {
    rounds.push({ name: round.name });

    round.matches.forEach((m, matchIndex) => {
      const c1Id = `${m.home.schoolName}:::${m.home.playerTitle}`;
      const c2Id = `${m.away.schoolName}:::${m.away.playerTitle}`;

      if (!contestants[c1Id]) {
        contestants[c1Id] = {
          players: [{ title: m.home.playerTitle, nationality: m.home.schoolName }],
        };
      }
      if (!contestants[c2Id]) {
        contestants[c2Id] = {
          players: [{ title: m.away.playerTitle, nationality: m.away.schoolName }],
        };
      }

      matches.push({
        roundIndex,
        order: matchIndex,
        sides: [
          {
            contestantId: c1Id,
            isWinner: m.home.isWinner,
            scores: m.home.score !== null ? [{ mainScore: m.home.score, isWinner: m.home.isWinner }] : [],
          },
          {
            contestantId: c2Id,
            isWinner: m.away.isWinner,
            scores: m.away.score !== null ? [{ mainScore: m.away.score, isWinner: m.away.isWinner }] : [],
          },
        ],
      });

      matchLookup.set(`${roundIndex}_${matchIndex}`, m);
    });
  });

  return {
    data: { rounds, matches, contestants },
    matchLookup,
  };
}
