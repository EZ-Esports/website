/**
 * Pure parsing utilities and types for tournament structures (Brackets, Groups, Stages).
 * Deconstructs structured database columns or match notes, school/player pairs, and scores into structured bracket trees.
 */

export interface BracketParticipant {
  name: string;        // Player IGN or squad name (e.g. "Quitekewl" or "27nickels & Davidlai")
  schoolName: string;  // School / Team name (e.g. "Stuyvesant High School")
  score: number | null;
  isWinner: boolean;
}

export interface BracketMatch {
  id: string;
  roundName: string;
  roundOrder?: number | null;
  matchOrder?: number | null;
  stage: 'winners' | 'losers' | 'grand_finals' | 'knockout' | 'group' | 'other';
  groupName?: string;  // e.g. "Legends Group", "Challengers Group"
  scheduledAt: string;
  status: string;
  isForfeit: boolean;
  participant1: BracketParticipant;
  participant2: BracketParticipant;
  notes?: string | null;
}

export interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

export interface TournamentStageData {
  stage: 'winners' | 'losers' | 'grand_finals' | 'knockout' | 'group' | 'other';
  label: string;
  rounds: BracketRound[];
}

export interface GroupTableStanding {
  name: string;
  schoolName: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

export interface TournamentSeasonStructure {
  hasGroups: boolean;
  hasBrackets: boolean;
  stages: TournamentStageData[];
  groups: { name: string; standings: GroupTableStanding[]; matches: BracketMatch[] }[];
}

export interface RawMatchInput {
  id: string;
  scheduledAt: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  notes?: string | null;
  stage?: string | null;
  roundName?: string | null;
  roundOrder?: number | null;
  matchOrder?: number | null;
  bracketGroup?: string | null;
  homeParticipantName?: string | null;
  awayParticipantName?: string | null;
}

/**
 * Normalizes stage string to canonical type
 */
function normalizeStage(stageStr: string): BracketMatch['stage'] {
  const s = stageStr.toLowerCase();
  if (s.includes('winner')) return 'winners';
  if (s.includes('loser')) return 'losers';
  if (s.includes('grand final')) return 'grand_finals';
  if (s.includes('knockout') || s.includes('playoff')) return 'knockout';
  if (s.includes('group')) return 'group';
  return 'other';
}

/**
 * Parses match details prioritizing structured database columns,
 * falling back gracefully to legacy colon-prefixed notes when columns are unset.
 */
export function parseMatchDetails(match: RawMatchInput): BracketMatch {
  let roundName = match.roundName?.trim() || 'Match';
  let stage: BracketMatch['stage'] = match.stage ? normalizeStage(match.stage) : 'other';
  let groupName: string | undefined = match.bracketGroup?.trim() || undefined;
  let p1Name = match.homeParticipantName?.trim() || match.homeTeam;
  let p2Name = match.awayParticipantName?.trim() || match.awayTeam;

  // Legacy fallback: parse free-text notes if structured columns are empty
  if (!match.stage && !match.roundName) {
    const notes = (match.notes || '').trim();
    if (notes.includes(':')) {
      const colonIndex = notes.indexOf(':');
      roundName = notes.substring(0, colonIndex).trim();
      const matchupStr = notes.substring(colonIndex + 1).trim();

      stage = normalizeStage(roundName);
      const lowerRound = roundName.toLowerCase();
      if (lowerRound.includes('legend')) {
        groupName = 'Legends Group';
      } else if (lowerRound.includes('challenger')) {
        groupName = 'Challengers Group';
      }

      // Try extracting player IGNs if available: "SideA vs SideB"
      if (matchupStr.toLowerCase().includes(' vs ')) {
        const parts = matchupStr.split(/\s+vs\s+/i);
        if (parts.length === 2) {
          p1Name = parts[0].trim();
          p2Name = parts[1].trim();
        }
      }
    }
  }

  const isCompleted = match.status.toLowerCase() === 'completed' || match.status.toLowerCase() === 'forfeit';
  const isForfeit = match.status.toLowerCase() === 'forfeit';
  const hScore = match.homeScore;
  const aScore = match.awayScore;

  const isHomeWinner = isCompleted && hScore !== null && aScore !== null && hScore > aScore;
  const isAwayWinner = isCompleted && hScore !== null && aScore !== null && aScore > hScore;

  return {
    id: match.id,
    roundName,
    roundOrder: match.roundOrder,
    matchOrder: match.matchOrder,
    stage,
    groupName,
    scheduledAt: match.scheduledAt,
    status: match.status,
    isForfeit,
    participant1: {
      name: p1Name,
      schoolName: match.homeTeam,
      score: hScore,
      isWinner: isHomeWinner,
    },
    participant2: {
      name: p2Name,
      schoolName: match.awayTeam,
      score: aScore,
      isWinner: isAwayWinner,
    },
    notes: match.notes,
  };
}

/**
 * Builds full tournament stage & bracket structure from an array of matches.
 */
export function buildTournamentStructure(rawMatches: RawMatchInput[]): TournamentSeasonStructure {
  const matches = rawMatches.map(parseMatchDetails);

  // Group by stages
  const stageMap = new Map<string, BracketMatch[]>();
  const groupMap = new Map<string, BracketMatch[]>();

  for (const m of matches) {
    if (m.stage === 'group' && m.groupName) {
      if (!groupMap.has(m.groupName)) groupMap.set(m.groupName, []);
      groupMap.get(m.groupName)!.push(m);
    } else {
      const stageKey = m.stage;
      if (!stageMap.has(stageKey)) stageMap.set(stageKey, []);
      stageMap.get(stageKey)!.push(m);
    }
  }

  const stageOrder: BracketMatch['stage'][] = ['winners', 'losers', 'knockout', 'grand_finals', 'other'];
  const stageLabels: Record<BracketMatch['stage'], string> = {
    winners: 'Winners Bracket',
    losers: 'Losers Bracket',
    knockout: 'Knockout Stage',
    grand_finals: 'Grand Finals',
    group: 'Group Stage',
    other: 'Tournament Matches',
  };

  const stages: TournamentStageData[] = [];

  for (const s of stageOrder) {
    const stageMatches = stageMap.get(s);
    if (!stageMatches || stageMatches.length === 0) continue;

    // Group matches into distinct rounds (e.g. "Winners Pilot Round", "Winner's Quarter-Finals")
    const roundMap = new Map<string, BracketMatch[]>();
    for (const m of stageMatches) {
      if (!roundMap.has(m.roundName)) roundMap.set(m.roundName, []);
      roundMap.get(m.roundName)!.push(m);
    }

    const rounds: BracketRound[] = Array.from(roundMap.entries()).map(([name, rMatches]) => ({
      name,
      matches: rMatches.sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0)),
    }));

    stages.push({
      stage: s,
      label: stageLabels[s],
      rounds,
    });
  }

  // Calculate Group Standings if groups exist
  const groups: TournamentSeasonStructure['groups'] = [];
  for (const [gName, gMatches] of groupMap.entries()) {
    const standingMap = new Map<string, GroupTableStanding>();

    for (const m of gMatches) {
      const p1 = m.participant1;
      const p2 = m.participant2;

      if (!standingMap.has(p1.name)) {
        standingMap.set(p1.name, {
          name: p1.name,
          schoolName: p1.schoolName,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
        });
      }
      if (!standingMap.has(p2.name)) {
        standingMap.set(p2.name, {
          name: p2.name,
          schoolName: p2.schoolName,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
        });
      }

      if (p1.score !== null && p2.score !== null) {
        const s1 = standingMap.get(p1.name)!;
        const s2 = standingMap.get(p2.name)!;
        s1.played += 1;
        s2.played += 1;
        if (p1.isWinner) {
          s1.wins += 1;
          s1.points += 3;
          s2.losses += 1;
        } else if (p2.isWinner) {
          s2.wins += 1;
          s2.points += 3;
          s1.losses += 1;
        }
      }
    }

    const standings = Array.from(standingMap.values()).sort((a, b) => b.wins - a.wins || b.points - a.points);
    groups.push({
      name: gName,
      standings,
      matches: gMatches,
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
export interface BracketryRound {
  name: string;
}

export interface BracketrySide {
  contestantId?: string;
  scores?: { mainScore: number | string; isWinner?: boolean }[];
  isWinner?: boolean;
}

export interface BracketryMatch {
  roundIndex: number;
  order: number;
  sides: BracketrySide[];
  matchStatus?: string;
}

export interface BracketryContestant {
  players: {
    title: string;
    nationality?: string;
  }[];
}

export interface BracketryData {
  rounds: BracketryRound[];
  matches: BracketryMatch[];
  contestants: Record<string, BracketryContestant>;
}

/**
 * Transforms a TournamentStageData structure into data suitable for the bracketry library,
 * alongside a map to look up the original BracketMatch on click.
 */
export function transformStageToBracketry(stage: TournamentStageData): {
  data: BracketryData;
  matchLookup: Map<string, BracketMatch>;
} {
  const rounds: BracketryRound[] = [];
  const matches: BracketryMatch[] = [];
  const contestants: Record<string, BracketryContestant> = {};
  const matchLookup = new Map<string, BracketMatch>();

  stage.rounds.forEach((round, roundIndex) => {
    rounds.push({ name: round.name });

    round.matches.forEach((m, matchIndex) => {
      const p1 = m.participant1;
      const p2 = m.participant2;

      // Unique contestant keys combining name and school
      const c1Id = `${p1.schoolName}:::${p1.name}`;
      const c2Id = `${p2.schoolName}:::${p2.name}`;

      if (!contestants[c1Id]) {
        contestants[c1Id] = {
          players: [
            {
              title: p1.name,
              nationality: p1.schoolName,
            },
          ],
        };
      }

      if (!contestants[c2Id]) {
        contestants[c2Id] = {
          players: [
            {
              title: p2.name,
              nationality: p2.schoolName,
            },
          ],
        };
      }

      const sides: BracketrySide[] = [
        {
          contestantId: c1Id,
          isWinner: p1.isWinner,
          scores: p1.score !== null ? [{ mainScore: p1.score, isWinner: p1.isWinner }] : [],
        },
        {
          contestantId: c2Id,
          isWinner: p2.isWinner,
          scores: p2.score !== null ? [{ mainScore: p2.score, isWinner: p2.isWinner }] : [],
        },
      ];

      matches.push({
        roundIndex,
        order: matchIndex,
        sides,
        matchStatus: m.status,
      });

      matchLookup.set(`${roundIndex}_${matchIndex}`, m);
    });
  });

  return {
    data: {
      rounds,
      matches,
      contestants,
    },
    matchLookup,
  };
}
