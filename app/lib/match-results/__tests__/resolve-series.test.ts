import { describe, expect, it, vi } from 'vitest';
import { normalizeHenrikMatch } from '../henrik-schema';
import { resolveSeries, type GameRepository } from '../resolve-series';
import { riotIdKey, type RosterRiotIds } from '../series';
import type { FetchResult, MatchDataPort, NormalizedGame } from '../types';
import { BLUE_PLAYERS, henrikPayload, playersFor, RED_PLAYERS, uuid } from './fixtures';

const keys = (names: string[]) => new Set(names.map((n) => riotIdKey(n, 'NA1')));
const rosters: RosterRiotIds = { home: keys(RED_PLAYERS), away: keys(BLUE_PLAYERS) };

const build = (n: number, winner: 'Red' | 'Blue' = 'Red'): NormalizedGame =>
  normalizeHenrikMatch(
    henrikPayload({
      matchId: uuid(n),
      winner,
      startedAt: `2026-10-20T2${n}:00:00.000Z`,
      players: [...playersFor(RED_PLAYERS, 'Red'), ...playersFor(BLUE_PLAYERS, 'Blue')],
    })
  );

function setup(options: { stored?: NormalizedGame[]; attached?: Record<string, string>; fetch?: (id: string) => FetchResult }) {
  const stored = new Map((options.stored ?? []).map((g) => [g.matchId, g]));
  const repo: GameRepository = {
    findStored: async (ids) => new Map(ids.filter((id) => stored.has(id)).map((id) => [id, stored.get(id)!])),
    store: vi.fn(async (g: NormalizedGame) => void stored.set(g.matchId, g)),
    findAttachments: async (ids) => new Map(ids.filter((id) => options.attached?.[id]).map((id) => [id, options.attached![id]])),
  };
  const fetchMatch = vi.fn(async (id: string): Promise<FetchResult> => options.fetch?.(id) ?? { ok: true, game: build(Number(id.slice(-1))) });
  const port: MatchDataPort = { fetchMatch };
  return { repo, port, fetchMatch };
}

const run = (s: ReturnType<typeof setup>, ids: string[]) =>
  resolveSeries({ leagueMatchId: 'league-1', matchIds: ids, rosters, port: s.port, repo: s.repo });

describe('resolveSeries', () => {
  it('fetches and stores each missing game once, then scores the series', async () => {
    const s = setup({});
    const out = await run(s, [uuid(1), uuid(2)]);
    expect(out.status === 'ok' && out.series).toMatchObject({ homeWins: 2, awayWins: 0 });
    expect(s.fetchMatch).toHaveBeenCalledTimes(2);
    expect(s.repo.store).toHaveBeenCalledTimes(2);
  });

  it('never requests a game that is already stored', async () => {
    const s = setup({ stored: [build(1)] });
    const out = await run(s, [uuid(1), uuid(2)]);
    expect(out.status).toBe('ok');
    expect(s.fetchMatch).toHaveBeenCalledTimes(1);
    expect(s.fetchMatch).toHaveBeenCalledWith(uuid(2));
  });

  it('makes no request at all when every game is stored (a retry or resubmission)', async () => {
    const s = setup({ stored: [build(1), build(2)] });
    expect((await run(s, [uuid(1), uuid(2)])).status).toBe('ok');
    expect(s.fetchMatch).not.toHaveBeenCalled();
  });

  it('rejects a game already counted for another match without calling the API', async () => {
    const s = setup({ attached: { [uuid(1)]: 'other-league-match' } });
    const out = await run(s, [uuid(1), uuid(2)]);
    expect(out.status).toBe('invalid');
    expect(s.fetchMatch).not.toHaveBeenCalled();
  });

  it('allows resubmitting games already attached to this same match', async () => {
    const s = setup({ stored: [build(1), build(2)], attached: { [uuid(1)]: 'league-1' } });
    expect((await run(s, [uuid(1), uuid(2)])).status).toBe('ok');
  });

  it('goes pending on a 429, keeping games already fetched stored', async () => {
    const s = setup({
      fetch: (id) =>
        id === uuid(2)
          ? { ok: false, kind: 'rate_limited', message: 'busy', retryAfterSeconds: 30 }
          : { ok: true, game: build(1) },
    });
    const out = await run(s, [uuid(1), uuid(2)]);
    expect(out).toMatchObject({ status: 'pending', retryAfterSeconds: 30, fetchedCount: 1 });
    expect(s.repo.store).toHaveBeenCalledTimes(1);
  });

  it('goes pending on an outage and stops calling further games', async () => {
    const s = setup({ fetch: () => ({ ok: false, kind: 'unavailable', message: 'down' }) });
    const out = await run(s, [uuid(1), uuid(2), uuid(3)]);
    expect(out.status).toBe('pending');
    expect(s.fetchMatch).toHaveBeenCalledTimes(1);
  });

  it('reports a not-found game per game and is invalid, not pending', async () => {
    const s = setup({ fetch: (id) => (id === uuid(2) ? { ok: false, kind: 'not_found', message: 'gone' } : { ok: true, game: build(1) }) });
    const out = await run(s, [uuid(1), uuid(2)]);
    expect(out).toMatchObject({ status: 'invalid' });
    expect(out.status === 'invalid' && out.errors[0]).toContain('gone');
  });

  it('stores a fetched game even if the series is then refused, so it is not requested again', async () => {
    const s = setup({ fetch: (id) => ({ ok: true, game: build(Number(id.slice(-1)), id === uuid(2) ? 'Blue' : 'Red') }) });
    const out = await run(s, [uuid(1), uuid(2)]);
    expect(out.status).toBe('invalid'); // 1-1 after two games
    expect(s.repo.store).toHaveBeenCalledTimes(2);
  });

  it('does not store an unfinished game', async () => {
    const live = normalizeHenrikMatch(henrikPayload({ matchId: uuid(1), completed: false }));
    const s = setup({ fetch: () => ({ ok: true, game: live }) });
    await run(s, [uuid(1), uuid(2)]);
    expect(s.repo.store).not.toHaveBeenCalled();
  });
});
