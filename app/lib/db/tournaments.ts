import 'server-only';

import { asc, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './index';
import * as schema from './schema';
import { dbGameSlug } from '@/app/lib/constants';
import type { TournamentMatch, TournamentStageType } from '@/app/types/tournament';

const homeSchool = alias(schema.schools, 'home_school');
const awaySchool = alias(schema.schools, 'away_school');

/**
 * Builds the query to retrieve all tournaments configured under a specific game slug.
 * Resolves canonical route slugs to DB slugs (e.g. 'tetris' -> 'tetr-io') and
 * joins seasons to surface `isSeasonActive` for the season selector.
 */
export function buildGameTournamentsQuery(gameSlug: string) {
  const dbSlug = dbGameSlug(gameSlug);
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
      isSeasonActive: schema.seasons.isActive,
    })
    .from(schema.tournaments)
    .innerJoin(schema.games, eq(schema.tournaments.gameId, schema.games.id))
    .leftJoin(schema.seasons, eq(schema.tournaments.seasonId, schema.seasons.id))
    .where(eq(schema.games.slug, dbSlug))
    .orderBy(desc(schema.tournaments.slug));
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
 * Retrieves all matches for a specific tournament, mapped directly to domain TournamentMatch entities.
 */
export async function getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const rows = await buildTournamentMatchesQuery(tournamentId);
  return rows.map((row) => ({
    id: row.id,
    tournamentId: row.tournamentId,
    stage: (row.stage as TournamentStageType) || 'other',
    roundName: row.roundName,
    roundOrder: row.roundOrder ?? 1,
    matchOrder: row.matchOrder ?? 1,
    bracketGroup: row.bracketGroup,
    scheduledAt: row.scheduledAt,
    status: row.status,
    isForfeit: row.isForfeit,
    home: {
      playerTitle: row.homePlayerTitle || row.homeSchoolName || 'TBD',
      schoolName: row.homeSchoolName || '',
      score: row.homeScore,
      isWinner: row.winnerSide === 'home',
    },
    away: {
      playerTitle: row.awayPlayerTitle || row.awaySchoolName || 'TBD',
      schoolName: row.awaySchoolName || '',
      score: row.awayScore,
      isWinner: row.winnerSide === 'away',
    },
    winnerSide: (row.winnerSide as 'home' | 'away' | 'draw' | null) ?? null,
    notes: row.notes,
  }));
}
