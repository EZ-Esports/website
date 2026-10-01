import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './index';
import * as schema from './schema';

const homeSchool = alias(schema.schools, 'home_school');
const awaySchool = alias(schema.schools, 'away_school');

/**
 * Builds the query to retrieve all tournaments configured under a specific game slug.
 */
export function buildGameTournamentsQuery(gameSlug: string) {
  return db
    .select({
      id: schema.tournaments.id,
      gameId: schema.tournaments.gameId,
      seasonId: schema.tournaments.seasonId,
      name: schema.tournaments.name,
      slug: schema.tournaments.slug,
      format: schema.tournaments.format,
      status: schema.tournaments.status,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
      notes: schema.tournaments.notes,
      gameSlug: schema.games.slug,
      gameDisplayName: schema.games.displayName,
    })
    .from(schema.tournaments)
    .innerJoin(schema.games, eq(schema.tournaments.gameId, schema.games.id))
    .where(eq(schema.games.slug, gameSlug))
    .orderBy(asc(schema.tournaments.slug));
}

/**
 * Retrieves all tournaments configured under a specific game slug.
 */
export async function getGameTournaments(gameSlug: string) {
  return buildGameTournamentsQuery(gameSlug);
}

/**
 * Builds the query to retrieve all matches for a specific tournament with joined school details.
 */
export function buildTournamentMatchesQuery(tournamentId: string) {
  return db
    .select({
      id: schema.tournamentMatches.id,
      tournamentId: schema.tournamentMatches.tournamentId,
      stage: schema.tournamentMatches.stage,
      roundName: schema.tournamentMatches.roundName,
      roundOrder: schema.tournamentMatches.roundOrder,
      matchOrder: schema.tournamentMatches.matchOrder,
      bracketGroup: schema.tournamentMatches.bracketGroup,
      scheduledAt: schema.tournamentMatches.scheduledAt,
      status: schema.tournamentMatches.status,
      isForfeit: schema.tournamentMatches.isForfeit,
      homePlayerTitle: schema.tournamentMatches.homePlayerTitle,
      awayPlayerTitle: schema.tournamentMatches.awayPlayerTitle,
      homeSchoolId: schema.tournamentMatches.homeSchoolId,
      awaySchoolId: schema.tournamentMatches.awaySchoolId,
      homeSchoolName: homeSchool.name,
      awaySchoolName: awaySchool.name,
      homeScore: schema.tournamentMatches.homeScore,
      awayScore: schema.tournamentMatches.awayScore,
      winnerSide: schema.tournamentMatches.winnerSide,
      notes: schema.tournamentMatches.notes,
    })
    .from(schema.tournamentMatches)
    .leftJoin(homeSchool, eq(schema.tournamentMatches.homeSchoolId, homeSchool.id))
    .leftJoin(awaySchool, eq(schema.tournamentMatches.awaySchoolId, awaySchool.id))
    .where(eq(schema.tournamentMatches.tournamentId, tournamentId))
    .orderBy(
      asc(schema.tournamentMatches.roundOrder),
      asc(schema.tournamentMatches.matchOrder),
      asc(schema.tournamentMatches.scheduledAt),
      asc(schema.tournamentMatches.id)
    );
}

/**
 * Retrieves all matches for a specific tournament with joined school details.
 */
export async function getTournamentMatches(tournamentId: string) {
  return buildTournamentMatchesQuery(tournamentId);
}
