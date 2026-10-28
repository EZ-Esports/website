/**
 * Integration tests against a REAL Postgres, proving the locking and unique-index behaviour the
 * mocked tests can only assume. They are skipped unless TEST_DATABASE_URL points at a loopback
 * database (so CI and the pre-push hook are unaffected), and they never read `.env`.
 *
 *   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/ez_test npx vitest run \
 *     app/lib/db/__tests__/match-results.integration.test.ts
 *
 * The database must be empty or previously migrated by these tests: they apply every real
 * migration in db/migrations (plus a stand-in for Supabase's roles and `auth` schema) first.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeHenrikMatch } from '@/app/lib/match-results/henrik-schema';
import { MATCH_COOLDOWN_MS, USER_MAX_PER_WINDOW } from '@/app/lib/match-results/throttle';
import type { SeriesResult } from '@/app/lib/match-results/series';
import { henrikPayload, uuid } from '@/app/lib/match-results/__tests__/fixtures';
import { isLoopbackUrl, migrateLocal } from './local-postgres';

const TEST_URL = process.env.TEST_DATABASE_URL;
const enabled = isLoopbackUrl(TEST_URL);

type Repo = typeof import('../match-results');
type Schema = typeof import('../schema');

describe.skipIf(!enabled)('match results against a real Postgres', () => {
  let repo: Repo;
  let schema: Schema;
  let db: typeof import('../index').db;
  let raw: ReturnType<typeof postgres>;
  let gameId: string;
  let seasonId: string;
  const suffix = randomUUID().slice(0, 8);

  /** A match between two fresh rosters (a new pair of schools each call keeps tests independent). */
  async function newMatch(): Promise<string> {
    const [home, away] = await db
      .insert(schema.schools)
      .values([
        { name: `Home ${randomUUID()}`, slug: `home-${randomUUID()}` },
        { name: `Away ${randomUUID()}`, slug: `away-${randomUUID()}` },
      ])
      .returning({ id: schema.schools.id });
    const teams = await db
      .insert(schema.teams)
      .values([
        { schoolId: home.id, gameId, seasonId },
        { schoolId: away.id, gameId, seasonId },
      ])
      .returning({ id: schema.teams.id });
    const rosters = await db
      .insert(schema.rosters)
      .values([
        { teamId: teams[0].id, name: 'Varsity', division: 'A' },
        { teamId: teams[1].id, name: 'Varsity', division: 'A' },
      ])
      .returning({ id: schema.rosters.id });
    const [match] = await db
      .insert(schema.matches)
      .values({ seasonId, homeRosterId: rosters[0].id, awayRosterId: rosters[1].id, scheduledAt: new Date('2026-10-20T23:00:00Z') })
      .returning({ id: schema.matches.id });
    return match.id;
  }

  let gameCounter = 100;
  /** Stores a finished game in the cache and returns its provider id. */
  async function storeGame(): Promise<string> {
    const id = uuid(++gameCounter + Math.floor(Math.random() * 1e6));
    await repo.gameRepository.store(normalizeHenrikMatch(henrikPayload({ matchId: id })));
    return id;
  }

  function seriesOf(ids: string[], homeWins: boolean): SeriesResult {
    const games = ids.map((matchId, i) => ({
      matchId,
      gameNumber: i + 1,
      startedAt: new Date('2026-10-20T23:00:00Z'),
      homeSide: 'Red' as const,
      homeRounds: homeWins ? 13 : 7,
      awayRounds: homeWins ? 7 : 13,
      winner: (homeWins ? 'home' : 'away') as 'home' | 'away',
    }));
    return { homeWins: homeWins ? ids.length : 0, awayWins: homeWins ? 0 : ids.length, winner: homeWins ? 'home' : 'away', games };
  }

  const gamesOf = (matchId: string) =>
    raw<{ riot_match_id: string }[]>`
      select g.riot_match_id from match_games mg join valorant_games g on g.id = mg.game_id
      where mg.match_id = ${matchId} order by mg.game_number`;
  const scoresOf = async (matchId: string) => {
    const [row] = await raw<{ status: string; home_score: number | null; away_score: number | null }[]>`
      select status, home_score, away_score from matches where id = ${matchId}`;
    return row;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!; // before the db module is first imported
    await migrateLocal(TEST_URL!);
    raw = postgres(TEST_URL!, { max: 2, onnotice: () => {} });
    schema = await import('../schema');
    ({ db } = await import('../index'));
    repo = await import('../match-results');
    const [game] = await db.insert(schema.games).values({ slug: `valorant-${suffix}`, displayName: 'Valorant', shortName: 'VAL' }).returning({ id: schema.games.id });
    gameId = game.id;
    const [season] = await db.insert(schema.seasons).values({ gameId, name: '2026-27', isActive: false }).returning({ id: schema.seasons.id });
    seasonId = season.id;
  });

  afterAll(async () => {
    await raw?.end();
  });

  it('applied migration 0054 and created the new tables with RLS on', async () => {
    const rows = await raw<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity from pg_class
      where relname in ('valorant_games','valorant_game_players','match_games','match_result_submissions','match_result_attempts')`;
    expect(rows.map((r) => r.relname).sort()).toEqual([
      'match_games', 'match_result_attempts', 'match_result_submissions', 'valorant_game_players', 'valorant_games',
    ]);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    // Running every migration again must be a no-op.
    expect(await migrateLocal(TEST_URL!)).toBeGreaterThanOrEqual(55);
  });

  it('two concurrent saves for the same match: exactly one wins and the rows are consistent', async () => {
    const matchId = await newMatch();
    const homeSeries = seriesOf([await storeGame(), await storeGame()], true);
    const awaySeries = seriesOf([await storeGame(), await storeGame()], false);

    const results = await Promise.all([
      repo.saveSeriesResult({ matchId, series: homeSeries }),
      repo.saveSeriesResult({ matchId, series: awaySeries }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = results[0] ? homeSeries : awaySeries;
    expect((await gamesOf(matchId)).map((r) => r.riot_match_id)).toEqual(winner.games.map((g) => g.matchId));
    expect(await scoresOf(matchId)).toEqual({
      status: 'completed',
      home_score: winner.homeWins,
      away_score: winner.awayWins,
    });
  });

  it('refuses a later save for a match that is already completed, and leaves its rows alone', async () => {
    const matchId = await newMatch();
    const first = seriesOf([await storeGame(), await storeGame()], true);
    expect(await repo.saveSeriesResult({ matchId, series: first })).toBe(true);
    expect(await repo.saveSeriesResult({ matchId, series: seriesOf([await storeGame(), await storeGame()], false) })).toBe(false);
    expect((await gamesOf(matchId)).map((r) => r.riot_match_id)).toEqual(first.games.map((g) => g.matchId));
    expect(await scoresOf(matchId)).toMatchObject({ home_score: 2, away_score: 0 });
  });

  it('the same game submitted to two different matches at once: the unique index lets exactly one in', async () => {
    const shared = await storeGame();
    const matchA = await newMatch();
    const matchB = await newMatch();
    const seriesA = seriesOf([shared, await storeGame()], true);
    const seriesB = seriesOf([shared, await storeGame()], true);

    const settled = await Promise.allSettled([
      repo.saveSeriesResult({ matchId: matchA, series: seriesA }),
      repo.saveSeriesResult({ matchId: matchB, series: seriesB }),
    ]);

    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(repo.isUniqueViolation(rejected[0].reason)).toBe(true);

    const [winnerId, loserId] = settled[0].status === 'fulfilled' ? [matchA, matchB] : [matchB, matchA];
    expect(await gamesOf(winnerId)).toHaveLength(2);
    // The loser's transaction rolled back completely: no games attached, no score, still scheduled.
    expect(await gamesOf(loserId)).toHaveLength(0);
    expect(await scoresOf(loserId)).toEqual({ status: 'scheduled', home_score: null, away_score: null });
    const [{ n }] = await raw<{ n: number }[]>`select count(*)::int as n from match_games mg join valorant_games g on g.id = mg.game_id where g.riot_match_id = ${shared}`;
    expect(n).toBe(1);
  });

  it('the repository reports which match already holds a game', async () => {
    const matchId = await newMatch();
    const ids = [await storeGame(), await storeGame()];
    await repo.saveSeriesResult({ matchId, series: seriesOf(ids, true) });
    const attachments = await repo.gameRepository.findAttachments(ids);
    expect([...attachments.values()]).toEqual([matchId, matchId]);
  });

  describe('fresh-submission throttle (persisted)', () => {
    it('refuses a second fresh submission for a match within 30 seconds, allows it after', async () => {
      const matchId = await newMatch();
      const user = randomUUID();
      const t0 = new Date('2026-10-27T12:00:00Z');
      expect((await repo.reserveSubmissionAttempt({ matchId, userId: user, now: t0 })).ok).toBe(true);
      const early = await repo.reserveSubmissionAttempt({ matchId, userId: user, now: new Date(t0.getTime() + 10_000) });
      expect(early).toMatchObject({ ok: false, waitSeconds: 20 });
      expect((await repo.reserveSubmissionAttempt({ matchId, userId: user, now: new Date(t0.getTime() + MATCH_COOLDOWN_MS) })).ok).toBe(true);
    });

    it('allows ten per user per hour across matches and refuses the eleventh', async () => {
      const user = randomUUID();
      const t0 = new Date('2026-10-27T12:00:00Z');
      for (let i = 0; i < USER_MAX_PER_WINDOW; i++) {
        const matchId = await newMatch();
        const d = await repo.reserveSubmissionAttempt({ matchId, userId: user, now: new Date(t0.getTime() + i * 60_000) });
        expect(d.ok).toBe(true);
      }
      const eleventh = await repo.reserveSubmissionAttempt({ matchId: await newMatch(), userId: user, now: new Date(t0.getTime() + 11 * 60_000) });
      expect(eleventh.ok).toBe(false);
      // The oldest attempt (t0) ages out an hour after it was made.
      const later = await repo.reserveSubmissionAttempt({ matchId: await newMatch(), userId: user, now: new Date(t0.getTime() + 61 * 60_000) });
      expect(later.ok).toBe(true);
    });

    it('prunes attempts older than the one-hour window and leaves recent ones', async () => {
      const matchId = await newMatch();
      const user = randomUUID();
      const old = new Date('2026-10-27T10:00:00Z');
      await repo.reserveSubmissionAttempt({ matchId, userId: user, now: old });
      const later = new Date(old.getTime() + 2 * 60 * 60 * 1000);
      expect((await repo.reserveSubmissionAttempt({ matchId, userId: user, now: later })).ok).toBe(true);
      const rows = await raw<{ created_at: Date }[]>`select created_at from match_result_attempts where match_id = ${matchId}`;
      expect(rows).toHaveLength(1);
    });

    it('lets exactly one of several concurrent fresh submissions for a match through', async () => {
      const matchId = await newMatch();
      const now = new Date('2026-10-27T13:00:00Z');
      const results = await Promise.all(
        Array.from({ length: 6 }, () => repo.reserveSubmissionAttempt({ matchId, userId: randomUUID(), now }))
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
    });
  });
});
