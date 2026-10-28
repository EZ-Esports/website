/**
 * Pure planning for "Generate season" (spec-046): given the chosen schools and what the season
 * already has, decides which teams and rosters must be created and which matches to write.
 * The server action loads the facts, calls this, and either returns the plan (preview) or
 * writes it (commit). Keeping the decision here makes idempotency testable without a database.
 */
import { canonicalDivision, type CanonicalDivision } from './db/match-page';
import { storedDivision } from './school-roster-view';
import {
  generateRegularSeasonRounds,
  kickoffForRound,
  scheduleFingerprint,
  type ScheduleRound,
} from './season-schedule';

export interface PlanSchool {
  id: string;
  name: string;
}

export interface PlanRosterCreate extends PlanSchool {
  rosterName: string;
}

export interface PlanReuse extends PlanSchool {
  rosterName: string;
}

export interface PlanTeam {
  id: string;
  schoolId: string;
}

export interface PlanRoster {
  id: string;
  teamId: string;
  name: string;
  division: string;
}

export interface SeasonPlanMatch {
  round: number;
  kickoff: Date;
  homeSchoolId: string;
  awaySchoolId: string;
}

export interface SeasonPlan {
  /** Schools that have no team in this season yet. */
  teamsToCreate: PlanSchool[];
  /** Schools with no roster in the chosen division yet (including brand-new teams), with the name to give it. */
  rostersToCreate: PlanRosterCreate[];
  /** Schools whose existing roster in the division is reused untouched. */
  reusedRosters: PlanReuse[];
  /** Stored `rosters.division` value for every created roster. */
  rosterDivision: string;
  rounds: ScheduleRound[];
  matches: SeasonPlanMatch[];
  /** Matches per school, always 7 for a valid plan; surfaced so the preview can show it. */
  matchesPerSchool: Record<string, number>;
  fingerprint: string;
}

export interface SeasonPlanInput {
  seasonId: string;
  startYmd: string;
  division: CanonicalDivision;
  schools: PlanSchool[];
  existingTeams: PlanTeam[];
  existingRosters: PlanRoster[];
}

export function buildSeasonPlan(input: SeasonPlanInput): SeasonPlan {
  const { seasonId, startYmd, division, schools, existingTeams, existingRosters } = input;

  const teamBySchool = new Map(existingTeams.map((t) => [t.schoolId, t]));

  const teamsToCreate = schools.filter((s) => !teamBySchool.has(s.id));
  const reusedRosters: PlanReuse[] = [];
  const rostersToCreate: PlanRosterCreate[] = [];
  for (const s of schools) {
    const team = teamBySchool.get(s.id);
    const mine = team ? existingRosters.filter((r) => r.teamId === team.id) : [];
    // Several rosters in the division: the first by name plays, deterministically, and the rest are left alone.
    const inDivision = mine
      .filter((r) => canonicalDivision(r.division) === division)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    if (inDivision.length > 0) {
      reusedRosters.push({ ...s, rosterName: inDivision[0].name });
      continue;
    }
    // (team, name) is unique, so a same-named roster stored under another division must not be hit.
    const taken = new Set(mine.map((r) => r.name));
    let name: string = division;
    for (let n = 2; taken.has(name); n++) name = `${division} ${n}`;
    rostersToCreate.push({ ...s, rosterName: name });
  }

  // Seeded by season and division, so Varsity and JV differ and re-running the preview reproduces the same schedule.
  const rounds = generateRegularSeasonRounds(
    schools.map((s) => s.id),
    `${seasonId}:${division}`
  );
  const matches: SeasonPlanMatch[] = rounds.flatMap((r) => {
    const kickoff = kickoffForRound(startYmd, r.round);
    return r.pairs.map((p) => ({ round: r.round, kickoff, homeSchoolId: p.homeId, awaySchoolId: p.awayId }));
  });

  const matchesPerSchool: Record<string, number> = {};
  for (const m of matches) {
    matchesPerSchool[m.homeSchoolId] = (matchesPerSchool[m.homeSchoolId] ?? 0) + 1;
    matchesPerSchool[m.awaySchoolId] = (matchesPerSchool[m.awaySchoolId] ?? 0) + 1;
  }

  return {
    teamsToCreate,
    rostersToCreate,
    reusedRosters,
    rosterDivision: storedDivision(division),
    rounds,
    matches,
    matchesPerSchool,
    fingerprint: scheduleFingerprint(rounds, startYmd, [division]),
  };
}
