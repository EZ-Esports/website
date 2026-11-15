/**
 * Sample league data for the LOCAL database only (see db/local/server.ts and docs/dev/LOCAL_DB.md).
 *
 * Invented names and `.test` addresses, no real people. It gives every screen something to show:
 *   - Valorant 2026-27 (active, published): 8 member schools with Varsity and JV rosters, players, and a few
 *     played and upcoming matches; plus "Gamma Sample HS", which is in no season (try Add school), and
 *     "Removed Sample HS", which has rosters but no membership (try Add school to restore it).
 *   - Valorant 2025-26 (archived, published): six schools with standings snapshots and played matches.
 *   - League of Legends 2026-27 (active, not published): three schools.
 *   - TETR.IO 2026-27 (active, tournament game): one school, no roster membership needed for brackets.
 *
 * Writes only through requireLocalUrl(): loopback, never DATABASE_URL, never `.env`. Refuses to run twice
 * (it stops when any game exists); start the database with --fresh for a clean slate.
 *
 *   npm run db:local:seed
 */
import postgres from 'postgres';
import { requireLocalUrl } from './target';

type Sql = postgres.Sql;

const SCHOOLS = [
  'Alpha Sample HS', 'Bravo Sample HS', 'Charlie Sample HS', 'Delta Sample HS', 'Echo Sample HS',
  'Foxtrot Sample HS', 'Golf Sample HS', 'Hotel Sample HS', 'Gamma Sample HS', 'Removed Sample HS',
];
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function one<T = { id: string }>(sql: Sql, q: ReturnType<Sql>): Promise<T> {
  const rows = (await q) as unknown as T[];
  return rows[0];
}

export async function seedSample(sql: Sql): Promise<void> {
  const existing = await sql`select 1 from games limit 1`;
  if (existing.length > 0) throw new Error('The local database already has games. Start it with --fresh to reseed.');

  const game = async (s: string, name: string, short: string) =>
    (await one(sql, sql`insert into games (slug, display_name, short_name) values (${s}, ${name}, ${short}) returning id`)).id;
  const valorant = await game('valorant', 'Valorant', 'VAL');
  const lol = await game('league-of-legends', 'League of Legends', 'LoL');
  const tetris = await game('tetris', 'TETR.IO', 'TETR');

  const season = async (gameId: string, name: string, active: boolean, published: boolean) =>
    (
      await one(
        sql,
        sql`insert into seasons (game_id, name, is_active, outcomes_finalized_at) values (${gameId}, ${name}, ${active}, ${published ? sql`now()` : null}) returning id`,
      )
    ).id;
  const val2526 = await season(valorant, '2025-26', false, true);
  const val2627 = await season(valorant, '2026-27', true, true);
  const lol2627 = await season(lol, '2026-27', true, false);
  await season(tetris, '2026-27', true, true);

  const schools: string[] = [];
  for (const [i, name] of SCHOOLS.entries()) {
    schools.push((await one(sql, sql`insert into schools (name, slug, display_order) values (${name}, ${slug(name)}, ${i}) returning id`)).id);
  }

  const member = async (schoolId: string, first: string, last: string, extra: { email?: string; schoolEmail?: string } = {}) =>
    (
      await one(
        sql,
        sql`insert into members (first_name, last_name, school_id, email, school_email, graduation_year)
            values (${first}, ${last}, ${schoolId}, ${extra.email ?? null}, ${extra.schoolEmail ?? null}, 2027) returning id`,
      )
    ).id;

  /** Membership plus Varsity (A) and JV (B) rosters; returns the two roster ids. */
  const enter = async (schoolId: string, gameId: string, seasonId: string, withMembership = true) => {
    if (withMembership) {
      await sql`insert into season_schools (school_id, game_id, season_id) values (${schoolId}, ${gameId}, ${seasonId}) on conflict do nothing`;
    }
    const varsity = (await one(sql, sql`insert into rosters (school_id, game_id, season_id, name, division) values (${schoolId}, ${gameId}, ${seasonId}, 'Varsity', 'A') returning id`)).id;
    const jv = (await one(sql, sql`insert into rosters (school_id, game_id, season_id, name, division) values (${schoolId}, ${gameId}, ${seasonId}, 'JV', 'B') returning id`)).id;
    return { varsity, jv };
  };
  const addPlayers = async (schoolId: string, rosterId: string, tag: string, count: number) => {
    for (let n = 1; n <= count; n++) {
      const id = await member(schoolId, `Player${n}`, tag, n === 1 ? { email: `${slug(tag)}-1@example.test`, schoolEmail: `${slug(tag)}-1@nycstudents.net` } : {});
      await sql`insert into players (roster_id, member_id, role, is_captain, ign) values (${rosterId}, ${id}, ${n === 1 ? 'captain' : n > 5 ? 'sub' : 'player'}, ${n === 1}, ${`${tag}${n}#0000`})`;
    }
  };

  // Valorant 2026-27: schools 0-7 are members; school 9 has rosters but no membership.
  const rosters2627: Array<{ varsity: string; jv: string }> = [];
  for (let i = 0; i < 8; i++) {
    const r = await enter(schools[i], valorant, val2627);
    rosters2627.push(r);
    await addPlayers(schools[i], r.varsity, SCHOOLS[i].split(' ')[0], i === 0 ? 7 : 5);
    await addPlayers(schools[i], r.jv, `${SCHOOLS[i].split(' ')[0]}JV`, 2);
  }
  const removed = await enter(schools[9], valorant, val2627, false);
  await addPlayers(schools[9], removed.varsity, 'Removed', 5);

  // Valorant 2025-26 (archived): six schools, a snapshot table and a few played matches.
  const rosters2526: Array<{ varsity: string; jv: string }> = [];
  for (let i = 0; i < 6; i++) {
    rosters2526.push(await enter(schools[i], valorant, val2526));
    await sql`insert into season_standings (season_id, school_id, division, rank, wins, losses, games_played)
              values (${val2526}, ${schools[i]}, 'Varsity', ${i + 1}, ${6 - i}, ${i}, 6)`;
  }

  // League of Legends 2026-27 (not published): three schools.
  for (let i = 0; i < 3; i++) await enter(schools[i], lol, lol2627);

  const day = 24 * 3600 * 1000;
  const match = (seasonId: string, home: string, away: string, offsetDays: number, score: [number, number] | null) =>
    sql`insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, home_score, away_score, status)
        values (${seasonId}, ${home}, ${away}, ${new Date(Date.now() + offsetDays * day).toISOString()}, ${score?.[0] ?? null}, ${score?.[1] ?? null}, ${score ? 'completed' : 'scheduled'})`;
  const pairs: Array<[number, number, number, [number, number] | null]> = [
    [0, 1, -14, [2, 0]], [2, 3, -14, [1, 2]], [4, 5, -14, [2, 1]], [6, 7, -14, [0, 2]],
    [0, 2, -7, [2, 1]], [1, 3, -7, [2, 0]], [4, 6, -7, [1, 2]], [5, 7, -7, [2, 0]],
    [0, 3, 7, null], [1, 2, 7, null], [4, 7, 7, null], [5, 6, 7, null],
  ];
  for (const [h, a, d, score] of pairs) {
    await match(val2627, rosters2627[h].varsity, rosters2627[a].varsity, d, score);
  }
  // A match against the school that is NOT a member: staff see it, the public does not.
  await match(val2627, rosters2627[0].varsity, removed.varsity, -3, [2, 0]);
  for (const [h, a, d, score] of [[0, 1, -300, [2, 1]], [2, 3, -300, [0, 2]]] as Array<[number, number, number, [number, number]]>) {
    await match(val2526, rosters2526[h].varsity, rosters2526[a].varsity, d, score);
  }

  console.log(`Seeded: ${SCHOOLS.length} schools, 3 games, 4 seasons, Valorant 2026-27 with 8 member schools.`);
}

async function main(): Promise<void> {
  const url = requireLocalUrl();
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await seedSample(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && /db[\\/]local[\\/]seed-sample\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
