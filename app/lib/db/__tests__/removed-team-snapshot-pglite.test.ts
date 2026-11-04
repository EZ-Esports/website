/**
 * Public reads keyed on season_standings / schools alone (no team join) must still hide a school
 * staff removed from the season (teams.removed_at, spec-058). Runs the real queries against an
 * in-memory PGlite built from db/migrations/*.sql, so the guard is exercised as SQL, not asserted
 * on a string. A school with a snapshot but no team at all (an archived season) must keep showing.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../index', () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn(), updateTag: vi.fn() }));

let client: PGlite;
let seasonId: string;

async function one<T = { id: string }>(text: string, params: unknown[] = []) {
  return (await client.query(text, params)).rows[0] as T;
}

beforeAll(async () => {
  client = new PGlite();
  await applyMigrations(client);
  holder.db = drizzle(client, { schema });

  const game = (await one(`insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`)).id;
  seasonId = (
    await one(`insert into seasons (game_id, name, is_active, outcomes_finalized_at) values ($1, '2025-26', false, now()) returning id`, [game])
  ).id;
  const school = async (slug: string) => (await one(`insert into schools (name, slug) values ($1, $1) returning id`, [slug])).id;
  const kept = await school('Kept HS');
  const removed = await school('Removed HS');
  const archiveOnly = await school('Archive Only HS'); // snapshot row, no team row at all

  const team = async (schoolId: string, removedAt: string | null) =>
    (await one(`insert into teams (school_id, game_id, season_id, removed_at) values ($1, $2, $3, $4) returning id`, [schoolId, game, seasonId, removedAt])).id;
  const keptTeam = await team(kept, null);
  const removedTeam = await team(removed, new Date().toISOString());
  const roster = async (teamId: string, name: string) =>
    (await one(`insert into rosters (team_id, name, division) values ($1, $2, 'A') returning id`, [teamId, name])).id;
  const keptRoster = await roster(keptTeam, 'Varsity');
  const removedRoster = await roster(removedTeam, 'Varsity');

  const standing = (schoolId: string, division: string, rank: number) =>
    client.query(`insert into season_standings (season_id, school_id, division, rank, wins, losses) values ($1, $2, $3, $4, 5, 1)`, [seasonId, schoolId, division, rank]);
  await standing(removed, 'Varsity', 1); // the removed school is the snapshot champion...
  await standing(kept, 'Varsity', 2);
  await standing(removed, 'JV', 1); // ...and the only school in a JV table
  await standing(archiveOnly, 'Varsity', 3);

  // One match against the removed team, one that does not involve it (kept vs kept needs a second roster).
  const keptJv = await roster(keptTeam, 'JV');
  const match = (home: string, away: string) =>
    client.query(`insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, status) values ($1, $2, $3, now(), 'completed')`, [seasonId, home, away]);
  await match(keptRoster, removedRoster);
  await match(keptRoster, keptJv);
});

afterAll(async () => {
  await client.close();
});

describe('snapshot-based public reads hide a removed school', () => {
  it('the standings snapshot query omits it and keeps a school that has no team row', async () => {
    const { buildSeasonStandingsSnapshotQuery } = await import('../standings');
    const rows = await buildSeasonStandingsSnapshotQuery({ seasonId, division: 'Varsity', combined: true });
    expect(rows.map((r) => r.schoolName).sort()).toEqual(['Archive Only HS', 'Kept HS']);
  });

  it('season divisions no longer include a division only the removed school filled', async () => {
    const { getSeasonDivisions } = await import('../standings');
    expect(await getSeasonDivisions(seasonId)).not.toContain('JV');
    expect(await getSeasonDivisions(seasonId)).toContain('Varsity');
  });

  it('the hub season summary omits it', async () => {
    const { getGameSeasonSummary } = await import('../standings');
    const summary = JSON.stringify(await getGameSeasonSummary(seasonId));
    expect(summary).not.toContain('Removed HS');
    expect(summary).toContain('Kept HS');
  });

  it('the archive index drops its champion and its fixtures from the match count', async () => {
    const { getArchiveIndex } = await import('../matches');
    const [row] = (await getArchiveIndex()).filter((s) => s.id === seasonId);
    expect(row.championSchool).not.toBe('Removed HS');
    expect(row.matchCount).toBe(1); // kept vs kept only; kept vs removed is hidden
  });
});
