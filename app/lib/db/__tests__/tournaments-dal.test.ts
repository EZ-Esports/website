import { describe, expect, it } from 'vitest';
import { buildGameTournamentsQuery, buildTournamentMatchesQuery } from '@/app/lib/db/tournaments';
import * as schema from '@/app/lib/db/schema';

describe('Tournaments and Tournament Matches DAL Architecture', () => {
  it('builds getGameTournaments query joining games and filtering by slug', () => {
    const query = buildGameTournamentsQuery('tetr-io');
    const { sql, params } = query.toSQL();

    expect(sql).toContain('"tournaments"');
    expect(sql).toContain('"games"');
    expect(sql.toLowerCase()).toContain('where "games"."slug" = $1');
    expect(params).toEqual(['tetr-io']);
  });

  it('builds getTournamentMatches query joining home/away schools and filtering by tournamentId', () => {
    const query = buildTournamentMatchesQuery('tourney-uuid-123');
    const { sql, params } = query.toSQL();

    expect(sql).toContain('"tournament_matches"');
    expect(sql).toContain('"home_school"');
    expect(sql).toContain('"away_school"');
    expect(sql.toLowerCase()).toContain('where "tournament_matches"."tournament_id" = $1');
    expect(params).toEqual(['tourney-uuid-123']);
  });

  it('guarantees tournaments and matches are isolated first-class relational tables in schema', () => {
    // tournaments table has game_id and format
    expect(schema.tournaments).toBeDefined();
    expect(schema.tournaments.gameId).toBeDefined();
    expect(schema.tournaments.format).toBeDefined();

    // tournament_matches table has tournament_id, stage, round_name, player titles
    expect(schema.tournamentMatches).toBeDefined();
    expect(schema.tournamentMatches.tournamentId).toBeDefined();
    expect(schema.tournamentMatches.stage).toBeDefined();
    expect(schema.tournamentMatches.roundName).toBeDefined();
    expect(schema.tournamentMatches.homePlayerTitle).toBeDefined();
    expect(schema.tournamentMatches.awayPlayerTitle).toBeDefined();

    // matches table is preserved purely for team-league matches (no stage/round_name columns)
    expect('stage' in schema.matches).toBe(false);
    expect('roundName' in schema.matches).toBe(false);
    expect('roundOrder' in schema.matches).toBe(false);
  });
});
