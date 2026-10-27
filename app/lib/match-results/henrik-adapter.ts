/**
 * `MatchDataPort` backed by the unofficial HenrikDev API. This file is the only place that knows
 * the URL, the auth header and Henrik's status codes; replacing it with Riot's official client
 * touches nothing else. It takes the key as a constructor argument and never logs or returns it,
 * so it is safe to unit-test with a fake `fetch` (tests never call the live API).
 */
import { normalizeHenrikMatch } from './henrik-schema';
import type { FetchFailure, FetchResult, MatchDataPort } from './types';

export const HENRIK_BASE_URL = 'https://api.henrikdev.xyz';
const DEFAULT_TIMEOUT_MS = 8000;
/** Used when a 429 carries no usable reset hint. */
export const DEFAULT_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

export interface HenrikAdapterOptions {
  apiKey: string;
  /** Region of the match; the league plays on `na`. */
  affinity?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function fail(kind: FetchFailure['kind'], message: string, retryAfterSeconds?: number): FetchFailure {
  return retryAfterSeconds === undefined ? { ok: false, kind, message } : { ok: false, kind, message, retryAfterSeconds };
}

/** Seconds to wait from `Retry-After` (seconds or an HTTP date) or `X-RateLimit-Reset`. */
export function retryAfterSecondsFrom(headers: Headers, nowMs: number = Date.now()): number {
  const clamp = (n: number) => Math.min(Math.max(Math.ceil(n), 1), MAX_RETRY_SECONDS);
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return clamp(seconds);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return clamp((date - nowMs) / 1000);
  }
  const reset = headers.get('x-ratelimit-reset');
  if (reset) {
    const value = Number(reset);
    if (Number.isFinite(value)) {
      // Henrik documents seconds until reset; tolerate an absolute epoch in seconds.
      return clamp(value > 1e9 ? value - nowMs / 1000 : value);
    }
  }
  return DEFAULT_RETRY_SECONDS;
}

export class HenrikMatchAdapter implements MatchDataPort {
  private readonly apiKey: string;
  private readonly affinity: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HenrikAdapterOptions) {
    this.apiKey = options.apiKey;
    this.affinity = options.affinity ?? 'na';
    this.baseUrl = options.baseUrl ?? HENRIK_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchMatch(matchId: string): Promise<FetchResult> {
    if (!this.apiKey) {
      return fail('misconfigured', 'Automatic match lookup is not set up. Ask an EZ Esports admin.');
    }
    const url = `${this.baseUrl}/valorant/v4/match/${encodeURIComponent(this.affinity)}/${encodeURIComponent(matchId)}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: this.apiKey, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      return fail('unavailable', 'The match data service could not be reached. Try again shortly.');
    }

    if (response.status === 429) {
      const retryAfterSeconds = retryAfterSecondsFrom(response.headers);
      return fail('rate_limited', 'The match data service is busy right now.', retryAfterSeconds);
    }
    if (response.status === 404) {
      return fail(
        'not_found',
        'That match was not found. It may be too old (matches are only kept for a limited time) or the ID is wrong.'
      );
    }
    if (response.status === 401 || response.status === 403) {
      return fail('misconfigured', 'Automatic match lookup is not set up. Ask an EZ Esports admin.');
    }
    if (!response.ok) {
      return fail('unavailable', 'The match data service is having problems. Try again shortly.');
    }

    try {
      return { ok: true, game: normalizeHenrikMatch(await response.json()) };
    } catch {
      return fail('invalid_response', 'The match data service returned something unexpected for this match.');
    }
  }
}
