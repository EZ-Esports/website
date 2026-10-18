import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * Runs the roster-lock column and guard against a REAL local Postgres that has migration 0050
 * applied. Opt-in only: LOCAL_SEASON_DB_TEST=1 and a loopback DATABASE_URL, so it can never touch
 * production (whose DATABASE_URL lives in .env). It inserts uniquely named rows and deletes them.
 */
function isLoopback(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

const enabled = process.env.LOCAL_SEASON_DB_TEST === '1' && isLoopback(process.env.DATABASE_URL);

vi.mock('server-only', () => ({}));
vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }));

describe.skipIf(!enabled)('season roster lock against the local database', () => {
  const tag = randomUUID().slice(0, 8);
  const gameA = randomUUID();
  const gameB = randomUUID();
  const seasonA = randomUUID();
  const seasonB = randomUUID();
  let dbh: typeof import('@/app/lib/db').db;
  let schema: typeof import('@/app/lib/db/schema');
  let auth: typeof import('@/app/lib/onboarding/manager-auth');
  let eq: typeof import('drizzle-orm').eq;

  beforeAll(async () => {
    ({ db: dbh } = await import('@/app/lib/db'));
    schema = await import('@/app/lib/db/schema');
    auth = await import('@/app/lib/onboarding/manager-auth');
    ({ eq } = await import('drizzle-orm'));
    await dbh.insert(schema.games).values([
      { id: gameA, slug: `lock-a-${tag}`, displayName: `Lock A ${tag}`, shortName: 'LA' },
      { id: gameB, slug: `lock-b-${tag}`, displayName: `Lock B ${tag}`, shortName: 'LB' },
    ]);
    await dbh.insert(schema.seasons).values([
      { id: seasonA, gameId: gameA, name: '2026-27', isActive: true },
      { id: seasonB, gameId: gameB, name: '2026-27', isActive: true },
    ]);
  });

  afterAll(async () => {
    if (!dbh) return;
    // Seasons cascade from games.
    await dbh.delete(schema.games).where(eq(schema.games.id, gameA));
    await dbh.delete(schema.games).where(eq(schema.games.id, gameB));
  });

  it('new seasons start unlocked and the guard reads the column', async () => {
    const season = await auth.getActiveSeasonForGame(gameA);
    expect(season?.rostersLockedAt).toBeNull();
    expect(() => auth.assertSeasonRostersUnlocked({ isStaffAdmin: false }, season)).not.toThrow();
  });

  it('locking one game refuses managers there, not on the other game, and not staff admins', async () => {
    await dbh.update(schema.seasons).set({ rostersLockedAt: new Date() }).where(eq(schema.seasons.id, seasonA));

    const a = await auth.getActiveSeasonForGame(gameA);
    const b = await auth.getActiveSeasonForGame(gameB);
    expect(a?.rostersLockedAt).toBeInstanceOf(Date);
    expect(b?.rostersLockedAt).toBeNull();
    expect(() => auth.assertSeasonRostersUnlocked({ isStaffAdmin: false }, a)).toThrow(/locked by EZ Esports staff/);
    expect(() => auth.assertSeasonRostersUnlocked({ isStaffAdmin: false }, b)).not.toThrow();
    expect(() => auth.assertSeasonRostersUnlocked({ isStaffAdmin: true }, a)).not.toThrow();
  });

  it('unlocking clears the timestamp', async () => {
    await dbh.update(schema.seasons).set({ rostersLockedAt: null }).where(eq(schema.seasons.id, seasonA));
    const a = await auth.getActiveSeasonForGame(gameA);
    expect(a?.rostersLockedAt).toBeNull();
    expect(() => auth.assertSeasonRostersUnlocked({ isStaffAdmin: false }, a)).not.toThrow();
  });
});
