/**
 * Sliding-window in-memory rate limiter.
 *
 * Limitations: state is per-process. In a stateless/serverless deployment each
 * cold-start resets the counters. For production hardening, replace the Map with
 * an Upstash Redis store (@upstash/ratelimit). The API surface is identical.
 */

const store = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * @param key        Usually the client IP address.
 * @param limit      Maximum requests allowed within the window.
 * @param windowMs   Rolling window length in milliseconds (default 60 s).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  // NOTE: the in-process Map resets on cold starts in serverless environments — counters do not persist across invocations.
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = (store.get(key) ?? []).filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0];
    store.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      resetInMs: oldestInWindow + windowMs - now,
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetInMs: 0,
  };
}

/**
 * Extract the best-effort client IP from a Next.js request, for use as a
 * rate-limit key.
 *
 * This app is hosted on Vercel. Vercel's edge network sets `x-real-ip`
 * itself (never a passthrough of a client-supplied value), and appends the
 * true connecting client IP as the LAST/outermost hop of `x-forwarded-for`.
 * Everything before that last hop — including the first entry — can be
 * freely set by whoever sent the request, so trusting the first XFF entry
 * (the old behavior here) let a client spoof its rate-limit identity simply
 * by prepending an arbitrary IP to the header.
 *
 * Precedence: `x-real-ip` (trusted, Vercel-set) first; otherwise the last
 * `x-forwarded-for` entry (the hop nearest Vercel's own proxy); otherwise
 * `'unknown'`.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map(hop => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return 'unknown';
}

/** Reset the internal store. Useful for testing isolation. */
export function _resetRateLimitStore(): void {
  store.clear();
}

