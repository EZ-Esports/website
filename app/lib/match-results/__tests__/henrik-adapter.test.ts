import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_SECONDS, HenrikMatchAdapter, retryAfterSecondsFrom } from '../henrik-adapter';
import { henrikPayload, uuid } from './fixtures';

const KEY = 'test-key-not-real';

function adapterWith(response: Response | Error) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { adapter: new HenrikMatchAdapter({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch }), fetchImpl };
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('HenrikMatchAdapter (fake fetch, never the live API)', () => {
  it('calls the v4 endpoint with the key in the Authorization header', async () => {
    const { adapter, fetchImpl } = adapterWith(json(henrikPayload({ matchId: uuid(1) })));
    const result = await adapter.fetchMatch(uuid(1));
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.henrikdev.xyz/valorant/v4/match/na/${uuid(1)}`);
    expect((init.headers as Record<string, string>).Authorization).toBe(KEY);
  });

  it('maps 404 to not_found', async () => {
    const { adapter } = adapterWith(new Response('{}', { status: 404 }));
    expect(await adapter.fetchMatch(uuid(1))).toMatchObject({ ok: false, kind: 'not_found' });
  });

  it('maps 429 to rate_limited using Retry-After', async () => {
    const { adapter } = adapterWith(new Response('{}', { status: 429, headers: { 'retry-after': '42' } }));
    expect(await adapter.fetchMatch(uuid(1))).toMatchObject({ ok: false, kind: 'rate_limited', retryAfterSeconds: 42 });
  });

  it('maps 5xx and network failure to unavailable', async () => {
    expect(await adapterWith(new Response('x', { status: 503 })).adapter.fetchMatch(uuid(1))).toMatchObject({ kind: 'unavailable' });
    expect(await adapterWith(new Error('boom')).adapter.fetchMatch(uuid(1))).toMatchObject({ kind: 'unavailable' });
  });

  it('maps 401 and a missing key to misconfigured, without calling out when keyless', async () => {
    expect(await adapterWith(new Response('x', { status: 401 })).adapter.fetchMatch(uuid(1))).toMatchObject({ kind: 'misconfigured' });
    const fetchImpl = vi.fn();
    const noKey = new HenrikMatchAdapter({ apiKey: '', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await noKey.fetchMatch(uuid(1))).toMatchObject({ kind: 'misconfigured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps an unexpected body to invalid_response', async () => {
    const { adapter } = adapterWith(json({ status: 200, data: { nope: true } }));
    expect(await adapter.fetchMatch(uuid(1))).toMatchObject({ ok: false, kind: 'invalid_response' });
  });

  it('never puts the key in a failure result', async () => {
    for (const status of [429, 500, 401, 404]) {
      const result = await adapterWith(new Response('x', { status })).adapter.fetchMatch(uuid(1));
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
  });
});

describe('retryAfterSecondsFrom', () => {
  it('reads seconds, an HTTP date and X-RateLimit-Reset, with a default and a cap', () => {
    expect(retryAfterSecondsFrom(new Headers({ 'retry-after': '30' }))).toBe(30);
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(retryAfterSecondsFrom(new Headers({ 'retry-after': 'Tue, 27 Oct 2026 12:01:00 GMT' }), now)).toBe(60);
    expect(retryAfterSecondsFrom(new Headers({ 'x-ratelimit-reset': '15' }))).toBe(15);
    expect(retryAfterSecondsFrom(new Headers())).toBe(DEFAULT_RETRY_SECONDS);
    expect(retryAfterSecondsFrom(new Headers({ 'retry-after': '999999' }))).toBe(3600);
  });
});
