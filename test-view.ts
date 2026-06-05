import { db } from './app/lib/db';
import * as schema from './app/lib/db/schema';
import { sql } from 'drizzle-orm';
import { pgView, uuid, text, integer } from 'drizzle-orm/pg-core';

export const rosterStandings = pgView('roster_standings', {
  id: uuid('id'),
  teamId: uuid('team_id'),
  seasonId: uuid('season_id'),
  name: text('name'),
  division: text('division'),
  wins: integer('wins'),
  losses: integer('losses'),
}).as(sql`
  SELECT
    r.id, r.team_id, r.season_id, r.name, r.division,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status = 'completed') OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status = 'completed'))::int as wins,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status = 'completed') OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status = 'completed'))::int as losses
  FROM rosters r
`);

console.log("Success");
